import { z } from "zod";
import { router, protectedProcedure } from "@/server/api/trpc";
import { getDiscoveryFeed } from "@/lib/algorithms/dfre";

export const feedRouter = router({
    /**
     * Get the discovery feed for the current user.
     * Returns ranked, diversity-injected profiles with pagination.
     */
    discover: protectedProcedure
        .input(
            z.object({
                cursor: z.string().optional(),
                limit: z.number().min(1).max(50).optional(),
            }).optional()
        )
        .query(async ({ ctx, input }) => {
            const result = await getDiscoveryFeed(ctx.session.user.id, {
                cursor: input?.cursor,
                limit: input?.limit,
            });

            return {
                profiles: result.profiles.map((p) => ({
                    userId: p.userId,
                    finalScore: p.finalScore,
                    archetype: p.archetype,
                    waveformData: p.ersResult?.waveformData ?? null,
                    resonanceScore: p.ersResult?.totalScore ?? null,
                })),
                cursor: result.cursor,
                total: result.totalCandidates,
            };
        }),
});
