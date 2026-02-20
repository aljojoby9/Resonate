import { Pinecone } from "@pinecone-database/pinecone";

// ─── Types ───────────────────────────────────────────────

export interface VectorMetadata {
    userId: string;
    energyArchetype?: string;
    communicationStyle?: string;
    locationCity?: string;
    subscriptionTier?: string;
    lastActive?: string; // ISO timestamp
    ageRange?: string; // e.g. "25-30"
}

// ─── Singleton ───────────────────────────────────────────

let pineconeClient: Pinecone | null = null;

function getClient(): Pinecone {
    if (!pineconeClient) {
        const apiKey = process.env.PINECONE_API_KEY;
        if (!apiKey) {
            throw new Error("PINECONE_API_KEY is not set");
        }
        pineconeClient = new Pinecone({ apiKey });
    }
    return pineconeClient;
}

const INDEX_NAME = process.env.PINECONE_INDEX ?? "resonate-embeddings";
const DIMENSIONS = 1536;

function getIndex() {
    return getClient().index(INDEX_NAME);
}

// ─── Helpers ─────────────────────────────────────────────

/**
 * Upsert a user's emotional frequency vector into Pinecone.
 */
export async function upsertVector(
    userId: string,
    vector: number[],
    metadata: Omit<VectorMetadata, "userId">
) {
    const index = getIndex();
    await index.upsert({
        records: [{
            id: userId,
            values: vector,
            metadata: { userId, ...metadata } as Record<string, string>,
        }],
    });
}

/**
 * Query nearest vectors (ANN search) with optional metadata filters.
 */
export async function queryNearest(
    vector: number[],
    topK: number = 500,
    filter?: Record<string, unknown>
) {
    const index = getIndex();
    const result = await index.query({
        vector,
        topK,
        includeMetadata: true,
        ...(filter ? { filter } : {}),
    });
    return result.matches ?? [];
}

/**
 * Delete a user's vector from Pinecone (account deletion).
 */
export async function deleteVector(userId: string) {
    const index = getIndex();
    await index.deleteMany([userId]);
}

/**
 * Check if Pinecone is configured and reachable.
 */
export async function isPineconeReady(): Promise<boolean> {
    try {
        if (!process.env.PINECONE_API_KEY) return false;
        const client = getClient();
        await client.listIndexes();
        return true;
    } catch {
        return false;
    }
}

export { DIMENSIONS, INDEX_NAME };
