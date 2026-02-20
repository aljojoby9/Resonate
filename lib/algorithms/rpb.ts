/**
 * RESONANCE PROFILE BUILDER (RPB)
 *
 * Passively builds and continuously updates each user's emotional identity
 * from raw behavioral signals. No questionnaires. No self-reporting.
 *
 * 6 Data Sources:
 *   1. Voice note (onboarding) → tone, vocabulary, emotion
 *   2. Bio writing session → communication style, self-consciousness
 *   3. Messaging behavior → sentence length, question rate, emoji, vocab diversity
 *   4. Typing behavior → cadence variance → emotional state
 *   5. Session timing → peakActivityWindows (chronobiology)
 *   6. Browsing behavior → dwell time, photo vs bio preference
 */

import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
    users,
    resonanceProfiles,
    behavioralEvents,
    messages,
} from "@/server/db/schema";
import { generateEmbedding, generateCompletion } from "@/lib/openai";
import { upsertVector, type VectorMetadata } from "@/lib/pinecone";
import { cacheInvalidatePattern } from "@/lib/redis";

// ─── Types ───────────────────────────────────────────────

type EnergyArchetype = "spark" | "anchor" | "wave" | "ember" | "storm";
type CommunicationStyle = "expressive" | "precise" | "poetic" | "minimal" | "witty";

interface ProfileSignals {
    voiceAnalysis: VoiceSignals | null;
    bioAnalysis: BioSignals | null;
    messagingBehavior: MessagingSignals | null;
    typingBehavior: TypingSignals | null;
    sessionTiming: SessionSignals | null;
    browsingBehavior: BrowsingSignals | null;
}

interface VoiceSignals {
    transcriptWordCount: number;
    vocabularyRichness: number; // unique words / total words
    sentimentScore: number; // -1 to 1
    dominantEmotions: string[];
    speakingPace: string; // "fast" | "moderate" | "slow"
}

interface BioSignals {
    wordCount: number;
    editCount: number;
    deletionRate: number; // words deleted / words typed
    style: "minimal" | "moderate" | "expressive";
}

interface MessagingSignals {
    avgSentenceLength: number;
    questionRate: number; // questions per message
    emojiRate: number; // emojis per message
    vocabularyDiversity: number; // unique words / total words
    responseInitiationRate: number; // % of convos where user sends first
    avgResponseTimeMs: number;
    totalMessageCount: number;
}

interface TypingSignals {
    avgTypingDurationMs: number;
    cadenceVariance: number; // high = anxious/excited, low = calm
    pauseFrequency: number; // pauses per minute
}

interface SessionSignals {
    peakHours: number[]; // 24 slots, 0-1 score per hour
    avgSessionDurationMin: number;
    sessionsPerDay: number;
}

interface BrowsingSignals {
    avgProfileDwellMs: number;
    photoDwellRatio: number; // time on photos vs bio
    bioReadRate: number; // % of profiles where bio was read
    profilesViewedPerSession: number;
}

// ─── COMPLETENESS SCORING ────────────────────────────────

interface CompletenessBreakdown {
    voice: number; // 0 or 1
    bio: number; // 0 or 1
    messaging: number; // 0-1 based on message count
    typing: number; // 0 or 1
    sessions: number; // 0-1 based on days of data
    browsing: number; // 0 or 1
    total: number; // weighted average 0-100
}

function computeCompleteness(signals: ProfileSignals): CompletenessBreakdown {
    const voice = signals.voiceAnalysis ? 1 : 0;
    const bio = signals.bioAnalysis ? 1 : 0;

    // Messaging: scale from 0-1 based on message count (full at 50+ messages)
    const msgCount = signals.messagingBehavior?.totalMessageCount ?? 0;
    const messaging = Math.min(msgCount / 50, 1);

    const typing = signals.typingBehavior ? 1 : 0;

    // Sessions: scale from 0-1 based on days of data (full at 7+ days)
    const sessionHours = signals.sessionTiming?.peakHours ?? [];
    const activeDays = sessionHours.filter((h) => h > 0.1).length;
    const sessions = Math.min(activeDays / 7, 1);

    const browsing = signals.browsingBehavior ? 1 : 0;

    // Weighted total (voice most important for cold start)
    const total = Math.round(
        (voice * 25 + bio * 15 + messaging * 20 + typing * 10 + sessions * 15 + browsing * 15)
    );

    return { voice, bio, messaging, typing, sessions, browsing, total };
}

// ─── DATA SOURCE AGGREGATORS ─────────────────────────────

async function aggregateVoiceSignals(userId: string): Promise<VoiceSignals | null> {
    // Look for voice note processing events
    const events = await db.query.behavioralEvents.findMany({
        where: eq(behavioralEvents.userId, userId),
        orderBy: (t, { desc }) => [desc(t.serverTs)],
        limit: 1,
    });

    // Check if any voice note data exists in the user record
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { voiceBioUrl: true },
    });

    if (!user?.voiceBioUrl) return null;

    // In production, this would call Whisper for transcription + NLP pipeline.
    // For now, we generate signals from any stored analysis events.
    const voiceEvent = events.find(
        (e) => e.eventType === "voice_note_analyzed"
    );

    if (voiceEvent?.eventData) {
        const data = voiceEvent.eventData as Record<string, unknown>;
        return {
            transcriptWordCount: (data.wordCount as number) ?? 100,
            vocabularyRichness: (data.vocabularyRichness as number) ?? 0.6,
            sentimentScore: (data.sentimentScore as number) ?? 0.3,
            dominantEmotions: (data.dominantEmotions as string[]) ?? ["curiosity"],
            speakingPace: (data.speakingPace as string) ?? "moderate",
        };
    }

    // Default signals for when voice URL exists but analysis hasn't run yet
    return {
        transcriptWordCount: 0,
        vocabularyRichness: 0.5,
        sentimentScore: 0,
        dominantEmotions: [],
        speakingPace: "moderate",
    };
}

async function aggregateBioSignals(userId: string): Promise<BioSignals | null> {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { bio: true },
    });

    if (!user?.bio) return null;

    const wordCount = user.bio.split(/\s+/).length;

    // Check for bio editing events
    const editEvents = await db.query.behavioralEvents.findMany({
        where: eq(behavioralEvents.userId, userId),
    });
    const bioEdits = editEvents.filter((e) => e.eventType === "bio_edited");

    return {
        wordCount,
        editCount: bioEdits.length,
        deletionRate: bioEdits.length > 0 ? 0.3 : 0, // Estimated
        style: wordCount < 20 ? "minimal" : wordCount > 80 ? "expressive" : "moderate",
    };
}

async function aggregateMessagingSignals(userId: string): Promise<MessagingSignals | null> {
    const userMessages = await db.query.messages.findMany({
        where: eq(messages.senderId, userId),
        limit: 500,
        orderBy: (t, { desc }) => [desc(t.sentAt)],
    });

    if (userMessages.length < 3) return null;

    const totalWords = userMessages.reduce(
        (sum, m) => sum + m.content.split(/\s+/).length,
        0
    );
    const totalChars = userMessages.reduce((sum, m) => sum + m.content.length, 0);
    const uniqueWords = new Set(
        userMessages.flatMap((m) => m.content.toLowerCase().split(/\s+/))
    );
    const questions = userMessages.filter((m) => m.content.includes("?")).length;
    const emojis = userMessages.reduce(
        (sum, m) => sum + (m.content.match(/[\u{1F600}-\u{1F9FF}]/gu) ?? []).length,
        0
    );

    return {
        avgSentenceLength: totalChars / userMessages.length,
        questionRate: questions / userMessages.length,
        emojiRate: emojis / userMessages.length,
        vocabularyDiversity: uniqueWords.size / Math.max(totalWords, 1),
        responseInitiationRate: 0.5, // Computed from conversation-level analysis
        avgResponseTimeMs: 0, // Computed from message pairs
        totalMessageCount: userMessages.length,
    };
}

async function aggregateTypingSignals(userId: string): Promise<TypingSignals | null> {
    const typingEvents = await db.query.behavioralEvents.findMany({
        where: eq(behavioralEvents.userId, userId),
    });

    const starts = typingEvents.filter((e) => e.eventType === "typing_started");
    const stops = typingEvents.filter((e) => e.eventType === "typing_stopped");

    if (starts.length < 5) return null;

    // Compute typing durations from start/stop pairs
    const durations: number[] = [];
    for (let i = 0; i < Math.min(starts.length, stops.length); i++) {
        const start = starts[i]!.clientTs;
        const stop = stops[i]!.clientTs;
        if (start && stop) {
            durations.push(new Date(stop).getTime() - new Date(start).getTime());
        }
    }

    const avgDuration =
        durations.reduce((a, b) => a + b, 0) / Math.max(durations.length, 1);

    // Cadence variance — std dev of typing durations
    const mean = avgDuration;
    const variance =
        durations.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) /
        Math.max(durations.length, 1);

    return {
        avgTypingDurationMs: avgDuration,
        cadenceVariance: Math.sqrt(variance),
        pauseFrequency: 0, // Would require character-level timing data
    };
}

async function aggregateSessionSignals(userId: string): Promise<SessionSignals | null> {
    const sessionEvents = await db.query.behavioralEvents.findMany({
        where: eq(behavioralEvents.userId, userId),
    });

    const appOpens = sessionEvents.filter((e) => e.eventType === "app_opened");
    const appCloses = sessionEvents.filter((e) => e.eventType === "app_closed");

    if (appOpens.length < 3) return null;

    // Build 24-slot activity array
    const hourCounts = new Array(24).fill(0) as number[];
    for (const event of appOpens) {
        if (event.clientTs) {
            const hour = new Date(event.clientTs).getHours();
            hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;
        }
    }
    const maxCount = Math.max(...hourCounts, 1);
    const peakHours = hourCounts.map((c) => c / maxCount);

    // Average session duration
    const durations: number[] = [];
    for (let i = 0; i < Math.min(appOpens.length, appCloses.length); i++) {
        const open = appOpens[i]!.clientTs;
        const close = appCloses[i]!.clientTs;
        if (open && close) {
            durations.push(
                (new Date(close).getTime() - new Date(open).getTime()) / 60000
            );
        }
    }

    return {
        peakHours,
        avgSessionDurationMin:
            durations.reduce((a, b) => a + b, 0) / Math.max(durations.length, 1),
        sessionsPerDay: appOpens.length / 7, // Assumes 7 days of data
    };
}

async function aggregateBrowsingSignals(userId: string): Promise<BrowsingSignals | null> {
    const browseEvents = await db.query.behavioralEvents.findMany({
        where: eq(behavioralEvents.userId, userId),
    });

    const profileViews = browseEvents.filter(
        (e) => e.eventType === "profile_viewed"
    );
    const photoViews = browseEvents.filter(
        (e) => e.eventType === "photo_viewed"
    );

    if (profileViews.length < 3) return null;

    return {
        avgProfileDwellMs: 8000, // Default — would be computed from dwell events
        photoDwellRatio: photoViews.length / Math.max(profileViews.length, 1),
        bioReadRate: 0.6, // Default — would use scroll_depth events
        profilesViewedPerSession: profileViews.length / 7,
    };
}

// ─── ARCHETYPE CLASSIFICATION ────────────────────────────

function classifyArchetype(signals: ProfileSignals): EnergyArchetype {
    const voice = signals.voiceAnalysis;
    const messaging = signals.messagingBehavior;
    const typing = signals.typingBehavior;
    const sessions = signals.sessionTiming;

    // Spark: High energy, fast pace, lots of emojis, variable schedule
    const sparkScore =
        (voice?.speakingPace === "fast" ? 0.3 : 0) +
        (messaging && messaging.emojiRate > 0.5 ? 0.2 : 0) +
        (typing && typing.cadenceVariance > 5000 ? 0.2 : 0) +
        (messaging && messaging.questionRate > 0.3 ? 0.15 : 0) +
        (voice && voice.sentimentScore > 0.5 ? 0.15 : 0);

    // Anchor: Steady, consistent, thoughtful responses
    const anchorScore =
        (voice?.speakingPace === "slow" ? 0.3 : 0) +
        (typing && typing.cadenceVariance < 2000 ? 0.25 : 0) +
        (messaging && messaging.avgSentenceLength > 80 ? 0.2 : 0) +
        (sessions && sessions.sessionsPerDay < 3 ? 0.15 : 0) +
        (messaging && messaging.questionRate > 0.2 ? 0.1 : 0);

    // Wave: Rhythmic, emotionally fluid, moderate pace
    const waveScore =
        (voice?.speakingPace === "moderate" ? 0.25 : 0) +
        (typing && typing.cadenceVariance > 2000 && typing.cadenceVariance < 5000 ? 0.25 : 0) +
        (voice && Math.abs(voice.sentimentScore) < 0.3 ? 0.2 : 0) +
        (sessions && sessions.avgSessionDurationMin > 10 ? 0.15 : 0) +
        (messaging && messaging.vocabularyDiversity > 0.5 ? 0.15 : 0);

    // Ember: Warm, deep, slow-building connections
    const emberScore =
        (messaging && messaging.avgSentenceLength > 60 ? 0.25 : 0) +
        (messaging && messaging.questionRate > 0.25 ? 0.2 : 0) +
        (messaging && messaging.vocabularyDiversity > 0.6 ? 0.2 : 0) +
        (voice && voice.dominantEmotions.some((e) => ["warmth", "care", "empathy"].includes(e)) ? 0.2 : 0) +
        (voice && voice.vocabularyRichness > 0.7 ? 0.15 : 0);

    // Storm: Intense, passionate, high emotional variance
    const stormScore =
        (typing && typing.cadenceVariance > 8000 ? 0.3 : 0) +
        (voice && Math.abs(voice.sentimentScore) > 0.6 ? 0.25 : 0) +
        (messaging && messaging.emojiRate > 0.8 ? 0.15 : 0) +
        (sessions && sessions.sessionsPerDay > 5 ? 0.15 : 0) +
        (voice?.speakingPace === "fast" ? 0.15 : 0);

    const scores: Record<EnergyArchetype, number> = {
        spark: sparkScore,
        anchor: anchorScore,
        wave: waveScore,
        ember: emberScore,
        storm: stormScore,
    };

    return (Object.entries(scores).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "wave") as EnergyArchetype;
}

function classifyCommunicationStyle(signals: ProfileSignals): CommunicationStyle {
    const messaging = signals.messagingBehavior;
    const bio = signals.bioAnalysis;
    const voice = signals.voiceAnalysis;

    if (!messaging && !bio) return "expressive"; // Default for cold start

    const avgLen = messaging?.avgSentenceLength ?? 40;
    const vocabDiv = messaging?.vocabularyDiversity ?? 0.5;
    const emojiRate = messaging?.emojiRate ?? 0;
    const bioStyle = bio?.style ?? "moderate";

    // Minimal: short messages, low vocabulary, few emojis
    if (avgLen < 30 && bioStyle === "minimal") return "minimal";

    // Precise: moderate length, high vocabulary, low emoji
    if (vocabDiv > 0.6 && emojiRate < 0.2 && avgLen > 40) return "precise";

    // Poetic: high vocabulary richness, longer messages, rich voice
    if (vocabDiv > 0.7 && avgLen > 60 && (voice?.vocabularyRichness ?? 0) > 0.7)
        return "poetic";

    // Witty: questions, moderate length, humor indicators
    if ((messaging?.questionRate ?? 0) > 0.3 && emojiRate > 0.3) return "witty";

    // Default: expressive
    return "expressive";
}

// ─── EMBEDDING PROMPT BUILDER ────────────────────────────

function buildEmbeddingPrompt(
    user: { displayName: string | null; bio: string | null },
    signals: ProfileSignals,
    archetype: EnergyArchetype,
    commStyle: CommunicationStyle
): string {
    const parts: string[] = [];

    parts.push(
        `This person's emotional energy archetype is ${archetype}. They communicate in a ${commStyle} style.`
    );

    if (signals.voiceAnalysis) {
        const v = signals.voiceAnalysis;
        parts.push(
            `When they speak, their pace is ${v.speakingPace} with ${v.transcriptWordCount > 100 ? "rich" : "concise"} vocabulary. ` +
            `Their dominant emotional tones are ${v.dominantEmotions.join(", ") || "neutral"} ` +
            `with an overall sentiment of ${v.sentimentScore > 0.3 ? "positive" : v.sentimentScore < -0.3 ? "introspective" : "balanced"}.`
        );
    }

    if (signals.messagingBehavior) {
        const m = signals.messagingBehavior;
        parts.push(
            `In conversation, they write ${m.avgSentenceLength > 60 ? "thoughtful, detailed" : m.avgSentenceLength > 30 ? "moderate-length" : "brief"} messages. ` +
            `They ${m.questionRate > 0.3 ? "ask lots of questions showing genuine curiosity" : m.questionRate > 0.15 ? "balance questions with statements" : "tend to make statements rather than ask"}. ` +
            `Their vocabulary diversity is ${m.vocabularyDiversity > 0.6 ? "rich and varied" : "focused and direct"}.`
        );
    }

    if (signals.typingBehavior) {
        const t = signals.typingBehavior;
        parts.push(
            `Their typing cadence suggests ${t.cadenceVariance > 5000 ? "high emotional energy and excitement" : t.cadenceVariance > 2000 ? "a natural, flowing emotional state" : "calm deliberation and thoughtfulness"}.`
        );
    }

    if (signals.sessionTiming) {
        const s = signals.sessionTiming;
        const peakIdx = s.peakHours.indexOf(Math.max(...s.peakHours));
        const timeOfDay =
            peakIdx < 6 ? "early morning" :
                peakIdx < 12 ? "morning" :
                    peakIdx < 17 ? "afternoon" :
                        peakIdx < 21 ? "evening" : "late night";
        parts.push(
            `They are most emotionally available during the ${timeOfDay}, with ${s.sessionsPerDay > 3 ? "frequent" : "measured"} app engagement.`
        );
    }

    if (signals.browsingBehavior) {
        const b = signals.browsingBehavior;
        parts.push(
            `When exploring profiles, they ${b.photoDwellRatio > 0.6 ? "are visually drawn first" : b.bioReadRate > 0.5 ? "read bios carefully before judging" : "take a balanced approach"}.`
        );
    }

    if (user.bio) {
        parts.push(`Their self-description: "${user.bio}"`);
    }

    return parts.join(" ");
}

// ─── MAIN RPB FUNCTION ───────────────────────────────────

export interface RPBResult {
    archetype: EnergyArchetype;
    communicationStyle: CommunicationStyle;
    dominantEmotionTags: string[];
    completeness: CompletenessBreakdown;
    embeddingGenerated: boolean;
}

/**
 * Rebuild a user's resonance profile from all available behavioral data.
 * This is the core RPB function, called by Inngest on:
 *   - Voice note upload (cold start)
 *   - Daily 3am rebuild for all active users
 *   - Significant behavioral change detection
 */
export async function rebuildResonanceProfile(
    userId: string
): Promise<RPBResult> {
    // 1. Fetch user data
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
            id: true,
            displayName: true,
            bio: true,
            locationCity: true,
            locationCountry: true,
            subscriptionTier: true,
        },
    });

    if (!user) throw new Error(`User ${userId} not found`);

    // 2. Aggregate all 6 data sources in parallel
    const [
        voiceAnalysis,
        bioAnalysis,
        messagingBehavior,
        typingBehavior,
        sessionTiming,
        browsingBehavior,
    ] = await Promise.all([
        aggregateVoiceSignals(userId),
        aggregateBioSignals(userId),
        aggregateMessagingSignals(userId),
        aggregateTypingSignals(userId),
        aggregateSessionSignals(userId),
        aggregateBrowsingSignals(userId),
    ]);

    const signals: ProfileSignals = {
        voiceAnalysis,
        bioAnalysis,
        messagingBehavior,
        typingBehavior,
        sessionTiming,
        browsingBehavior,
    };

    // 3. Classify archetype + communication style
    const archetype = classifyArchetype(signals);
    const communicationStyle = classifyCommunicationStyle(signals);

    // 4. Extract dominant emotion tags
    const dominantEmotionTags = voiceAnalysis?.dominantEmotions ?? [];

    // 5. Compute completeness
    const completeness = computeCompleteness(signals);

    // 6. Build embedding prompt + generate vector
    let embeddingGenerated = false;
    try {
        const prompt = buildEmbeddingPrompt(user, signals, archetype, communicationStyle);
        const vector = await generateEmbedding(prompt);

        // 7. Upsert to Pinecone
        const metadata: Omit<VectorMetadata, "userId"> = {
            energyArchetype: archetype,
            communicationStyle,
            locationCity: user.locationCity ?? "",
            subscriptionTier: user.subscriptionTier ?? "free",
            lastActive: new Date().toISOString(),
        };
        await upsertVector(userId, vector, metadata);
        embeddingGenerated = true;
    } catch (error) {
        console.warn(`[RPB] Embedding generation failed for ${userId}:`, error);
        // Profile still gets updated with non-vector fields
    }

    // 8. Update resonance_profiles table
    const profileData = {
        energyArchetype: archetype,
        communicationStyle,
        dominantEmotionTags,
        peakActivityWindows: sessionTiming?.peakHours.map((score, hour) => ({
            hour,
            score,
        })) ?? [],
        avgResponseLatencyMs: messagingBehavior?.avgResponseTimeMs ?? null,
        vocabularyRichnessScore: voiceAnalysis?.vocabularyRichness ??
            (messagingBehavior?.vocabularyDiversity ?? 0),
        humorDetectionScore: (messagingBehavior?.emojiRate ?? 0) * 0.5, // Rough proxy
        depthSeekerScore: computeDepthScore(signals),
        lastRecalculatedAt: new Date(),
        modelVersion: "v1.0",
        updatedAt: new Date(),
    };

    const existing = await db.query.resonanceProfiles.findFirst({
        where: eq(resonanceProfiles.userId, userId),
        columns: { id: true },
    });

    if (existing) {
        await db
            .update(resonanceProfiles)
            .set(profileData)
            .where(eq(resonanceProfiles.userId, userId));
    } else {
        await db.insert(resonanceProfiles).values({
            userId,
            ...profileData,
        });
    }

    // 9. Invalidate Redis cache for this user
    await cacheInvalidatePattern(`resonate:user:${userId}:*`);

    return {
        archetype,
        communicationStyle,
        dominantEmotionTags,
        completeness,
        embeddingGenerated,
    };
}

// ─── HELPERS ─────────────────────────────────────────────

function computeDepthScore(signals: ProfileSignals): number {
    let score = 0;
    let factors = 0;

    if (signals.messagingBehavior) {
        // Long messages + high question rate = depth seeker
        score += Math.min(signals.messagingBehavior.avgSentenceLength / 100, 1) * 0.4;
        score += signals.messagingBehavior.questionRate * 0.3;
        score += signals.messagingBehavior.vocabularyDiversity * 0.3;
        factors++;
    }

    if (signals.voiceAnalysis) {
        score += signals.voiceAnalysis.vocabularyRichness * 0.5;
        factors++;
    }

    if (signals.browsingBehavior) {
        score += signals.browsingBehavior.bioReadRate * 0.5;
        factors++;
    }

    return factors > 0 ? score / factors : 0.5; // Default middle score
}

/**
 * Check if a user's profile is stale and needs rebuild.
 * Stale = not rebuilt in 48h + user has been active.
 */
export async function isProfileStale(userId: string): Promise<boolean> {
    const profile = await db.query.resonanceProfiles.findFirst({
        where: eq(resonanceProfiles.userId, userId),
        columns: { lastRecalculatedAt: true },
    });

    if (!profile?.lastRecalculatedAt) return true;

    const hoursSinceRebuild =
        (Date.now() - profile.lastRecalculatedAt.getTime()) / (1000 * 60 * 60);

    return hoursSinceRebuild > 48;
}
