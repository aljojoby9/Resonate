import { Redis } from "@upstash/redis";

// ─── Singleton ───────────────────────────────────────────

let redisClient: Redis | null = null;

function getClient(): Redis {
    if (!redisClient) {
        const url = process.env.UPSTASH_REDIS_REST_URL;
        const token = process.env.UPSTASH_REDIS_REST_TOKEN;
        if (!url || !token) {
            throw new Error(
                "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set"
            );
        }
        redisClient = new Redis({ url, token });
    }
    return redisClient;
}

// ─── TTL Constants (seconds) ────────────────────────────

export const TTL = {
    RESONANCE_PROFILE: 24 * 60 * 60, // 24 hours
    FEED_RESULTS: 3 * 60, // 3 minutes
    ERS_SCORE: 60 * 60, // 1 hour
    NUDGE: 0, // no TTL — until delivered
} as const;

// ─── Key Builder ────────────────────────────────────────
// Convention: resonate:{entity}:{id}:{data_type}

export function cacheKey(
    entity: string,
    id: string,
    dataType: string
): string {
    return `resonate:${entity}:${id}:${dataType}`;
}

// ─── Cache Operations ───────────────────────────────────

/**
 * Get a cached value. Returns null if not found.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
    try {
        const client = getClient();
        const value = await client.get<T>(key);
        return value;
    } catch (error) {
        console.warn(`[Redis] Cache get failed for ${key}:`, error);
        return null;
    }
}

/**
 * Set a cached value with TTL (in seconds). TTL of 0 means no expiry.
 */
export async function cacheSet(
    key: string,
    value: unknown,
    ttlSeconds: number
): Promise<void> {
    try {
        const client = getClient();
        if (ttlSeconds > 0) {
            await client.set(key, value, { ex: ttlSeconds });
        } else {
            await client.set(key, value);
        }
    } catch (error) {
        console.warn(`[Redis] Cache set failed for ${key}:`, error);
    }
}

/**
 * Delete a cached value.
 */
export async function cacheInvalidate(key: string): Promise<void> {
    try {
        const client = getClient();
        await client.del(key);
    } catch (error) {
        console.warn(`[Redis] Cache invalidate failed for ${key}:`, error);
    }
}

/**
 * Delete all keys matching a pattern (e.g. "resonate:user:abc123:*").
 * Uses SCAN to avoid blocking Redis.
 */
export async function cacheInvalidatePattern(pattern: string): Promise<void> {
    try {
        const client = getClient();
        let cursor = "0";
        do {
            const result = await client.scan(cursor, { match: pattern, count: 100 });
            cursor = result[0].toString();
            const keys = result[1] as string[];
            if (keys.length > 0) {
                for (const key of keys) {
                    await client.del(key);
                }
            }
        } while (cursor !== "0");
    } catch (error) {
        console.warn(`[Redis] Cache invalidate pattern failed for ${pattern}:`, error);
    }
}

// ─── Set Operations (for safety filtering) ──────────────

/**
 * Add members to a Redis set (used for blocks, passes, resonates).
 */
export async function setAdd(key: string, ...members: string[]): Promise<void> {
    try {
        const client = getClient();
        await client.sadd(key, ...members as [string, ...string[]]);
    } catch (error) {
        console.warn(`[Redis] Set add failed for ${key}:`, error);
    }
}

/**
 * Check if member exists in a Redis set.
 */
export async function setHas(key: string, member: string): Promise<boolean> {
    try {
        const client = getClient();
        const result = await client.sismember(key, member);
        return result === 1;
    } catch (error) {
        console.warn(`[Redis] Set has failed for ${key}:`, error);
        return false;
    }
}

/**
 * Get all members of a Redis set.
 */
export async function setMembers(key: string): Promise<string[]> {
    try {
        const client = getClient();
        return await client.smembers(key);
    } catch (error) {
        console.warn(`[Redis] Set members failed for ${key}:`, error);
        return [];
    }
}

/**
 * Check if Redis is configured and reachable.
 */
export async function isRedisReady(): Promise<boolean> {
    try {
        if (!process.env.UPSTASH_REDIS_REST_URL) return false;
        const client = getClient();
        await client.ping();
        return true;
    } catch {
        return false;
    }
}
