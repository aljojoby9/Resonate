import { z } from "zod";
import { router, protectedProcedure } from "@/server/api/trpc";
import { behavioralEvents } from "@/server/db/schema";

const eventSchema = z.object({
    eventType: z.string(),
    eventData: z.record(z.string(), z.unknown()).optional(),
    clientTs: z.string(),
});

export const eventsRouter = router({
    /**
     * Batch track behavioral events.
     * Client buffers events and sends them every 30 seconds.
     */
    track: protectedProcedure
        .input(
            z.object({
                sessionId: z.string(),
                events: z.array(eventSchema).max(100),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const rows = input.events.map((event) => ({
                userId: ctx.session.user.id,
                sessionId: input.sessionId,
                eventType: event.eventType,
                eventData: event.eventData ?? null,
                clientTs: new Date(event.clientTs),
            }));

            if (rows.length > 0) {
                await ctx.db.insert(behavioralEvents).values(rows);
            }

            return { tracked: rows.length };
        }),
});
