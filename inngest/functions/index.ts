/**
 * Inngest Functions Registry
 * All functions registered here are served at /api/inngest
 */

import {
    rebuildProfileOnVoiceNote,
    rebuildAllProfilesDaily,
} from "./rebuild-profile";
import { monitorConversations } from "./conversation-health";

export const functions = [
    // Layer 2: RPB
    rebuildProfileOnVoiceNote,
    rebuildAllProfilesDaily,

    // Layer 5: CHM
    monitorConversations,

    // Stubs — filled in Layer 6:
    // moderatePhoto,
    // processMatch,
    // subscriptionWarnings,
    // accountDeletion,
];
