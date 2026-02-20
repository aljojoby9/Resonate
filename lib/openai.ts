import OpenAI from "openai";

// ─── Singleton ───────────────────────────────────────────

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI {
    if (!openaiClient) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error("OPENAI_API_KEY is not set");
        }
        openaiClient = new OpenAI({ apiKey, maxRetries: 3 });
    }
    return openaiClient;
}

// ─── Token Usage Logging ────────────────────────────────

interface TokenUsageLog {
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number;
    timestamp: string;
}

const COST_PER_1M: Record<string, { input: number; output: number }> = {
    "text-embedding-3-large": { input: 0.13, output: 0 },
    "gpt-4o-mini": { input: 0.15, output: 0.6 },
};

function logUsage(log: TokenUsageLog) {
    if (process.env.NODE_ENV === "development") {
        console.log(
            `[OpenAI] ${log.model} | ${log.totalTokens} tokens | $${log.estimatedCost.toFixed(6)} | ${log.timestamp}`
        );
    }
}

function estimateCost(
    model: string,
    promptTokens: number,
    completionTokens: number
): number {
    const rates = COST_PER_1M[model];
    if (!rates) return 0;
    return (
        (promptTokens / 1_000_000) * rates.input +
        (completionTokens / 1_000_000) * rates.output
    );
}

// ─── Rate Limiting ──────────────────────────────────────

const RPM_LIMIT = 3000;
let callsThisMinute = 0;
let minuteStart = Date.now();

async function checkRateLimit(): Promise<void> {
    const now = Date.now();
    if (now - minuteStart > 60_000) {
        callsThisMinute = 0;
        minuteStart = now;
    }
    callsThisMinute++;
    if (callsThisMinute >= RPM_LIMIT) {
        const waitMs = 60_000 - (now - minuteStart);
        console.warn(`[OpenAI] Rate limit approaching, waiting ${waitMs}ms`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        callsThisMinute = 0;
        minuteStart = Date.now();
    }
}

// ─── Public API ─────────────────────────────────────────

/**
 * Generate a 1536-dimensional embedding from text.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    await checkRateLimit();
    const client = getClient();
    const model = "text-embedding-3-large";

    const response = await client.embeddings.create({
        model,
        input: text,
        dimensions: 1536,
    });

    const usage = response.usage;
    logUsage({
        model,
        promptTokens: usage.prompt_tokens,
        completionTokens: 0,
        totalTokens: usage.total_tokens,
        estimatedCost: estimateCost(model, usage.prompt_tokens, 0),
        timestamp: new Date().toISOString(),
    });

    return response.data[0]!.embedding;
}

/**
 * Generate a text completion via gpt-4o-mini.
 */
export async function generateCompletion(
    systemPrompt: string,
    userPrompt: string
): Promise<string> {
    await checkRateLimit();
    const client = getClient();
    const model = "gpt-4o-mini";

    const response = await client.chat.completions.create({
        model,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
    });

    const usage = response.usage;
    if (usage) {
        logUsage({
            model,
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
            estimatedCost: estimateCost(
                model,
                usage.prompt_tokens,
                usage.completion_tokens
            ),
            timestamp: new Date().toISOString(),
        });
    }

    return response.choices[0]?.message?.content ?? "";
}

/**
 * Check if OpenAI is configured.
 */
export function isOpenAIReady(): boolean {
    return !!process.env.OPENAI_API_KEY;
}
