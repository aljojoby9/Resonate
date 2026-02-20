/**
 * Inngest Function: Rebuild Resonance Profile
 *
 * Triggered by:
 *   1. "resonate/voice-note-uploaded" — cold start after onboarding
 *   2. Scheduled daily at 3am UTC — rebuild all active users
 *
 * Steps:
 *   1. Retrieve user + behavioral events
 *   2. Run RPB aggregation + classification
 *   3. Generate embedding + upsert Pinecone
 *   4. Update resonance_profiles table
 *   5. Invalidate Redis cache
 */

import { inngest } from "@/inngest/client";
import {
    rebuildResonanceProfile,
    isProfileStale,
} from "@/lib/algorithms/rpb";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { sql } from "drizzle-orm";

// ─── Event-Triggered: Voice Note Upload (Cold Start) ────

export const rebuildProfileOnVoiceNote = inngest.createFunction(
    {
        id: "rebuild-profile-voice-note",
        name: "Rebuild Profile on Voice Note Upload",
        retries: 3,
    },
    { event: "resonate/voice-note-uploaded" },
    async ({ event, step }) => {
        const userId = event.data.userId;

        const result = await step.run("rebuild-profile", async () => {
            return rebuildResonanceProfile(userId);
        });

        await step.run("log-result", async () => {
            console.log(
                `[RPB] Cold start profile built for ${userId}: ` +
                `archetype=${result.archetype}, ` +
                `style=${result.communicationStyle}, ` +
                `completeness=${result.completeness.total}%, ` +
                `embedding=${result.embeddingGenerated ? "✓" : "✗"}`
            );
        });

        return result;
    }
);

// ─── Scheduled: Daily Rebuild for All Active Users ──────

export const rebuildAllProfilesDaily = inngest.createFunction(
    {
        id: "rebuild-all-profiles-daily",
        name: "Daily Profile Rebuild (3am UTC)",
        retries: 2,
    },
    { cron: "0 3 * * *" }, // Every day at 3am UTC
    async ({ step }) => {
        // Step 1: Get all active users (active in last 7 days)
        const activeUsers = await step.run("get-active-users", async () => {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const result = await db.query.users.findMany({
                where: sql`${users.lastActiveAt} > ${sevenDaysAgo} AND ${users.deletedAt} IS NULL AND ${users.onboardingComplete} = true`,
                columns: { id: true },
            });

            return result.map((u) => u.id);
        });

        // Step 2: Rebuild each user's profile (batched)
        let rebuilt = 0;
        let skipped = 0;
        let failed = 0;

        for (const userId of activeUsers) {
            await step.run(`rebuild-${userId}`, async () => {
                try {
                    // Skip if profile is fresh (rebuilt within last 24h by event trigger)
                    const stale = await isProfileStale(userId);
                    if (!stale) {
                        skipped++;
                        return;
                    }

                    await rebuildResonanceProfile(userId);
                    rebuilt++;
                } catch (error) {
                    console.error(`[RPB] Daily rebuild failed for ${userId}:`, error);
                    failed++;
                }
            });
        }

        return {
            totalActive: activeUsers.length,
            rebuilt,
            skipped,
            failed,
        };
    }
);
