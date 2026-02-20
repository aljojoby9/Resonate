import {
    boolean,
    index,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    primaryKey,
    real,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    vector,
    varchar,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters";

export type Photo = {
    url: string;
    order: number;
    isPrimary: boolean;
    moderationStatus: "pending" | "approved" | "rejected";
};

export type ActivityWindow = {
    hour: number;
    score: number;
};

export type WaveformData = {
    userAFrequency: number[];
    userBFrequency: number[];
    convergenceMs: number;
    colorA: string;
    colorB: string;
    blendColor: string;
};

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

export const users = pgTable(
    "users",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        name: varchar("name", { length: 255 }),
        email: text("email").unique(),
        emailVerified: timestamp("emailVerified"),
        image: text("image"),
        phone: text("phone").unique(),
        displayName: text("display_name"),
        dateOfBirth: timestamp("date_of_birth"),
        genderIdentity: text("gender_identity"),
        pronouns: text("pronouns"),
        seeking: text("seeking").array().default(sql`'{}'::text[]`),
        locationLat: real("location_lat"),
        locationLng: real("location_lng"),
        locationCity: text("location_city"),
        locationCountry: text("location_country"),
        profilePhotos: jsonb("profile_photos")
            .$type<Photo[]>()
            .default(sql`'[]'::jsonb`),
        bio: text("bio"),
        voiceBioUrl: text("voice_bio_url"),
        videoIntroUrl: text("video_intro_url"),
        isVerified: boolean("is_verified").default(false),
        verificationTier: text("verification_tier").default("none"),
        subscriptionTier: subscriptionTierEnum("subscription_tier").default("free"),
        onboardingComplete: boolean("onboarding_complete").default(false),
        onboardingStep: integer("onboarding_step").default(0),
        createdAt: timestamp("created_at").defaultNow(),
        lastActiveAt: timestamp("last_active_at").defaultNow(),
        deletedAt: timestamp("deleted_at"),
    },
    (t) => ({
        emailIdx: index("users_email_idx").on(t.email),
        locationIdx: index("users_location_idx").on(t.locationLat, t.locationLng),
        activeIdx: index("users_active_idx")
            .on(t.lastActiveAt)
            .where(sql`deleted_at IS NULL`),
    })
);

export const resonanceProfiles = pgTable("resonance_profiles", {
    userId: uuid("user_id")
        .primaryKey()
        .references(() => users.id, { onDelete: "cascade" }),
    emotionalFrequencyVector: vector("emotional_frequency_vector", {
        dimensions: 1536,
    }),
    dominantEmotionTags: text("dominant_emotion_tags")
        .array()
        .default(sql`'{}'::text[]`),
    energyArchetype: energyArchetypeEnum("energy_archetype"),
    communicationStyle: communicationStyleEnum("communication_style"),
    peakActivityWindows: jsonb("peak_activity_windows")
        .$type<ActivityWindow[]>()
        .default(sql`'[]'::jsonb`),
    avgResponseLatencyMs: integer("avg_response_latency_ms"),
    vocabularyRichnessScore: real("vocabulary_richness_score").default(0),
    humorDetectionScore: real("humor_detection_score").default(0),
    depthSeekerScore: real("depth_seeker_score").default(0),
    lastRecalculatedAt: timestamp("last_recalculated_at"),
    modelVersion: text("model_version").default("v1"),
});

export const matches = pgTable(
    "matches",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userAId: uuid("user_a_id")
            .references(() => users.id, { onDelete: "cascade" })
            .notNull(),
        userBId: uuid("user_b_id")
            .references(() => users.id, { onDelete: "cascade" })
            .notNull(),
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
    (t) => ({
        uniquePair: uniqueIndex("matches_unique_pair").on(t.userAId, t.userBId),
        userAIdx: index("matches_user_a_idx").on(t.userAId),
        userBIdx: index("matches_user_b_idx").on(t.userBId),
        stateIdx: index("matches_state_idx").on(t.state),
    })
);

export const conversations = pgTable(
    "conversations",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        matchId: uuid("match_id")
            .references(() => matches.id, { onDelete: "cascade" })
            .notNull(),
        lastMessageAt: timestamp("last_message_at"),
        healthState: conversationStateEnum("health_state").default("warming"),
        isArchivedByA: boolean("is_archived_by_a").default(false),
        isArchivedByB: boolean("is_archived_by_b").default(false),
        pendingNudge: text("pending_nudge"),
        nudgeGeneratedAt: timestamp("nudge_generated_at"),
    },
    (t) => ({
        matchIdx: index("conversations_match_idx").on(t.matchId),
        lastMsgIdx: index("conversations_last_message_idx").on(t.lastMessageAt),
    })
);

export const messages = pgTable(
    "messages",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        conversationId: uuid("conversation_id")
            .references(() => conversations.id, { onDelete: "cascade" })
            .notNull(),
        senderId: uuid("sender_id").references(() => users.id, {
            onDelete: "set null",
        }),
        content: text("content").notNull(),
        contentType: contentTypeEnum("content_type").default("text"),
        sentimentScore: real("sentiment_score"),
        emotionTag: text("emotion_tag"),
        sentAt: timestamp("sent_at").defaultNow(),
        readAt: timestamp("read_at"),
        deletedAt: timestamp("deleted_at"),
    },
    (t) => ({
        convIdx: index("messages_conversation_idx").on(t.conversationId),
        senderIdx: index("messages_sender_idx").on(t.senderId),
        sentAtIdx: index("messages_sent_at_idx").on(t.sentAt),
    })
);

export const behavioralEvents = pgTable(
    "behavioral_events",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id")
            .references(() => users.id, { onDelete: "cascade" })
            .notNull(),
        sessionId: text("session_id").notNull(),
        eventType: text("event_type").notNull(),
        eventData: jsonb("event_data"),
        clientTs: timestamp("client_ts"),
        serverTs: timestamp("server_ts").defaultNow(),
    },
    (t) => ({
        userIdx: index("behavioral_user_idx").on(t.userId),
        typeIdx: index("behavioral_type_idx").on(t.eventType),
        serverIdx: index("behavioral_server_ts_idx").on(t.serverTs),
    })
);

export const blocksReports = pgTable(
    "blocks_reports",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        reporterId: uuid("reporter_id")
            .references(() => users.id, { onDelete: "cascade" })
            .notNull(),
        reportedId: uuid("reported_id")
            .references(() => users.id, { onDelete: "cascade" })
            .notNull(),
        type: text("type").notNull(),
        reasonCode: text("reason_code"),
        details: text("details"),
        createdAt: timestamp("created_at").defaultNow(),
    },
    (t) => ({
        reporterIdx: index("blocks_reporter_idx").on(t.reporterId),
        reportedIdx: index("blocks_reported_idx").on(t.reportedId),
        uniqueBlock: uniqueIndex("blocks_unique_pair")
            .on(t.reporterId, t.reportedId)
            .where(sql`type = 'block'`),
    })
);

export const subscriptions = pgTable(
    "subscriptions",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id")
            .references(() => users.id, { onDelete: "cascade" })
            .notNull()
            .unique(),
        stripeCustomerId: text("stripe_customer_id").unique(),
        stripeSubscriptionId: text("stripe_subscription_id").unique(),
        tier: subscriptionTierEnum("tier").default("free"),
        periodStart: timestamp("period_start"),
        periodEnd: timestamp("period_end"),
        status: text("status").default("active"),
        cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
    },
    (t) => ({
        userIdx: index("subscriptions_user_idx").on(t.userId),
        stripeIdx: index("subscriptions_stripe_idx").on(t.stripeCustomerId),
    })
);

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
    (t) => [
        primaryKey({ columns: [t.provider, t.providerAccountId] }),
        index("idx_accounts_user").on(t.userId),
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
    (t) => [index("idx_sessions_user").on(t.userId)]
);

export const verificationTokens = pgTable(
    "verification_tokens",
    {
        identifier: varchar("identifier", { length: 255 }).notNull(),
        token: varchar("token", { length: 255 }).notNull(),
        expires: timestamp("expires", { mode: "date" }).notNull(),
    },
    (t) => [primaryKey({ columns: [t.identifier, t.token] })]
);

export const usersRelations = relations(users, ({ one, many }) => ({
    resonanceProfile: one(resonanceProfiles, {
        fields: [users.id],
        references: [resonanceProfiles.userId],
    }),
    messages: many(messages),
    accounts: many(accounts),
    sessions: many(sessions),
    subscriptions: one(subscriptions, {
        fields: [users.id],
        references: [subscriptions.userId],
    }),
}));

export const matchesRelations = relations(matches, ({ one }) => ({
    userA: one(users, { fields: [matches.userAId], references: [users.id] }),
    userB: one(users, { fields: [matches.userBId], references: [users.id] }),
}));

