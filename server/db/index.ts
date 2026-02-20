import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema/index";

/**
 * Database client using Neon serverless driver with Drizzle ORM.
 */
function createDb() {
    const url = process.env.DATABASE_URL;
    if (!url) {
        console.warn(
            "⚠️  DATABASE_URL is not set. Database operations will fail."
        );
        return null;
    }
    const sql = neon(url);
    return drizzle(sql, { schema });
}

export const db = createDb()!;

export type Database = NonNullable<ReturnType<typeof createDb>>;
