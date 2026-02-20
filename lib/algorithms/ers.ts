/**
 * EMOTIONAL RESONANCE SCORE (ERS)
 *
 * Takes two fully-built resonance profiles and computes a single
 * compatibility score from 5 weighted components + modifiers.
 *
 * Components:
 *   1. Vector cosine similarity (30%)
 *   2. Chronobiological overlap (15%)
 *   3. Communication style compatibility (20%)
 *   4. Depth differential (15%)
 *   5. Energy archetype complementarity (20%)
 *
 * Modifiers:
 *   - Geographic feasibility
 *   - Activity recency decay
 *   - Profile completeness penalty
 *   - Mutual interest boost
 */

import { eq, and } from "drizzle-orm";
import { db } from "@/server/db";
import { resonanceProfiles, users } from "@/server/db/schema";
import { cacheGet, cacheSet, cacheKey, TTL } from "@/lib/redis";

// ─── Types ───────────────────────────────────────────────

type EnergyArchetype = "spark" | "anchor" | "wave" | "ember" | "storm";
type CommunicationStyle = "expressive" | "precise" | "poetic" | "minimal" | "witty";

interface ResonanceProfile {
    userId: string;
    energyArchetype: EnergyArchetype | null;
    communicationStyle: CommunicationStyle | null;
    peakActivityWindows: Array<{ hour: number; score: number }>;
    depthSeekerScore: number;
    vocabularyRichnessScore: number;
    humorDetectionScore: number;
    lastRecalculatedAt: Date | null;
}

interface UserContext {
    locationLat: number | null;
    locationLng: number | null;
    lastActiveAt: Date;
    subscriptionTier: string | null;
}

export interface ERSResult {
    totalScore: number; // 0-100
    breakdown: ERSBreakdown;
    waveformData: WaveformData;
}

export interface ERSBreakdown {
    vectorSimilarity: number;
    chronobiologicalOverlap: number;
    communicationCompatibility: number;
    depthDifferential: number;
    archetypeComplementarity: number;
    modifiers: {
        geographic: number;
        recencyDecay: number;
        completeness: number;
        mutualInterest: number;
    };
}

export interface WaveformData {
    userAFrequencies: number[];
    userBFrequencies: number[];
    blendColor: string;
    resonanceIntensity: number;
}

// ─── COMPONENT 1: Vector Cosine Similarity (30%) ────────

function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += (a[i] ?? 0) * (b[i] ?? 0);
        normA += (a[i] ?? 0) * (a[i] ?? 0);
        normB += (b[i] ?? 0) * (b[i] ?? 0);
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
}

// ─── COMPONENT 2: Chronobiological Overlap (15%) ────────

function computeChronobiologicalOverlap(
    peakA: Array<{ hour: number; score: number }>,
    peakB: Array<{ hour: number; score: number }>
): number {
    if (peakA.length === 0 || peakB.length === 0) return 0.5; // Neutral if unknown

    // Build 24-slot arrays
    const arrA = new Array(24).fill(0) as number[];
    const arrB = new Array(24).fill(0) as number[];
    for (const p of peakA) arrA[p.hour] = p.score;
    for (const p of peakB) arrB[p.hour] = p.score;

    // Weighted overlap: sum of min(a, b) / sum of max(a, b)
    let overlapSum = 0;
    let maxSum = 0;
    for (let i = 0; i < 24; i++) {
        overlapSum += Math.min(arrA[i] ?? 0, arrB[i] ?? 0);
        maxSum += Math.max(arrA[i] ?? 0, arrB[i] ?? 0);
    }

    return maxSum === 0 ? 0.5 : overlapSum / maxSum;
}

// ─── COMPONENT 3: Communication Style Compatibility (20%) ─

const COMMUNICATION_COMPATIBILITY: Record<string, Record<string, number>> = {
    expressive: { expressive: 0.7, precise: 0.5, poetic: 0.9, minimal: 0.3, witty: 0.8 },
    precise: { expressive: 0.5, precise: 0.8, poetic: 0.6, minimal: 0.7, witty: 0.6 },
    poetic: { expressive: 0.9, precise: 0.6, poetic: 0.85, minimal: 0.3, witty: 0.7 },
    minimal: { expressive: 0.3, precise: 0.7, poetic: 0.3, minimal: 0.6, witty: 0.5 },
    witty: { expressive: 0.8, precise: 0.6, poetic: 0.7, minimal: 0.5, witty: 0.9 },
};

function computeCommunicationCompatibility(
    styleA: CommunicationStyle | null,
    styleB: CommunicationStyle | null
): number {
    if (!styleA || !styleB) return 0.5;
    return COMMUNICATION_COMPATIBILITY[styleA]?.[styleB] ?? 0.5;
}

// ─── COMPONENT 4: Depth Differential (15%) ──────────────

function computeDepthDifferential(
    depthA: number,
    depthB: number
): number {
    // Perfect match = both at same depth level
    // Score decreases as depth gap widens
    const gap = Math.abs(depthA - depthB);
    return Math.max(0, 1 - gap * 2); // Gap of 0.5 = score 0
}

// ─── COMPONENT 5: Archetype Complementarity (20%) ───────

const ARCHETYPE_AFFINITY: Record<string, Record<string, number>> = {
    spark: { spark: 0.6, anchor: 0.9, wave: 0.7, ember: 0.65, storm: 0.5 },
    anchor: { spark: 0.9, anchor: 0.7, wave: 0.8, ember: 0.85, storm: 0.6 },
    wave: { spark: 0.7, anchor: 0.8, wave: 0.85, ember: 0.75, storm: 0.55 },
    ember: { spark: 0.65, anchor: 0.85, wave: 0.75, ember: 0.7, storm: 0.5 },
    storm: { spark: 0.5, anchor: 0.6, wave: 0.55, ember: 0.5, storm: 0.4 },
};

// Hex colors per archetype for waveform visualization
const ARCHETYPE_COLORS: Record<string, string> = {
    spark: "#FFD700",   // Gold
    anchor: "#4A90D9",  // Steel blue
    wave: "#4AF7C4",    // Bio pulse green
    ember: "#FF6B35",   // Warm orange
    storm: "#C77DFF",   // Electric purple
};

function computeArchetypeComplementarity(
    archA: EnergyArchetype | null,
    archB: EnergyArchetype | null
): number {
    if (!archA || !archB) return 0.5;
    return ARCHETYPE_AFFINITY[archA]?.[archB] ?? 0.5;
}

// ─── MODIFIERS ──────────────────────────────────────────

function computeGeographicModifier(
    userA: UserContext,
    userB: UserContext
): number {
    if (!userA.locationLat || !userA.locationLng ||
        !userB.locationLat || !userB.locationLng) {
        return 1.0; // No penalty if location unknown
    }

    // Haversine distance in km
    const R = 6371;
    const dLat = (userB.locationLat - userA.locationLat) * Math.PI / 180;
    const dLng = (userB.locationLng - userA.locationLng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(userA.locationLat * Math.PI / 180) *
        Math.cos(userB.locationLat * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // Within 50km: no penalty, 50-200km: slight decay, >200km: heavier decay
    if (dist <= 50) return 1.0;
    if (dist <= 200) return 0.95 - (dist - 50) * 0.0005;
    return Math.max(0.7, 0.95 - (dist - 50) * 0.0005);
}

function computeRecencyDecay(
    userA: UserContext,
    userB: UserContext
): number {
    const now = Date.now();
    const aDays = (now - userA.lastActiveAt.getTime()) / (1000 * 60 * 60 * 24);
    const bDays = (now - userB.lastActiveAt.getTime()) / (1000 * 60 * 60 * 24);
    const maxDays = Math.max(aDays, bDays);

    // No decay within 3 days, gradual decay up to 7 days, heavy after
    if (maxDays <= 3) return 1.0;
    if (maxDays <= 7) return 1.0 - (maxDays - 3) * 0.05;
    return Math.max(0.6, 0.8 - (maxDays - 7) * 0.03);
}

function computeCompletenessModifier(
    profileA: ResonanceProfile,
    profileB: ResonanceProfile
): number {
    // Both profiles need at least basic data
    const aHasData = profileA.energyArchetype !== null;
    const bHasData = profileB.energyArchetype !== null;

    if (!aHasData || !bHasData) return 0.5; // Heavy penalty for missing profiles
    return 1.0;
}

// ─── WAVEFORM DATA GENERATOR ────────────────────────────

function generateWaveformData(
    profileA: ResonanceProfile,
    profileB: ResonanceProfile,
    resonanceIntensity: number
): WaveformData {
    // Generate frequency arrays for visualization
    // Each user gets 64 frequency bins representing their emotional "sound"
    const bins = 64;
    const freqA: number[] = [];
    const freqB: number[] = [];

    for (let i = 0; i < bins; i++) {
        // Base frequencies shaped by archetype characteristics
        const phase = (i / bins) * Math.PI * 4;
        const archFactorA = getArchetypeFreqFactor(profileA.energyArchetype, i, bins);
        const archFactorB = getArchetypeFreqFactor(profileB.energyArchetype, i, bins);

        freqA.push(
            Math.abs(Math.sin(phase + profileA.depthSeekerScore * 3) * archFactorA)
        );
        freqB.push(
            Math.abs(Math.sin(phase + profileB.depthSeekerScore * 3 + 0.5) * archFactorB)
        );
    }

    // Blend color from both archetype colors
    const colorA = ARCHETYPE_COLORS[profileA.energyArchetype ?? "wave"] ?? "#4AF7C4";
    const colorB = ARCHETYPE_COLORS[profileB.energyArchetype ?? "wave"] ?? "#4AF7C4";
    const blendColor = blendHexColors(colorA, colorB);

    return {
        userAFrequencies: freqA,
        userBFrequencies: freqB,
        blendColor,
        resonanceIntensity,
    };
}

function getArchetypeFreqFactor(
    archetype: EnergyArchetype | null,
    bin: number,
    totalBins: number
): number {
    const pos = bin / totalBins;
    switch (archetype) {
        case "spark": return 0.8 + Math.sin(pos * Math.PI * 6) * 0.4; // Spiky
        case "anchor": return 0.6 + Math.cos(pos * Math.PI * 2) * 0.2; // Smooth
        case "wave": return 0.7 + Math.sin(pos * Math.PI * 3) * 0.3; // Flowing
        case "ember": return 0.5 + Math.sin(pos * Math.PI * 4) * 0.25; // Warm pulse
        case "storm": return 0.9 + Math.random() * 0.3; // Chaotic
        default: return 0.7;
    }
}

function blendHexColors(a: string, b: string): string {
    const parseHex = (hex: string) => {
        const h = hex.replace("#", "");
        return {
            r: parseInt(h.substring(0, 2), 16),
            g: parseInt(h.substring(2, 4), 16),
            b: parseInt(h.substring(4, 6), 16),
        };
    };
    const cA = parseHex(a);
    const cB = parseHex(b);
    const blend = {
        r: Math.round((cA.r + cB.r) / 2),
        g: Math.round((cA.g + cB.g) / 2),
        b: Math.round((cA.b + cB.b) / 2),
    };
    return `#${blend.r.toString(16).padStart(2, "0")}${blend.g.toString(16).padStart(2, "0")}${blend.b.toString(16).padStart(2, "0")}`;
}

// ─── MAIN ERS FUNCTION ──────────────────────────────────

/**
 * Compute the Emotional Resonance Score between two users.
 * Uses Redis caching (1h TTL), invalidated when either profile rebuilds.
 */
export async function computeERS(
    userAId: string,
    userBId: string,
    vectorSimOverride?: number // From Pinecone ANN query (pre-computed)
): Promise<ERSResult> {
    // Check cache first
    const sortedIds = [userAId, userBId].sort();
    const cacheKeyStr = cacheKey("ers", `${sortedIds[0]}:${sortedIds[1]}`, "score");

    const cached = await cacheGet<ERSResult>(cacheKeyStr);
    if (cached) return cached;

    // Fetch both profiles
    const [profileA, profileB] = await Promise.all([
        getResonanceProfile(userAId),
        getResonanceProfile(userBId),
    ]);

    if (!profileA || !profileB) {
        throw new Error("Both users must have resonance profiles");
    }

    // Fetch user context for modifiers
    const [userA, userB] = await Promise.all([
        getUserContext(userAId),
        getUserContext(userBId),
    ]);

    if (!userA || !userB) {
        throw new Error("Both users must exist");
    }

    // ─── Component Scores ─────────────────────────────

    // 1. Vector similarity (from Pinecone or computed)
    const vectorSim = vectorSimOverride ?? 0.5;

    // 2. Chronobiological overlap
    const chronoOverlap = computeChronobiologicalOverlap(
        profileA.peakActivityWindows ?? [],
        profileB.peakActivityWindows ?? []
    );

    // 3. Communication compatibility
    const commCompat = computeCommunicationCompatibility(
        profileA.communicationStyle as CommunicationStyle | null,
        profileB.communicationStyle as CommunicationStyle | null
    );

    // 4. Depth differential
    const depthDiff = computeDepthDifferential(
        profileA.depthSeekerScore,
        profileB.depthSeekerScore
    );

    // 5. Archetype complementarity
    const archCompat = computeArchetypeComplementarity(
        profileA.energyArchetype as EnergyArchetype | null,
        profileB.energyArchetype as EnergyArchetype | null
    );

    // ─── Weighted Base Score ──────────────────────────

    const baseScore =
        vectorSim * 30 +
        chronoOverlap * 15 +
        commCompat * 20 +
        depthDiff * 15 +
        archCompat * 20;

    // ─── Modifiers ────────────────────────────────────

    const geographic = computeGeographicModifier(userA, userB);
    const recencyDecay = computeRecencyDecay(userA, userB);
    const completeness = computeCompletenessModifier(profileA, profileB);
    const mutualInterest = 1.0; // Computed from match history, default neutral

    const finalScore = Math.round(
        Math.min(100, Math.max(0, baseScore * geographic * recencyDecay * completeness * mutualInterest))
    );

    // ─── Result ───────────────────────────────────────

    const breakdown: ERSBreakdown = {
        vectorSimilarity: Math.round(vectorSim * 100),
        chronobiologicalOverlap: Math.round(chronoOverlap * 100),
        communicationCompatibility: Math.round(commCompat * 100),
        depthDifferential: Math.round(depthDiff * 100),
        archetypeComplementarity: Math.round(archCompat * 100),
        modifiers: {
            geographic: Math.round(geographic * 100),
            recencyDecay: Math.round(recencyDecay * 100),
            completeness: Math.round(completeness * 100),
            mutualInterest: Math.round(mutualInterest * 100),
        },
    };

    const waveformData = generateWaveformData(
        profileA,
        profileB,
        finalScore / 100
    );

    const result: ERSResult = {
        totalScore: finalScore,
        breakdown,
        waveformData,
    };

    // Cache for 1 hour
    await cacheSet(cacheKeyStr, result, TTL.ERS_SCORE);

    return result;
}

// ─── DATA FETCHERS ──────────────────────────────────────

async function getResonanceProfile(userId: string): Promise<ResonanceProfile | null> {
    const profile = await db.query.resonanceProfiles.findFirst({
        where: eq(resonanceProfiles.userId, userId),
    });

    if (!profile) return null;

    return {
        userId: profile.userId,
        energyArchetype: profile.energyArchetype as EnergyArchetype | null,
        communicationStyle: profile.communicationStyle as CommunicationStyle | null,
        peakActivityWindows: (profile.peakActivityWindows as Array<{ hour: number; score: number }>) ?? [],
        depthSeekerScore: profile.depthSeekerScore ?? 0.5,
        vocabularyRichnessScore: profile.vocabularyRichnessScore ?? 0.5,
        humorDetectionScore: profile.humorDetectionScore ?? 0.5,
        lastRecalculatedAt: profile.lastRecalculatedAt,
    };
}

async function getUserContext(userId: string): Promise<UserContext | null> {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
            locationLat: true,
            locationLng: true,
            lastActiveAt: true,
            subscriptionTier: true,
        },
    });

    if (!user) return null;

    return {
        locationLat: user.locationLat,
        locationLng: user.locationLng,
        lastActiveAt: user.lastActiveAt,
        subscriptionTier: user.subscriptionTier,
    };
}

// ─── EXPORTS ────────────────────────────────────────────

export {
    ARCHETYPE_AFFINITY,
    ARCHETYPE_COLORS,
    COMMUNICATION_COMPATIBILITY,
    cosineSimilarity,
};
