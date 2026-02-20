/**
 * Inngest Functions Registry
 *
 * All Inngest functions are imported and registered here.
 * The serve endpoint reads from this array.
 */

import {
    rebuildProfileOnVoiceNote,
    rebuildAllProfilesDaily,
} from "./rebuild-profile";

// Stubs — filled in as algorithms are implemented
// import { moderatePhoto } from "./moderate-photo";
// import { processMatch } from "./process-match";
// import { monitorConversations } from "./conversation-health";
// import { subscriptionWarnings } from "./subscription-warnings";
// import { accountDeletion } from "./account-deletion";

export const functions = [
    rebuildProfileOnVoiceNote,
    rebuildAllProfilesDaily,
    // moderatePhoto,
    // processMatch,
    // monitorConversations,
    // subscriptionWarnings,
    // accountDeletion,
];
