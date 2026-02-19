import { z } from "zod";
import {
    router,
    protectedProcedure,
} from "@/server/api/trpc";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export const usersRouter = router({
    /**
     * getMe: Fetches the current user's profile
     */
    getMe: protectedProcedure.query(async ({ ctx }) => {
        return ctx.db.query.users.findFirst({
            where: eq(users.id, ctx.session.user.id),
            with: {
                resonanceProfile: true,
            },
        });
    }),

    /**
     * updateProfile: Updates the current user's profile
     */
    updateProfile: protectedProcedure
        .input(
            z.object({
                displayName: z.string().min(2).max(50).optional(),
                bio: z.string().max(500).optional(),
                pronouns: z.string().max(20).optional(),
                locationCity: z.string().optional(),
                locationCountry: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            await ctx.db
                .update(users)
                .set(input)
                .where(eq(users.id, ctx.session.user.id));
        }),

    /**
     * completeOnboarding: Marks the user as onboarding complete
     */
    completeOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
        await ctx.db
            .update(users)
            .set({ onboardingComplete: true })
            .where(eq(users.id, ctx.session.user.id));
    }),
});
