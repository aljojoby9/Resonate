/**
 * Inngest Function: Conversation Health Monitor
 * Runs every 4 hours across all active conversations.
 */

import { inngest } from "@/inngest/client";
import { processAllConversations } from "@/lib/algorithms/chm";

export const monitorConversations = inngest.createFunction(
    {
        id: "conversation-health-monitor",
        name: "Conversation Health Monitor (4h)",
        retries: 2,
    },
    { cron: "0 */4 * * *" }, // Every 4 hours
    async ({ step }) => {
        const result = await step.run("process-conversations", async () => {
            return processAllConversations();
        });

        await step.run("log-results", async () => {
            console.log(
                `[CHM] Processed ${result.total} conversations: ` +
                `${result.healthy} healthy, ${result.cooling} cooling, ` +
                `${result.dormant} dormant, ${result.nudgesGenerated} nudges generated`
            );
        });

        return result;
    }
);
