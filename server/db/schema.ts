import {
    pgTable,
    uuid,
    text,
    varchar,
    timestamp,
    boolean,
    jsonb,
    integer,
    real,
    pgEnum,
    index,
    uniqueIndex,
    primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters";

// ═══════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════

export const genderIdentityEnum = pgEnum("gender_identity", [
    "man",
    "woman",
    "non_binary",
    "transgender",
    "genderqueer",
    "agender",
    "other",
    "prefer_not_to_say",
]);

export const verificationTierEnum = pgEnum("verification_tier", [
    "none",
    "phone",
    "id",
    "video",
]);

export const subscriptionTierEnum = pgEnum("subscription_tier", [
    "free",
    "plus",
    "premium",
]);

export const energyArchetypeEnum = pgEnum("energy_archetype", [
    "spark",
    "anchor",
    "wave",
    "ember",
    "storm",
]);

export const communicationStyleEnum = pgEnum("communication_style", [
    "expressive",
    "precise",
    "poetic",
    "minimal",
    "witty",
]);

// ═══════════════════════════════════════════════════
// USERS TABLE
// Auth.js requires: id, name, email, emailVerified, image
// ═══════════════════════════════════════════════════

export const users = pgTable(
    "users",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        // Auth.js required fields
        name: varchar("name", { length: 255 }),
        email: varchar("email", { length: 255 }).unique(),
        emailVerified: timestamp("emailVerified"),
        image: text("image"),
        // RESONATE-specific fields
        phone: varchar("phone", { length: 20 }).unique(),
        displayName: varchar("display_name", { length: 100 }),
        dateOfBirth: timestamp("date_of_birth"),
        genderIdentity: genderIdentityEnum("gender_identity"),
        pronouns: varchar("pronouns", { length: 50 }),
        seeking: jsonb("seeking").$type<string[]>().default([]),
        locationLat: real("location_lat"),
        locationLng: real("location_lng"),
        locationCity: varchar("location_city", { length: 100 }),
        locationCountry: varchar("location_country", { length: 100 }),
        profilePhotos: jsonb("profile_photos")
            .$type<
                {
                    url: string;
                    order: number;
                    isPrimary: boolean;
                    moderationStatus: "pending" | "approved" | "rejected";
                }[]
            >()
            .default([]),
        bio: text("bio"),
        voiceBioUrl: text("voice_bio_url"),
        videoIntroUrl: text("video_intro_url"),
        isVerified: boolean("is_verified").default(false),
        verificationTier: verificationTierEnum("verification_tier").default("none"),
        subscriptionTier: subscriptionTierEnum("subscription_tier").default("free"),
        onboardingComplete: boolean("onboarding_complete").default(false),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        lastActiveAt: timestamp("last_active_at").defaultNow().notNull(),
        deletedAt: timestamp("deleted_at"),
    },
    (table) => [
        index("idx_users_email").on(table.email),
        index("idx_users_location").on(table.locationLat, table.locationLng),
        index("idx_users_last_active").on(table.lastActiveAt),
        index("idx_users_gender_seeking").on(table.genderIdentity),
    ]
);

// ═══════════════════════════════════════════════════
// RESONANCE PROFILES TABLE
// ═══════════════════════════════════════════════════

export const resonanceProfiles = pgTable(
    "resonance_profiles",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        userId: uuid("user_id")
            .notNull()
            .unique()
            .references(() => users.id, { onDelete: "cascade" }),

        embeddingRef: varchar("embedding_ref", { length: 64 }),
        dominantEmotionTags: jsonb("dominant_emotion_tags")
            .$type<string[]>()
            .default([]),
        energyArchetype: energyArchetypeEnum("energy_archetype"),
        communicationStyle: communicationStyleEnum("communication_style"),
        peakActivityWindows: jsonb("peak_activity_windows")
            .$type<{ hour: number; score: number }[]>()
            .default([]),
        avgResponseLatencyMs: integer("avg_response_latency_ms"),
        vocabularyRichnessScore: real("vocabulary_richness_score"),
        humorDetectionScore: real("humor_detection_score"),
        depthSeekerScore: real("depth_seeker_score"),
        lastRecalculatedAt: timestamp("last_recalculated_at").defaultNow(),
        modelVersion: varchar("model_version", { length: 50 }).default("v1.0"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => [
        uniqueIndex("idx_resonance_user").on(table.userId),
        index("idx_resonance_archetype").on(table.energyArchetype),
        index("idx_resonance_style").on(table.communicationStyle),
    ]
);

// ═══════════════════════════════════════════════════
// AUTH.JS ADAPTER TABLES
// Column names MUST match Auth.js expectations exactly
// ═══════════════════════════════════════════════════

export const accounts = pgTable(
    "accounts",
    {
        userId: uuid("userId")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        type: varchar("type", { length: 255 }).$type<AdapterAccountType>().notNull(),
        provider: varchar("provider", { length: 255 }).notNull(),
        providerAccountId: varchar("providerAccountId", { length: 255 }).notNull(),
        refresh_token: text("refresh_token"),
        access_token: text("access_token"),
        expires_at: integer("expires_at"),
        token_type: varchar("token_type", { length: 255 }),
        scope: varchar("scope", { length: 255 }),
        id_token: text("id_token"),
        session_state: varchar("session_state", { length: 255 }),
    },
    (table) => [
        primaryKey({ columns: [table.provider, table.providerAccountId] }),
        index("idx_accounts_user").on(table.userId),
    ]
);

export const sessions = pgTable(
    "sessions",
    {
        sessionToken: varchar("sessionToken", { length: 255 }).primaryKey(),
        userId: uuid("userId")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        expires: timestamp("expires", { mode: "date" }).notNull(),
    },
    (table) => [index("idx_sessions_user").on(table.userId)]
);

export const verificationTokens = pgTable(
    "verification_tokens",
    {
        identifier: varchar("identifier", { length: 255 }).notNull(),
        token: varchar("token", { length: 255 }).notNull(),
        expires: timestamp("expires", { mode: "date" }).notNull(),
    },
    (table) => [
        primaryKey({ columns: [table.identifier, table.token] }),
    ]
);

// ═══════════════════════════════════════════════════
// RELATIONS
// ═══════════════════════════════════════════════════

export const usersRelations = relations(users, ({ one }) => ({
    resonanceProfile: one(resonanceProfiles, {
        fields: [users.id],
        references: [resonanceProfiles.userId],
    }),
}));

export const resonanceProfilesRelations = relations(
    resonanceProfiles,
    ({ one }) => ({
        user: one(users, {
            fields: [resonanceProfiles.userId],
            references: [users.id],
        }),
    })
);

export const accountsRelations = relations(accounts, ({ one }) => ({
    user: one(users, {
        fields: [accounts.userId],
        references: [users.id],
    }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
    user: one(users, {
        fields: [sessions.userId],
        references: [users.id],
    }),
}));
