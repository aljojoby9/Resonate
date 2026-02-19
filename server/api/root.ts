import { router, publicProcedure, protectedProcedure } from "@/server/api/trpc";
import { usersRouter } from "@/server/api/routers/users";

/**
 * App Router — Root tRPC router
 * All sub-routers will be merged here as they're built
 */
export const appRouter = router({
    // Health check — public
    healthCheck: publicProcedure.query(() => {
        return { status: "ok", timestamp: new Date().toISOString() };
    }),

    // Session info — protected
    getSession: protectedProcedure.query(({ ctx }) => {
        return ctx.session;
    }),

    // Users domain
    users: usersRouter,
});

export type AppRouter = typeof appRouter;
