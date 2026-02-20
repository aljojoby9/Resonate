/**
 * DYNAMIC FEED RANKING ENGINE (DFRE)
 *
 * Produces the ordered list of profiles shown in each user's discovery feed.
 * No Elo. No popularity bias. No rich-get-richer feedback loops.
 *
 * 5-Stage Pipeline:
 *   1. Candidate retrieval (Pinecone ANN, top 500)
 *   2. Safety filtering (blocks, passes, previous resonates)
 *   3. Soft scoring (ERS + freshness + diversity + ghost penalty + subscription)
 *   4. Diversity injection (≥20% archetype variety)
 *   5. Pagination + caching (30 per page, 3-min Redis cache)
 */

import { eq, and, or, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
    users,
    resonanceProfiles,
    matches,
    blocksReports,
} from "@/server/db/schema";
import { queryNearest } from "@/lib/pinecone";
import { computeERS, type ERSResult } from "@/lib/algorithms/ers";
import {
    cacheGet,
    cacheSet,
    cacheKey,
    TTL,
    setMembers,
} from "@/lib/redis";

// ─── Types ───────────────────────────────────────────────

interface FeedCandidate {
    userId: string;
    vectorScore: number; // From Pinecone ANN
    ersResult: ERSResult | null;
    freshness: number;
    ghostPenalty: number;
    diversityBonus: number;
    subscriptionBoost: number;
    finalScore: number;
    archetype: string | null;
}

interface FeedResult {
    profiles: FeedCandidate[];
    cursor: string | null;
    totalCandidates: number;
    debug?: {
        retrieved: number;
        afterSafety: number;
        archetyperDistribution: Record<string, number>;
    };
}

interface FeedOptions {
    cursor?: string | undefined;
    limit?: number | undefined;
}

const PAGE_SIZE = 30;

// ─── STAGE 1: Candidate Retrieval ───────────────────────

async function retrieveCandidates(
    userId: string,
    userProfile: {
        energyArchetype: string | null;
        communicationStyle: string | null;
    }
): Promise<Array<{ userId: string; score: number }>> {
    // Get user's vector from their profile to query Pinecone
    const profile = await db.query.resonanceProfiles.findFirst({
        where: eq(resonanceProfiles.userId, userId),
    });

    if (!profile) {
        // No profile yet — return empty
        return [];
    }

    // Query Pinecone for nearest 500 vectors
    // In production, we'd use the stored vector. For now, use metadata filters.
    try {
        // We need the user's own vector to do ANN search.
        // Since we store vectors in Pinecone keyed by userId, we'd normally
        // fetch the vector from Pinecone and use it for query. For now,
        // generate a dummy query that gets nearest matches.
        const results = await queryNearest(
            new Array(1536).fill(0), // Placeholder - replaced by actual user vector
            500,
            {
                userId: { $ne: userId }, // Exclude self
            }
        );

        return results.map((r) => ({
            userId: r.id,
            score: r.score ?? 0,
        }));
    } catch (error) {
        console.warn("[DFRE] Pinecone retrieval failed, using DB fallback:", error);
        return await dbFallbackCandidates(userId);
    }
}

async function dbFallbackCandidates(
    userId: string
): Promise<Array<{ userId: string; score: number }>> {
    // Fallback: get recent active users from DB
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const candidates = await db.query.users.findMany({
        where: and(
            sql`${users.id} != ${userId}`,
            gte(users.lastActiveAt, sevenDaysAgo),
            isNull(users.deletedAt),
            eq(users.onboardingComplete, true)
        ),
        columns: { id: true },
        limit: 500,
    });

    return candidates.map((c) => ({ userId: c.id, score: 0.5 }));
}

// ─── STAGE 2: Safety Filtering ──────────────────────────

async function filterSafety(
    userId: string,
    candidates: Array<{ userId: string; score: number }>
): Promise<Array<{ userId: string; score: number }>> {
    if (candidates.length === 0) return [];

    // Get all blocked/passed/resonated user IDs from Redis
    const [blockedIds, passedIds, resonatedIds, blockedByIds] = await Promise.all([
        setMembers(cacheKey("user", userId, "blocked")),
        setMembers(cacheKey("user", userId, "passed")),
        setMembers(cacheKey("user", userId, "resonated")),
        setMembers(cacheKey("user", userId, "blocked_by")),
    ]);

    // Also check DB for blocks (Redis may not have all data)
    const dbBlocks = await db.query.blocksReports.findMany({
        where: or(
            eq(blocksReports.reporterId, userId),
            eq(blocksReports.reportedId, userId)
        ),
        columns: { reporterId: true, reportedId: true },
    });

    const excludeSet = new Set([
        ...blockedIds,
        ...passedIds,
        ...resonatedIds,
        ...blockedByIds,
        ...dbBlocks.map((b) =>
            b.reporterId === userId ? b.reportedId : b.reporterId
        ),
    ]);

    return candidates.filter((c) => !excludeSet.has(c.userId));
}

// ─── STAGE 3: Soft Scoring ──────────────────────────────

const SCORING_WEIGHTS = {
    ers: 0.40,
    freshness: 0.15,
    diversity: 0.15,
    ghostPenalty: 0.15,
    subscription: 0.15,
} as const;

async function softScore(
    userId: string,
    candidates: Array<{ userId: string; score: number }>
): Promise<FeedCandidate[]> {
    // Pre-fetch all candidate profiles for efficiency
    const candidateIds = candidates.map((c) => c.userId);

    // Batch fetch profiles
    const profiles = await db.query.resonanceProfiles.findMany({
        where: sql`${resonanceProfiles.userId} IN (${sql.join(
            candidateIds.map((id) => sql`${id}`),
            sql`, `
        )})`,
    });
    const profileMap = new Map(profiles.map((p) => [p.userId, p]));

    // Batch fetch user data for freshness + subscription
    const userData = await db.query.users.findMany({
        where: sql`${users.id} IN (${sql.join(
            candidateIds.map((id) => sql`${id}`),
            sql`, `
        )})`,
        columns: {
            id: true,
            lastActiveAt: true,
            subscriptionTier: true,
        },
    });
    const userMap = new Map(userData.map((u) => [u.id, u]));

    // Compute ghost penalties
    const ghostPenalties = await computeGhostPenalties(candidateIds);

    // Score each candidate
    const scored: FeedCandidate[] = [];

    for (const candidate of candidates) {
        const profile = profileMap.get(candidate.userId);
        const user = userMap.get(candidate.userId);

        // Freshness: based on last active time
        const freshness = computeFreshness(user?.lastActiveAt ?? new Date(0));

        // Ghost penalty
        const ghostPenalty = ghostPenalties.get(candidate.userId) ?? 0;

        // Subscription boost
        const subscriptionBoost =
            user?.subscriptionTier === "premium" ? 0.1 :
                user?.subscriptionTier === "plus" ? 0.05 : 0;

        // ERS (computed on-demand, cached)
        let ersResult: ERSResult | null = null;
        try {
            ersResult = await computeERS(userId, candidate.userId, candidate.score);
        } catch {
            // Skip if ERS fails (missing profile etc.)
        }

        const ersScore = ersResult ? ersResult.totalScore / 100 : candidate.score;

        // Final weighted score
        const finalScore =
            ersScore * SCORING_WEIGHTS.ers +
            freshness * SCORING_WEIGHTS.freshness +
            0 * SCORING_WEIGHTS.diversity + // Applied in stage 4
            (1 - ghostPenalty) * SCORING_WEIGHTS.ghostPenalty +
            (1 + subscriptionBoost) * SCORING_WEIGHTS.subscription;

        scored.push({
            userId: candidate.userId,
            vectorScore: candidate.score,
            ersResult,
            freshness,
            ghostPenalty,
            diversityBonus: 0, // Set in stage 4
            subscriptionBoost,
            finalScore,
            archetype: profile?.energyArchetype ?? null,
        });
    }

    // Sort by final score descending
    scored.sort((a, b) => b.finalScore - a.finalScore);

    return scored;
}

function computeFreshness(lastActive: Date): number {
    const hoursSinceActive = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60);
    if (hoursSinceActive <= 1) return 1.0;
    if (hoursSinceActive <= 24) return 0.9;
    if (hoursSinceActive <= 72) return 0.7;
    return Math.max(0.3, 0.7 - (hoursSinceActive - 72) / 168);
}

async function computeGhostPenalties(
    userIds: string[]
): Promise<Map<string, number>> {
    const penalties = new Map<string, number>();

    // Ghost penalty: matches where user never sent a message
    for (const userId of userIds) {
        const userMatches = await db.query.matches.findMany({
            where: and(
                or(
                    eq(matches.userAId, userId),
                    eq(matches.userBId, userId)
                ),
                eq(matches.state, "matched")
            ),
            columns: {
                conversationStartedAt: true,
                matchedAt: true,
            },
            limit: 20,
        });

        if (userMatches.length === 0) {
            penalties.set(userId, 0);
            continue;
        }

        const ghosted = userMatches.filter(
            (m) => m.matchedAt && !m.conversationStartedAt
        ).length;
        const ghostRate = ghosted / userMatches.length;

        // Ghost penalty: 0 for perfect, up to 0.5 for chronic ghosters
        penalties.set(userId, Math.min(0.5, ghostRate * 0.7));
    }

    return penalties;
}

// ─── STAGE 4: Diversity Injection ───────────────────────

function injectDiversity(candidates: FeedCandidate[], limit: number): FeedCandidate[] {
    const top = candidates.slice(0, limit);
    if (top.length < 10) return top; // Not enough candidates to diversify

    // Count archetypes in top results
    const archetypeCounts = new Map<string, number>();
    for (const c of top) {
        const arch = c.archetype ?? "unknown";
        archetypeCounts.set(arch, (archetypeCounts.get(arch) ?? 0) + 1);
    }

    // Check if ≥20% are different archetypes
    const dominantArchetype = [...archetypeCounts.entries()]
        .sort(([, a], [, b]) => b - a)[0]?.[0];
    const dominantCount = archetypeCounts.get(dominantArchetype ?? "") ?? 0;
    const diverseCount = top.length - dominantCount;
    const diversityTarget = Math.ceil(limit * 0.2); // 20% = 6 out of 30

    if (diverseCount >= diversityTarget) return top; // Already diverse enough

    // Need to inject diversity — find different-archetype candidates from the overflow
    const overflow = candidates.slice(limit);
    const differentArchetypes = overflow.filter(
        (c) => c.archetype !== dominantArchetype && c.archetype !== null
    );

    // Replace lowest-scoring same-archetype entries with diverse ones
    const needed = diversityTarget - diverseCount;
    const sameSorted = top
        .filter((c) => c.archetype === dominantArchetype)
        .sort((a, b) => a.finalScore - b.finalScore); // Lowest first

    let replaced = 0;
    for (let i = 0; i < Math.min(needed, sameSorted.length, differentArchetypes.length); i++) {
        const toReplace = sameSorted[i];
        const replacement = differentArchetypes[i];
        if (toReplace && replacement) {
            const idx = top.indexOf(toReplace);
            if (idx !== -1) {
                replacement.diversityBonus = 0.1; // Mark as diversity-injected
                top[idx] = replacement;
                replaced++;
            }
        }
    }

    return top;
}

// ─── STAGE 5: Pagination + Caching ──────────────────────

/**
 * Get the discovery feed for a user.
 * Returns paginated, ranked, diversity-injected results.
 */
export async function getDiscoveryFeed(
    userId: string,
    options: FeedOptions = {}
): Promise<FeedResult> {
    const limit = options.limit ?? PAGE_SIZE;
    const cursorKey = cacheKey("user", userId, "feed_cursor");

    // Check for cached feed
    if (options.cursor) {
        const cached = await cacheGet<FeedResult>(
            cacheKey("user", userId, `feed_page_${options.cursor}`)
        );
        if (cached) return cached;
    }

    // Check for cached full ranked list
    const cachedRanked = await cacheGet<FeedCandidate[]>(
        cacheKey("user", userId, "feed_ranked")
    );

    let ranked: FeedCandidate[];

    if (cachedRanked) {
        ranked = cachedRanked;
    } else {
        // Full pipeline
        const userProfile = await db.query.resonanceProfiles.findFirst({
            where: eq(resonanceProfiles.userId, userId),
            columns: { energyArchetype: true, communicationStyle: true },
        });

        // Stage 1: Retrieve candidates
        const candidates = await retrieveCandidates(userId, {
            energyArchetype: userProfile?.energyArchetype ?? null,
            communicationStyle: userProfile?.communicationStyle ?? null,
        });

        // Stage 2: Safety filtering
        const safe = await filterSafety(userId, candidates);

        // Stage 3: Soft scoring
        ranked = await softScore(userId, safe);

        // Cache full ranked list for 3 minutes
        await cacheSet(
            cacheKey("user", userId, "feed_ranked"),
            ranked,
            TTL.FEED_RESULTS
        );
    }

    // Stage 4: Diversity injection on current page
    const cursorNum = options.cursor ? parseInt(options.cursor, 10) : 0;
    const pageStart = cursorNum * limit;
    const pageSlice = ranked.slice(pageStart, pageStart + limit + 10); // Extra for diversity
    const diversified = injectDiversity(pageSlice, limit);

    // Next cursor
    const hasMore = pageStart + limit < ranked.length;
    const nextCursor = hasMore ? String(cursorNum + 1) : null;

    // Build archetype distribution for debug
    const archDist: Record<string, number> = {};
    for (const c of diversified) {
        const arch = c.archetype ?? "unknown";
        archDist[arch] = (archDist[arch] ?? 0) + 1;
    }

    const result: FeedResult = {
        profiles: diversified.slice(0, limit),
        cursor: nextCursor,
        totalCandidates: ranked.length,
        debug: {
            retrieved: ranked.length,
            afterSafety: ranked.length,
            archetyperDistribution: archDist,
        },
    };

    // Cache this page
    if (nextCursor) {
        await cacheSet(
            cacheKey("user", userId, `feed_page_${cursorNum}`),
            result,
            TTL.FEED_RESULTS
        );
    }

    return result;
}
