import { Inngest } from "inngest";

// ─── Event Type Definitions ─────────────────────────────

type ResonateEvents = {
    "resonate/voice-note-uploaded": {
        data: { userId: string; audioUrl: string };
    };
    "resonate/photo-uploaded": {
        data: { userId: string; photoUrl: string; photoIndex: number };
    };
    "resonate/match-created": {
        data: { matchId: string; userAId: string; userBId: string };
    };
    "resonate/profile-rebuilt": {
        data: { userId: string };
    };
    "resonate/account-deleted": {
        data: { userId: string; email: string };
    };
    "resonate/behavioral-events-batch": {
        data: {
            userId: string;
            events: Array<{
                eventType: string;
                eventData: Record<string, unknown>;
                clientTs: string;
            }>;
        };
    };
};

// ─── Inngest Client ─────────────────────────────────────

export const inngest = new Inngest({
    id: "resonate",
    schemas: new Map() as never, // Type-safe events handled via generics
});

export type { ResonateEvents };
