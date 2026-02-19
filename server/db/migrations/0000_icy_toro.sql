CREATE TYPE "public"."communication_style" AS ENUM('expressive', 'precise', 'poetic', 'minimal', 'witty');--> statement-breakpoint
CREATE TYPE "public"."energy_archetype" AS ENUM('spark', 'anchor', 'wave', 'ember', 'storm');--> statement-breakpoint
CREATE TYPE "public"."gender_identity" AS ENUM('man', 'woman', 'non_binary', 'transgender', 'genderqueer', 'agender', 'other', 'prefer_not_to_say');--> statement-breakpoint
CREATE TYPE "public"."subscription_tier" AS ENUM('free', 'plus', 'premium');--> statement-breakpoint
CREATE TYPE "public"."verification_tier" AS ENUM('none', 'phone', 'id', 'video');--> statement-breakpoint
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
CREATE TABLE "resonance_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"embedding_ref" varchar(64),
	"dominant_emotion_tags" jsonb DEFAULT '[]'::jsonb,
	"energy_archetype" "energy_archetype",
	"communication_style" "communication_style",
	"peak_activity_windows" jsonb DEFAULT '[]'::jsonb,
	"avg_response_latency_ms" integer,
	"vocabulary_richness_score" real,
	"humor_detection_score" real,
	"depth_seeker_score" real,
	"last_recalculated_at" timestamp DEFAULT now(),
	"model_version" varchar(50) DEFAULT 'v1.0',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "resonance_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sessionToken" varchar(255) PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255),
	"email" varchar(255),
	"emailVerified" timestamp,
	"image" text,
	"phone" varchar(20),
	"display_name" varchar(100),
	"date_of_birth" timestamp,
	"gender_identity" "gender_identity",
	"pronouns" varchar(50),
	"seeking" jsonb DEFAULT '[]'::jsonb,
	"location_lat" real,
	"location_lng" real,
	"location_city" varchar(100),
	"location_country" varchar(100),
	"profile_photos" jsonb DEFAULT '[]'::jsonb,
	"bio" text,
	"voice_bio_url" text,
	"video_intro_url" text,
	"is_verified" boolean DEFAULT false,
	"verification_tier" "verification_tier" DEFAULT 'none',
	"subscription_tier" "subscription_tier" DEFAULT 'free',
	"onboarding_complete" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_active_at" timestamp DEFAULT now() NOT NULL,
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
ALTER TABLE "resonance_profiles" ADD CONSTRAINT "resonance_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_accounts_user" ON "accounts" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_resonance_user" ON "resonance_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_resonance_archetype" ON "resonance_profiles" USING btree ("energy_archetype");--> statement-breakpoint
CREATE INDEX "idx_resonance_style" ON "resonance_profiles" USING btree ("communication_style");--> statement-breakpoint
CREATE INDEX "idx_sessions_user" ON "sessions" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_location" ON "users" USING btree ("location_lat","location_lng");--> statement-breakpoint
CREATE INDEX "idx_users_last_active" ON "users" USING btree ("last_active_at");--> statement-breakpoint
CREATE INDEX "idx_users_gender_seeking" ON "users" USING btree ("gender_identity");