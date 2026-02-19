import { initTRPC, TRPCError } from "@trpc/server";
import { auth } from "@/auth";
import { db } from "@/server/db";
import superjson from "superjson";

/**
 * tRPC context — provides session and DB access to all procedures
 */
export const createTRPCContext = async () => {
    const session = await auth();
    return {
        session,
        db,
    };
};

type Context = Awaited<ReturnType<typeof createTRPCContext>>;

/**
 * Initialize tRPC — this should only be done once per app
 */
const t = initTRPC.context<Context>().create({
    transformer: superjson,
});
const enforceAuth = t.middleware(({ ctx, next }) => {
    if (!ctx.session?.user) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({
        ctx: {
            session: { ...ctx.session, user: ctx.session.user },
        },
    });
});

/**
 * Public (unauthenticated) procedure
 */
export const publicProcedure = t.procedure;

/**
 * Protected (authenticated) procedure
 */
export const protectedProcedure = t.procedure.use(enforceAuth);

/**
 * Router factory
 */
export const router = t.router;
