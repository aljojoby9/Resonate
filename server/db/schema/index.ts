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
import { relations, sql } from "drizzle-orm";
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

export const matchStateEnum = pgEnum("match_state", [
    "pending",
    "matched",
    "conversation_started",
    "dormant",
    "unmatched",
]);

export const contentTypeEnum = pgEnum("content_type", [
    "text",
    "image",
    "audio",
    "gif",
    "location_share",
]);

export const conversationStateEnum = pgEnum("conversation_state", [
    "active",
    "warming",
    "cooling",
    "dormant",
    "revived",
]);

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

export type Photo = {
    url: string;
    order: number;
    isPrimary: boolean;
    moderationStatus: "pending" | "approved" | "rejected";
};

export type ActivityWindow = {
    hour: number; // 0-23
    score: number; // 0-1
};

export type WaveformData = {
    userAFrequency: number[];
    userBFrequency: number[];
    convergenceMs: number;
    colorA: string;
    colorB: string;
    blendColor: string;
};

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
        profilePhotos: jsonb("profile_photos").$type<Photo[]>().default([]),
        bio: text("bio"),
        voiceBioUrl: text("voice_bio_url"),
        videoIntroUrl: text("video_intro_url"),
        isVerified: boolean("is_verified").default(false),
        verificationTier: verificationTierEnum("verification_tier").default("none"),
        subscriptionTier: subscriptionTierEnum("subscription_tier").default("free"),
        onboardingComplete: boolean("onboarding_complete").default(false),
        onboardingStep: integer("onboarding_step").default(0),
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
        dominantEmotionTags: jsonb("dominant_emotion_tags")
            .$type<string[]>()
            .default([]),
        energyArchetype: energyArchetypeEnum("energy_archetype"),
        communicationStyle: communicationStyleEnum("communication_style"),
        peakActivityWindows: jsonb("peak_activity_windows")
            .$type<ActivityWindow[]>()
            .default([]),
        avgResponseLatencyMs: integer("avg_response_latency_ms"),
        vocabularyRichnessScore: real("vocabulary_richness_score").default(0),
        humorDetectionScore: real("humor_detection_score").default(0),
        depthSeekerScore: real("depth_seeker_score").default(0),
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
// MATCHES TABLE
// ═══════════════════════════════════════════════════

export const matches = pgTable(
    "matches",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        userAId: uuid("user_a_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        userBId: uuid("user_b_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        resonanceScore: real("resonance_score"),
        frequencyConvergenceData: jsonb("frequency_convergence_data").$type<WaveformData>(),
        state: matchStateEnum("state").default("pending"),
        userALikedAt: timestamp("user_a_liked_at"),
        userBLikedAt: timestamp("user_b_liked_at"),
        matchedAt: timestamp("matched_at"),
        unmatchedAt: timestamp("unmatched_at"),
        unmatchedBy: uuid("unmatched_by"),
        conversationStartedAt: timestamp("conversation_started_at"),
    },
    (table) => [
        uniqueIndex("matches_unique_pair").on(table.userAId, table.userBId),
        index("matches_user_a_idx").on(table.userAId),
        index("matches_user_b_idx").on(table.userBId),
        index("matches_state_idx").on(table.state),
    ]
);

// ═══════════════════════════════════════════════════
// CONVERSATIONS TABLE
// ═══════════════════════════════════════════════════

export const conversations = pgTable(
    "conversations",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        matchId: uuid("match_id")
            .notNull()
            .references(() => matches.id, { onDelete: "cascade" }),
        lastMessageAt: timestamp("last_message_at"),
        healthState: conversationStateEnum("health_state").default("warming"),
        isArchivedByA: boolean("is_archived_by_a").default(false),
        isArchivedByB: boolean("is_archived_by_b").default(false),
        pendingNudge: text("pending_nudge"),
        nudgeGeneratedAt: timestamp("nudge_generated_at"),
    },
    (table) => [
        index("conversations_match_idx").on(table.matchId),
        index("conversations_last_message_idx").on(table.lastMessageAt),
    ]
);

// ═══════════════════════════════════════════════════
// MESSAGES TABLE
// ═══════════════════════════════════════════════════

export const messages = pgTable(
    "messages",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        conversationId: uuid("conversation_id")
            .notNull()
            .references(() => conversations.id, { onDelete: "cascade" }),
        senderId: uuid("sender_id").references(() => users.id, {
            onDelete: "set null",
        }),
        content: text("content").notNull(), // AES-256-GCM encrypted
        contentType: contentTypeEnum("content_type").default("text"),
        sentimentScore: real("sentiment_score"),
        emotionTag: text("emotion_tag"),
        sentAt: timestamp("sent_at").defaultNow(),
        readAt: timestamp("read_at"),
        deletedAt: timestamp("deleted_at"),
    },
    (table) => [
        index("messages_conversation_idx").on(table.conversationId),
        index("messages_sender_idx").on(table.senderId),
        index("messages_sent_at_idx").on(table.sentAt),
    ]
);

// ═══════════════════════════════════════════════════
// BEHAVIORAL EVENTS TABLE
// ═══════════════════════════════════════════════════

export const behavioralEvents = pgTable(
    "behavioral_events",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        sessionId: text("session_id").notNull(),
        eventType: text("event_type").notNull(),
        eventData: jsonb("event_data"),
        clientTs: timestamp("client_ts"),
        serverTs: timestamp("server_ts").defaultNow(),
    },
    (table) => [
        index("behavioral_user_idx").on(table.userId),
        index("behavioral_type_idx").on(table.eventType),
        index("behavioral_server_ts_idx").on(table.serverTs),
    ]
);

// ═══════════════════════════════════════════════════
// BLOCKS & REPORTS TABLE
// ═══════════════════════════════════════════════════

export const blocksReports = pgTable(
    "blocks_reports",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        reporterId: uuid("reporter_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        reportedId: uuid("reported_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        type: text("type").notNull(), // "block" | "report"
        reasonCode: text("reason_code"),
        details: text("details"),
        createdAt: timestamp("created_at").defaultNow(),
    },
    (table) => [
        index("blocks_reporter_idx").on(table.reporterId),
        index("blocks_reported_idx").on(table.reportedId),
    ]
);

// ═══════════════════════════════════════════════════
// SUBSCRIPTIONS TABLE
// ═══════════════════════════════════════════════════

export const subscriptions = pgTable(
    "subscriptions",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        userId: uuid("user_id")
            .notNull()
            .unique()
            .references(() => users.id, { onDelete: "cascade" }),
        stripeCustomerId: text("stripe_customer_id").unique(),
        stripeSubscriptionId: text("stripe_subscription_id").unique(),
        tier: subscriptionTierEnum("tier").default("free"),
        periodStart: timestamp("period_start"),
        periodEnd: timestamp("period_end"),
        status: text("status").default("active"),
        cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
    },
    (table) => [
        index("subscriptions_user_idx").on(table.userId),
        index("subscriptions_stripe_idx").on(table.stripeCustomerId),
    ]
);

// ═══════════════════════════════════════════════════
// AUTH.JS ADAPTER TABLES
// ═══════════════════════════════════════════════════

export const accounts = pgTable(
    "accounts",
    {
        userId: uuid("userId")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        type: varchar("type", { length: 255 })
            .$type<AdapterAccountType>()
            .notNull(),
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
    (table) => [primaryKey({ columns: [table.identifier, table.token] })]
);

// ═══════════════════════════════════════════════════
// RELATIONS
// ═══════════════════════════════════════════════════

export const usersRelations = relations(users, ({ one, many }) => ({
    resonanceProfile: one(resonanceProfiles, {
        fields: [users.id],
        references: [resonanceProfiles.userId],
    }),
    matchesAsA: many(matches, { relationName: "userA" }),
    matchesAsB: many(matches, { relationName: "userB" }),
    sentMessages: many(messages),
    behavioralEvents: many(behavioralEvents),
    subscription: one(subscriptions, {
        fields: [users.id],
        references: [subscriptions.userId],
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

export const matchesRelations = relations(matches, ({ one, many }) => ({
    userA: one(users, {
        fields: [matches.userAId],
        references: [users.id],
        relationName: "userA",
    }),
    userB: one(users, {
        fields: [matches.userBId],
        references: [users.id],
        relationName: "userB",
    }),
    conversation: one(conversations, {
        fields: [matches.id],
        references: [conversations.matchId],
    }),
}));

export const conversationsRelations = relations(
    conversations,
    ({ one, many }) => ({
        match: one(matches, {
            fields: [conversations.matchId],
            references: [matches.id],
        }),
        messages: many(messages),
    })
);

export const messagesRelations = relations(messages, ({ one }) => ({
    conversation: one(conversations, {
        fields: [messages.conversationId],
        references: [conversations.id],
    }),
    sender: one(users, {
        fields: [messages.senderId],
        references: [users.id],
    }),
}));

export const behavioralEventsRelations = relations(
    behavioralEvents,
    ({ one }) => ({
        user: one(users, {
            fields: [behavioralEvents.userId],
            references: [users.id],
        }),
    })
);

export const blocksReportsRelations = relations(blocksReports, ({ one }) => ({
    reporter: one(users, {
        fields: [blocksReports.reporterId],
        references: [users.id],
    }),
    reported: one(users, {
        fields: [blocksReports.reportedId],
        references: [users.id],
    }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
    user: one(users, {
        fields: [subscriptions.userId],
        references: [users.id],
    }),
}));

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
