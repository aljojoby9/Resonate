/**
 * CONVERSATION HEALTH MONITOR (CHM)
 *
 * Watches active conversations passively. Detects dying conversations
 * before users realize it. Intervenes with precision.
 *
 * 5 Signals:
 *   1. Response latency trend (7-day rolling)
 *   2. Message length trend (decreasing = disengagement)
 *   3. Sentiment trajectory (7-day trend)
 *   4. Initiative ratio (who starts daily sessions)
 *   5. Topic diversity (semantic distance between clusters)
 *
 * State Machine:
 *   WARMING → ACTIVE → COOLING → DORMANT → REVIVED
 *
 * Resonance Nudge: gpt-4o-mini generated question shown to quiet party.
 */

import { eq, and, gte, desc, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
    conversations,
    messages,
    resonanceProfiles,
    matches,
    users,
} from "@/server/db/schema";
import { generateCompletion } from "@/lib/openai";

// ─── Types ───────────────────────────────────────────────

type ConversationState = "warming" | "active" | "cooling" | "dormant" | "revived";

interface HealthSignals {
    responseLatencyTrend: number; // -1 (getting slower) to 1 (getting faster)
    messageLengthTrend: number; // -1 (shorter) to 1 (longer)
    sentimentTrajectory: number; // -1 (worsening) to 1 (improving)
    initiativeRatio: number; // 0 (one-sided) to 1 (balanced)
    topicDiversity: number; // 0 (stagnant) to 1 (diverse)
}

interface ConversationHealth {
    conversationId: string;
    matchId: string;
    currentState: ConversationState;
    newState: ConversationState;
    signals: HealthSignals;
    overallHealth: number; // 0-100
    nudge: string | null;
    nudgeTargetUserId: string | null;
}

// ─── SIGNAL COMPUTATIONS ────────────────────────────────

/**
 * Signal 1: Response Latency Trend
 * Not just average — the TREND. Getting slower = cooling.
 */
async function computeLatencyTrend(
    conversationId: string
): Promise<number> {
    const msgs = await db.query.messages.findMany({
        where: eq(messages.conversationId, conversationId),
        orderBy: [desc(messages.sentAt)],
        limit: 50,
        columns: { senderId: true, sentAt: true },
    });

    if (msgs.length < 4) return 0; // Not enough data

    // Compute response times between alternating senders
    const responseTimes: number[] = [];
    for (let i = 1; i < msgs.length; i++) {
        const current = msgs[i]!;
        const prev = msgs[i - 1]!;
        if (current.senderId !== prev.senderId && current.sentAt && prev.sentAt) {
            responseTimes.push(prev.sentAt.getTime() - current.sentAt.getTime());
        }
    }

    if (responseTimes.length < 3) return 0;

    // Split into first half and second half, compare averages
    const mid = Math.floor(responseTimes.length / 2);
    const recentAvg = responseTimes.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
    const olderAvg = responseTimes.slice(mid).reduce((a, b) => a + b, 0) / (responseTimes.length - mid);

    if (olderAvg === 0) return 0;

    // Ratio > 1 = getting slower (bad), < 1 = getting faster (good)
    const ratio = recentAvg / olderAvg;
    return Math.max(-1, Math.min(1, 1 - ratio)); // Inverted: positive = healthy
}

/**
 * Signal 2: Message Length Trend
 * Decreasing message length = disengagement signal.
 */
async function computeLengthTrend(
    conversationId: string
): Promise<number> {
    const msgs = await db.query.messages.findMany({
        where: eq(messages.conversationId, conversationId),
        orderBy: [desc(messages.sentAt)],
        limit: 50,
        columns: { content: true, sentAt: true },
    });

    if (msgs.length < 6) return 0;

    const lengths = msgs.map((m) => m.content.length);
    const mid = Math.floor(lengths.length / 2);
    const recentAvg = lengths.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
    const olderAvg = lengths.slice(mid).reduce((a, b) => a + b, 0) / (lengths.length - mid);

    if (olderAvg === 0) return 0;

    const ratio = recentAvg / olderAvg;
    return Math.max(-1, Math.min(1, ratio - 1)); // > 0 = growing, < 0 = shrinking
}

/**
 * Signal 3: Sentiment Trajectory
 * Uses message sentiment scores. Moving toward neutral = cooling.
 */
async function computeSentimentTrajectory(
    conversationId: string
): Promise<number> {
    const msgs = await db.query.messages.findMany({
        where: eq(messages.conversationId, conversationId),
        orderBy: [desc(messages.sentAt)],
        limit: 30,
        columns: { sentimentScore: true },
    });

    const scored = msgs.filter((m) => m.sentimentScore !== null);
    if (scored.length < 4) return 0; // Not enough sentiment data

    const mid = Math.floor(scored.length / 2);
    const recentAvg = scored.slice(0, mid)
        .reduce((a, m) => a + (m.sentimentScore ?? 0), 0) / mid;
    const olderAvg = scored.slice(mid)
        .reduce((a, m) => a + (m.sentimentScore ?? 0), 0) / (scored.length - mid);

    // Positive trajectory = improving sentiment
    return Math.max(-1, Math.min(1, recentAvg - olderAvg));
}

/**
 * Signal 4: Initiative Ratio
 * Healthy = both people start conversations roughly equally.
 */
async function computeInitiativeRatio(
    conversationId: string,
    matchId: string
): Promise<number> {
    const msgs = await db.query.messages.findMany({
        where: eq(messages.conversationId, conversationId),
        orderBy: [desc(messages.sentAt)],
        limit: 100,
        columns: { senderId: true, sentAt: true },
    });

    if (msgs.length < 4) return 0.5; // Neutral

    // Group messages into "sessions" (gaps > 2 hours = new session)
    const SESSION_GAP_MS = 2 * 60 * 60 * 1000;
    const sessionStarters: string[] = [];
    let lastTime = 0;

    // Messages are in desc order, so reverse for chronological
    const chronological = [...msgs].reverse();
    for (const msg of chronological) {
        if (!msg.sentAt || !msg.senderId) continue;
        const time = msg.sentAt.getTime();
        if (time - lastTime > SESSION_GAP_MS) {
            sessionStarters.push(msg.senderId);
        }
        lastTime = time;
    }

    if (sessionStarters.length < 2) return 0.5;

    // Count unique starters
    const starterCounts = new Map<string, number>();
    for (const s of sessionStarters) {
        starterCounts.set(s, (starterCounts.get(s) ?? 0) + 1);
    }

    const counts = [...starterCounts.values()];
    if (counts.length < 2) return 0.2; // Only one person initiates

    const max = Math.max(...counts);
    const min = Math.min(...counts);

    // Perfect balance = 1.0, total imbalance = 0.0
    return max === 0 ? 0.5 : min / max;
}

/**
 * Signal 5: Topic Diversity
 * Conversations that loop on the same topics = stagnation.
 * Simple proxy: unique word ratio over recent messages.
 */
async function computeTopicDiversity(
    conversationId: string
): Promise<number> {
    const msgs = await db.query.messages.findMany({
        where: eq(messages.conversationId, conversationId),
        orderBy: [desc(messages.sentAt)],
        limit: 30,
        columns: { content: true },
    });

    if (msgs.length < 5) return 0.5; // Neutral

    const allWords = msgs
        .flatMap((m) => m.content.toLowerCase().split(/\s+/))
        .filter((w) => w.length > 3); // Ignore short words

    const uniqueWords = new Set(allWords);
    const diversity = allWords.length === 0 ? 0.5 : uniqueWords.size / allWords.length;

    // Normalize to 0-1 (0.3 = low diversity, 0.7+ = high)
    return Math.max(0, Math.min(1, (diversity - 0.2) / 0.5));
}

// ─── STATE MACHINE ──────────────────────────────────────

function determineState(
    currentState: ConversationState,
    signals: HealthSignals,
    daysSinceLastMessage: number
): ConversationState {
    // DORMANT: no messages for 72 hours
    if (daysSinceLastMessage >= 3) {
        return currentState === "dormant" ? "dormant" : "dormant";
    }

    // Count negative signals
    const negativeCount = [
        signals.responseLatencyTrend < -0.3,
        signals.messageLengthTrend < -0.3,
        signals.sentimentTrajectory < -0.2,
        signals.initiativeRatio < 0.3,
        signals.topicDiversity < 0.3,
    ].filter(Boolean).length;

    const positiveCount = [
        signals.responseLatencyTrend > 0.2,
        signals.messageLengthTrend > 0,
        signals.sentimentTrajectory > 0,
        signals.initiativeRatio > 0.5,
        signals.topicDiversity > 0.5,
    ].filter(Boolean).length;

    // REVIVED: was dormant, now has activity
    if (currentState === "dormant" && daysSinceLastMessage < 1) {
        return "revived";
    }

    // COOLING: 2+ signals negative simultaneously
    if (negativeCount >= 2) {
        return "cooling";
    }

    // ACTIVE: all signals neutral or positive
    if (positiveCount >= 3) {
        return "active";
    }

    // WARMING: new conversation, signals still developing
    if (currentState === "warming") {
        return positiveCount >= 2 ? "active" : "warming";
    }

    return currentState;
}

// ─── NUDGE GENERATOR ────────────────────────────────────

async function generateNudge(
    matchId: string,
    conversationId: string,
    quietUserId: string
): Promise<string | null> {
    try {
        // Fetch match data for context
        const match = await db.query.matches.findFirst({
            where: eq(matches.id, matchId),
        });

        if (!match) return null;

        const otherUserId = match.userAId === quietUserId ? match.userBId : match.userAId;

        // Fetch both profiles
        const [quietProfile, otherProfile] = await Promise.all([
            db.query.resonanceProfiles.findFirst({
                where: eq(resonanceProfiles.userId, quietUserId),
                columns: { dominantEmotionTags: true, energyArchetype: true },
            }),
            db.query.resonanceProfiles.findFirst({
                where: eq(resonanceProfiles.userId, otherUserId),
                columns: { dominantEmotionTags: true, communicationStyle: true },
            }),
        ]);

        // Get last 3 messages for context
        const recentMsgs = await db.query.messages.findMany({
            where: eq(messages.conversationId, conversationId),
            orderBy: [desc(messages.sentAt)],
            limit: 3,
            columns: { content: true, senderId: true },
        });

        const interestTagsA = (quietProfile?.dominantEmotionTags as string[]) ?? [];
        const interestTagsB = (otherProfile?.dominantEmotionTags as string[]) ?? [];

        const systemPrompt = `You are a conversation catalyst for a dating app. Your job is to generate ONE specific, curious question that could naturally restart a cooling conversation. Rules:
- Under 25 words
- Must be a question (end with ?)
- Reference ONE of the provided interest tags if possible
- Never generic ("how are you", "what's up")
- Never guilt-trippy ("why haven't you replied")
- Should spark genuine curiosity
- Match the energy of the archetype provided`;

        const userPrompt = `User A interests: ${interestTagsA.join(", ") || "creative, curious"}
User B interests: ${interestTagsB.join(", ") || "thoughtful, warm"}
User A archetype: ${quietProfile?.energyArchetype ?? "wave"}
User B communication style: ${otherProfile?.communicationStyle ?? "expressive"}
Last messages: ${recentMsgs.map((m) => `"${m.content.slice(0, 100)}"`).join(", ") || "No recent messages"}

Generate exactly one question.`;

        const nudge = await generateCompletion(systemPrompt, userPrompt);
        return nudge.trim();
    } catch (error) {
        console.warn("[CHM] Nudge generation failed:", error);
        return null;
    }
}

// ─── IDENTIFY QUIET PARTY ───────────────────────────────

async function identifyQuietParty(
    conversationId: string,
    userAId: string,
    userBId: string
): Promise<string> {
    const recentMsgs = await db.query.messages.findMany({
        where: eq(messages.conversationId, conversationId),
        orderBy: [desc(messages.sentAt)],
        limit: 10,
        columns: { senderId: true },
    });

    const counts = new Map<string, number>();
    counts.set(userAId, 0);
    counts.set(userBId, 0);

    for (const msg of recentMsgs) {
        if (msg.senderId) {
            counts.set(msg.senderId, (counts.get(msg.senderId) ?? 0) + 1);
        }
    }

    // The user who sent fewer messages recently is the quiet party
    return (counts.get(userAId) ?? 0) <= (counts.get(userBId) ?? 0) ? userAId : userBId;
}

// ─── MAIN CHM FUNCTION ──────────────────────────────────

/**
 * Analyze a single conversation's health.
 * Called by the Inngest scheduled function every 4 hours.
 */
export async function analyzeConversationHealth(
    conversationId: string
): Promise<ConversationHealth> {
    // Fetch conversation + match
    const conversation = await db.query.conversations.findFirst({
        where: eq(conversations.id, conversationId),
    });

    if (!conversation) throw new Error(`Conversation ${conversationId} not found`);

    const match = await db.query.matches.findFirst({
        where: eq(matches.id, conversation.matchId),
    });

    if (!match) throw new Error(`Match ${conversation.matchId} not found`);

    // Compute all 5 signals
    const [
        responseLatencyTrend,
        messageLengthTrend,
        sentimentTrajectory,
        initiativeRatio,
        topicDiversity,
    ] = await Promise.all([
        computeLatencyTrend(conversationId),
        computeLengthTrend(conversationId),
        computeSentimentTrajectory(conversationId),
        computeInitiativeRatio(conversationId, conversation.matchId),
        computeTopicDiversity(conversationId),
    ]);

    const signals: HealthSignals = {
        responseLatencyTrend,
        messageLengthTrend,
        sentimentTrajectory,
        initiativeRatio,
        topicDiversity,
    };

    // Determine days since last message
    const daysSinceLastMessage = conversation.lastMessageAt
        ? (Date.now() - conversation.lastMessageAt.getTime()) / (1000 * 60 * 60 * 24)
        : 999;

    // Current state
    const currentState = (conversation.healthState ?? "warming") as ConversationState;

    // Determine new state
    const newState = determineState(
        currentState,
        signals,
        daysSinceLastMessage
    );

    // Overall health score (0-100)
    const overallHealth = Math.round(
        ((signals.responseLatencyTrend + 1) / 2 * 25 +
            (signals.messageLengthTrend + 1) / 2 * 20 +
            (signals.sentimentTrajectory + 1) / 2 * 20 +
            signals.initiativeRatio * 20 +
            signals.topicDiversity * 15)
    );

    // Generate nudge if cooling
    let nudge: string | null = null;
    let nudgeTargetUserId: string | null = null;

    if (newState === "cooling") {
        nudgeTargetUserId = await identifyQuietParty(
            conversationId,
            match.userAId,
            match.userBId
        );
        nudge = await generateNudge(
            conversation.matchId,
            conversationId,
            nudgeTargetUserId
        );
    }

    // Update conversation state in DB
    if (newState !== currentState) {
        await db
            .update(conversations)
            .set({
                healthState: newState,
                ...(nudge ? { pendingNudge: nudge, nudgeGeneratedAt: new Date() } : {}),
            })
            .where(eq(conversations.id, conversationId));
    }

    return {
        conversationId,
        matchId: conversation.matchId,
        currentState,
        newState,
        signals,
        overallHealth,
        nudge,
        nudgeTargetUserId,
    };
}

/**
 * Process all active conversations. Called by Inngest every 4 hours.
 */
export async function processAllConversations(): Promise<{
    total: number;
    healthy: number;
    cooling: number;
    dormant: number;
    nudgesGenerated: number;
}> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get all conversations with recent activity
    const activeConversations = await db.query.conversations.findMany({
        where: gte(conversations.lastMessageAt, sevenDaysAgo),
        columns: { id: true },
    });

    let healthy = 0, cooling = 0, dormant = 0, nudgesGenerated = 0;

    for (const conv of activeConversations) {
        try {
            const result = await analyzeConversationHealth(conv.id);

            switch (result.newState) {
                case "active":
                case "warming":
                case "revived":
                    healthy++;
                    break;
                case "cooling":
                    cooling++;
                    break;
                case "dormant":
                    dormant++;
                    break;
            }

            if (result.nudge) nudgesGenerated++;
        } catch (error) {
            console.error(`[CHM] Failed to analyze conversation ${conv.id}:`, error);
        }
    }

    return {
        total: activeConversations.length,
        healthy,
        cooling,
        dormant,
        nudgesGenerated,
    };
}
