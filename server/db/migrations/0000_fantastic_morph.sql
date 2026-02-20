CREATE TYPE "public"."communication_style" AS ENUM('expressive', 'precise', 'poetic', 'minimal');--> statement-breakpoint
CREATE TYPE "public"."content_type" AS ENUM('text', 'image', 'audio', 'gif', 'location_share');--> statement-breakpoint
CREATE TYPE "public"."conversation_state" AS ENUM('active', 'warming', 'cooling', 'dormant', 'revived');--> statement-breakpoint
CREATE TYPE "public"."energy_archetype" AS ENUM('spark', 'anchor', 'wave', 'ember', 'storm');--> statement-breakpoint
CREATE TYPE "public"."match_state" AS ENUM('pending', 'matched', 'conversation_started', 'dormant', 'unmatched');--> statement-breakpoint
CREATE TYPE "public"."subscription_tier" AS ENUM('free', 'plus', 'premium');--> statement-breakpoint
CREATE TABLE "accounts" (
	"userId" uuid NOT NULL,
	"type" varchar(255) NOT NULL,
	"provider" varchar(255) NOT NULL,
	"providerAccountId" varchar(255) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" varchar(255),
	"scope" varchar(255),
	"id_token" text,
	"session_state" varchar(255),
	CONSTRAINT "accounts_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "behavioral_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"event_type" text NOT NULL,
	"event_data" jsonb,
	"client_ts" timestamp,
	"server_ts" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "blocks_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reported_id" uuid NOT NULL,
	"type" text NOT NULL,
	"reason_code" text,
	"details" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"last_message_at" timestamp,
	"health_state" "conversation_state" DEFAULT 'warming',
	"is_archived_by_a" boolean DEFAULT false,
	"is_archived_by_b" boolean DEFAULT false,
	"pending_nudge" text,
	"nudge_generated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_a_id" uuid NOT NULL,
	"user_b_id" uuid NOT NULL,
	"resonance_score" real,
	"frequency_convergence_data" jsonb,
	"state" "match_state" DEFAULT 'pending',
	"user_a_liked_at" timestamp,
	"user_b_liked_at" timestamp,
	"matched_at" timestamp,
	"unmatched_at" timestamp,
	"unmatched_by" uuid,
	"conversation_started_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid,
	"content" text NOT NULL,
	"content_type" "content_type" DEFAULT 'text',
	"sentiment_score" real,
	"emotion_tag" text,
	"sent_at" timestamp DEFAULT now(),
	"read_at" timestamp,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "resonance_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"emotional_frequency_vector" vector(1536),
	"dominant_emotion_tags" text[] DEFAULT '{}'::text[],
	"energy_archetype" "energy_archetype",
	"communication_style" "communication_style",
	"peak_activity_windows" jsonb DEFAULT '[]'::jsonb,
	"avg_response_latency_ms" integer,
	"vocabulary_richness_score" real DEFAULT 0,
	"humor_detection_score" real DEFAULT 0,
	"depth_seeker_score" real DEFAULT 0,
	"last_recalculated_at" timestamp,
	"model_version" text DEFAULT 'v1'
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sessionToken" varchar(255) PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"tier" "subscription_tier" DEFAULT 'free',
	"period_start" timestamp,
	"period_end" timestamp,
	"status" text DEFAULT 'active',
	"cancel_at_period_end" boolean DEFAULT false,
	CONSTRAINT "subscriptions_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "subscriptions_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255),
	"email" text,
	"emailVerified" timestamp,
	"image" text,
	"phone" text,
	"display_name" text,
	"date_of_birth" timestamp,
	"gender_identity" text,
	"pronouns" text,
	"seeking" text[] DEFAULT '{}'::text[],
	"location_lat" real,
	"location_lng" real,
	"location_city" text,
	"location_country" text,
	"profile_photos" jsonb DEFAULT '[]'::jsonb,
	"bio" text,
	"voice_bio_url" text,
	"video_intro_url" text,
	"is_verified" boolean DEFAULT false,
	"verification_tier" text DEFAULT 'none',
	"subscription_tier" "subscription_tier" DEFAULT 'free',
	"onboarding_complete" boolean DEFAULT false,
	"onboarding_step" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"last_active_at" timestamp DEFAULT now(),
	"deleted_at" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "behavioral_events" ADD CONSTRAINT "behavioral_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks_reports" ADD CONSTRAINT "blocks_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks_reports" ADD CONSTRAINT "blocks_reports_reported_id_users_id_fk" FOREIGN KEY ("reported_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_user_a_id_users_id_fk" FOREIGN KEY ("user_a_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_user_b_id_users_id_fk" FOREIGN KEY ("user_b_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resonance_profiles" ADD CONSTRAINT "resonance_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_accounts_user" ON "accounts" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "behavioral_user_idx" ON "behavioral_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "behavioral_type_idx" ON "behavioral_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "behavioral_server_ts_idx" ON "behavioral_events" USING btree ("server_ts");--> statement-breakpoint
CREATE INDEX "blocks_reporter_idx" ON "blocks_reports" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX "blocks_reported_idx" ON "blocks_reports" USING btree ("reported_id");--> statement-breakpoint
CREATE UNIQUE INDEX "blocks_unique_pair" ON "blocks_reports" USING btree ("reporter_id","reported_id") WHERE type = 'block';--> statement-breakpoint
CREATE INDEX "conversations_match_idx" ON "conversations" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "conversations_last_message_idx" ON "conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE UNIQUE INDEX "matches_unique_pair" ON "matches" USING btree ("user_a_id","user_b_id");--> statement-breakpoint
CREATE INDEX "matches_user_a_idx" ON "matches" USING btree ("user_a_id");--> statement-breakpoint
CREATE INDEX "matches_user_b_idx" ON "matches" USING btree ("user_b_id");--> statement-breakpoint
CREATE INDEX "matches_state_idx" ON "matches" USING btree ("state");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "messages_sender_idx" ON "messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "messages_sent_at_idx" ON "messages" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "idx_sessions_user" ON "sessions" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "subscriptions_user_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_stripe_idx" ON "subscriptions" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_location_idx" ON "users" USING btree ("location_lat","location_lng");--> statement-breakpoint
CREATE INDEX "users_active_idx" ON "users" USING btree ("last_active_at") WHERE deleted_at IS NULL;