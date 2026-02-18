import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { v4 as uuidv4 } from "uuid";

/**
 * Seed script — inserts 5 fake users with resonance profiles
 *
 * Usage: npx tsx server/db/seed.ts
 * Requires DATABASE_URL in .env.local
 */

async function seed() {
    if (!process.env.DATABASE_URL) {
        console.error("❌ DATABASE_URL is not set. Add it to .env.local first.");
        process.exit(1);
    }

    const sql = neon(process.env.DATABASE_URL);
    const db = drizzle(sql, { schema });

    console.log("🌊 Seeding RESONATE database...\n");

    const fakeUsers = [
        {
            id: uuidv4(),
            displayName: "Aria Voss",
            email: "aria@example.com",
            bio: "Midnight painter who thinks in color palettes. I find beauty in the spaces between words.",
            genderIdentity: "woman" as const,
            locationCity: "Brooklyn",
            locationCountry: "US",
            locationLat: 40.6782,
            locationLng: -73.9442,
            onboardingComplete: true,
        },
        {
            id: uuidv4(),
            displayName: "Kai Nakamura",
            email: "kai@example.com",
            bio: "Sound engineer by day, amateur astronomer by night. I measure the universe in frequencies.",
            genderIdentity: "man" as const,
            locationCity: "Tokyo",
            locationCountry: "JP",
            locationLat: 35.6762,
            locationLng: 139.6503,
            onboardingComplete: true,
        },
        {
            id: uuidv4(),
            displayName: "Sol Rivera",
            email: "sol@example.com",
            bio: "Neuroscience PhD student obsessed with how emotions create meaning. Overthinks everything, joyfully.",
            genderIdentity: "non_binary" as const,
            locationCity: "Barcelona",
            locationCountry: "ES",
            locationLat: 41.3874,
            locationLng: 2.1686,
            onboardingComplete: true,
        },
        {
            id: uuidv4(),
            displayName: "Mira Okafor",
            email: "mira@example.com",
            bio: "Documentary filmmaker exploring how strangers become lovers. My camera sees what people won't say.",
            genderIdentity: "woman" as const,
            locationCity: "Lagos",
            locationCountry: "NG",
            locationLat: 6.5244,
            locationLng: 3.3792,
            onboardingComplete: true,
        },
        {
            id: uuidv4(),
            displayName: "Ezra Fontaine",
            email: "ezra@example.com",
            bio: "Jazz pianist and startup founder. Building things that make people feel something.",
            genderIdentity: "man" as const,
            locationCity: "Montreal",
            locationCountry: "CA",
            locationLat: 45.5017,
            locationLng: -73.5673,
            onboardingComplete: true,
        },
    ];

    const resonanceData = [
        {
            dominantEmotionTags: ["curious", "calm", "introspective"],
            energyArchetype: "wave" as const,
            communicationStyle: "poetic" as const,
            vocabularyRichnessScore: 0.87,
            humorDetectionScore: 0.45,
            depthSeekerScore: 0.92,
            avgResponseLatencyMs: 45000,
            peakActivityWindows: [
                { hour: 22, score: 0.9 },
                { hour: 23, score: 0.85 },
                { hour: 0, score: 0.7 },
                { hour: 14, score: 0.5 },
            ],
        },
        {
            dominantEmotionTags: ["playful", "intense", "analytical"],
            energyArchetype: "spark" as const,
            communicationStyle: "precise" as const,
            vocabularyRichnessScore: 0.72,
            humorDetectionScore: 0.81,
            depthSeekerScore: 0.65,
            avgResponseLatencyMs: 12000,
            peakActivityWindows: [
                { hour: 9, score: 0.8 },
                { hour: 10, score: 0.9 },
                { hour: 21, score: 0.75 },
                { hour: 15, score: 0.6 },
            ],
        },
        {
            dominantEmotionTags: ["passionate", "curious", "warm"],
            energyArchetype: "ember" as const,
            communicationStyle: "expressive" as const,
            vocabularyRichnessScore: 0.91,
            humorDetectionScore: 0.67,
            depthSeekerScore: 0.88,
            avgResponseLatencyMs: 30000,
            peakActivityWindows: [
                { hour: 11, score: 0.7 },
                { hour: 16, score: 0.85 },
                { hour: 20, score: 0.95 },
                { hour: 21, score: 0.8 },
            ],
        },
        {
            dominantEmotionTags: ["bold", "empathetic", "restless"],
            energyArchetype: "storm" as const,
            communicationStyle: "expressive" as const,
            vocabularyRichnessScore: 0.78,
            humorDetectionScore: 0.73,
            depthSeekerScore: 0.55,
            avgResponseLatencyMs: 8000,
            peakActivityWindows: [
                { hour: 7, score: 0.6 },
                { hour: 13, score: 0.9 },
                { hour: 18, score: 0.85 },
                { hour: 22, score: 0.5 },
            ],
        },
        {
            dominantEmotionTags: ["joyful", "creative", "philosophical"],
            energyArchetype: "anchor" as const,
            communicationStyle: "witty" as const,
            vocabularyRichnessScore: 0.84,
            humorDetectionScore: 0.92,
            depthSeekerScore: 0.79,
            avgResponseLatencyMs: 20000,
            peakActivityWindows: [
                { hour: 10, score: 0.75 },
                { hour: 15, score: 0.65 },
                { hour: 19, score: 0.9 },
                { hour: 23, score: 0.8 },
            ],
        },
    ];

    // Insert users
    for (const user of fakeUsers) {
        await db.insert(schema.users).values(user).onConflictDoNothing();
        console.log(`  ✅ Created user: ${user.displayName}`);
    }

    // Insert resonance profiles
    for (let i = 0; i < fakeUsers.length; i++) {
        const user = fakeUsers[i]!;
        const resonance = resonanceData[i]!;

        await db
            .insert(schema.resonanceProfiles)
            .values({
                userId: user.id,
                ...resonance,
                modelVersion: "v1.0-seed",
            })
            .onConflictDoNothing();

        console.log(`  🌊 Created resonance profile for: ${user.displayName}`);
        console.log(
            `     Archetype: ${resonance.energyArchetype} | Style: ${resonance.communicationStyle}`
        );
        console.log(`     Emotions: [${resonance.dominantEmotionTags.join(", ")}]`);
    }

    console.log("\n🎉 Seed complete! 5 users with resonance profiles created.");
}

seed().catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
});
