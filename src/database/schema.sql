CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE TABLE "account_email_tokens" (
	"user_id" uuid PRIMARY KEY,
	"purpose" text NOT NULL,
	"target_email" varchar(254) NOT NULL,
	"token_hash" text NOT NULL CONSTRAINT "account_email_tokens_token_hash_key" UNIQUE,
	"expires_at" timestamp with time zone NOT NULL,
	"last_sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_email_tokens_purpose_check" CHECK ((purpose = ANY (ARRAY['register'::text, 'change'::text]))),
	CONSTRAINT "account_email_tokens_token_hash_check" CHECK ((token_hash ~ '^[a-f0-9]{64}$'::text))
);
CREATE TABLE "achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"game_id" uuid NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon_url" text,
	"points" integer DEFAULT 0 NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "achievements_game_id_key_key" UNIQUE("game_id","key"),
	CONSTRAINT "achievements_key_check" CHECK ((key ~ '^[a-z0-9_]{2,80}$'::text)),
	CONSTRAINT "achievements_points_check" CHECK (((points >= 0) AND (points <= 1000)))
);
CREATE TABLE "api_rate_limits" (
	"scope" text,
	"key_hash" text,
	"window_start" timestamp with time zone,
	"hits" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "api_rate_limits_pkey" PRIMARY KEY("scope","key_hash","window_start"),
	CONSTRAINT "api_rate_limits_hits_check" CHECK ((hits >= 0)),
	CONSTRAINT "api_rate_limits_key_hash_check" CHECK ((key_hash ~ '^[a-f0-9]{64}$'::text))
);
CREATE TABLE "beta_access" (
	"user_id" uuid,
	"game_id" uuid,
	"channel_id" bigint,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "beta_access_pkey" PRIMARY KEY("user_id","game_id","channel_id")
);
CREATE TABLE "cloud_saves" (
	"user_id" uuid,
	"game_id" uuid,
	"slot" text,
	"revision" bigint DEFAULT 1 NOT NULL,
	"payload" text NOT NULL,
	"sha256" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cloud_saves_pkey" PRIMARY KEY("user_id","game_id","slot"),
	CONSTRAINT "cloud_saves_revision_check" CHECK ((revision > 0)),
	CONSTRAINT "cloud_saves_sha256_check" CHECK ((sha256 ~ '^[a-f0-9]{64}$'::text)),
	CONSTRAINT "cloud_saves_slot_check" CHECK ((slot ~ '^[a-z0-9_-]{1,40}$'::text))
);
CREATE TABLE "content_events" (
	"id" bigserial PRIMARY KEY,
	"event_type" text NOT NULL,
	"audience_user_id" uuid,
	"entity_id" text NOT NULL,
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_events_event_type_check" CHECK ((event_type = ANY (ARRAY['news.published'::text, 'game.published'::text, 'video.published'::text, 'wishlist.updated'::text])))
);
CREATE TABLE "downloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"title" text NOT NULL,
	"category" text NOT NULL,
	"file_url" text,
	"preview_image" text,
	"file_type" text,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "game_activity" (
	"user_id" uuid,
	"game_id" uuid,
	"total_ms" bigint DEFAULT 0 NOT NULL,
	"sessions" integer DEFAULT 0 NOT NULL,
	"last_played_at" timestamp with time zone DEFAULT now() NOT NULL,
	"public" boolean DEFAULT false NOT NULL,
	CONSTRAINT "game_activity_pkey" PRIMARY KEY("user_id","game_id"),
	CONSTRAINT "game_activity_sessions_check" CHECK ((sessions >= 0)),
	CONSTRAINT "game_activity_total_ms_check" CHECK ((total_ms >= 0))
);
CREATE TABLE "game_builds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"game_id" uuid NOT NULL,
	"channel_id" bigint NOT NULL,
	"version" text NOT NULL,
	"platform" text NOT NULL,
	"architecture" text DEFAULT 'x64' NOT NULL,
	"itch_channel" text,
	"download_url" text,
	"sha256" text,
	"size_bytes" bigint,
	"notes" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_builds_game_id_channel_id_version_platform_architectur_key" UNIQUE("game_id","channel_id","version","platform","architecture"),
	CONSTRAINT "game_builds_platform_check" CHECK ((platform = ANY (ARRAY['windows'::text, 'linux'::text, 'macos'::text]))),
	CONSTRAINT "game_builds_published_source_check" CHECK (((status <> 'published'::text) OR (NULLIF(btrim(itch_channel), ''::text) IS NOT NULL) OR ((download_url IS NOT NULL) AND (sha256 IS NOT NULL) AND (size_bytes IS NOT NULL) AND (size_bytes > 0)))),
	CONSTRAINT "game_builds_sha256_check" CHECK (((sha256 IS NULL) OR (sha256 ~ '^[a-f0-9]{64}$'::text))),
	CONSTRAINT "game_builds_size_bytes_check" CHECK (((size_bytes IS NULL) OR (size_bytes >= 0))),
	CONSTRAINT "game_builds_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'retired'::text])))
);
CREATE TABLE "game_genres" (
	"game_id" uuid,
	"genre_id" integer,
	CONSTRAINT "game_genres_pkey" PRIMARY KEY("game_id","genre_id")
);
CREATE TABLE "game_platforms" (
	"game_id" uuid,
	"platform_id" integer,
	CONSTRAINT "game_platforms_pkey" PRIMARY KEY("game_id","platform_id")
);
CREATE TABLE "game_screenshots" (
	"id" serial PRIMARY KEY,
	"game_id" uuid NOT NULL,
	"url" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
CREATE TABLE "game_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"launcher_version" text,
	"game_version" text,
	"platform" text DEFAULT 'windows' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_ms" bigint,
	CONSTRAINT "game_sessions_duration_ms_check" CHECK (((duration_ms IS NULL) OR ((duration_ms >= 0) AND (duration_ms <= 86400000)))),
	CONSTRAINT "game_sessions_platform_check" CHECK ((platform = ANY (ARRAY['windows'::text, 'linux'::text, 'macos'::text])))
);
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"title" text NOT NULL,
	"slug" text NOT NULL CONSTRAINT "games_slug_key" UNIQUE,
	"short_description" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'announced' NOT NULL,
	"release_date" date,
	"hero_image" text,
	"cover_image" text,
	"trailer_url" text,
	"featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"purchase_url" varchar(255),
	"download_url" varchar(255),
	"itch_game_id" bigint,
	"engine" text DEFAULT 'native' NOT NULL,
	"save_path_template" text,
	"cloud_saves_enabled" boolean DEFAULT false NOT NULL,
	"telemetry_enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "games_status_check" CHECK ((status = ANY (ARRAY['announced'::text, 'in_development'::text, 'released'::text])))
);
CREATE TABLE "genres" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL CONSTRAINT "genres_name_key" UNIQUE
);
CREATE TABLE "itch_oauth_states" (
	"state_hash" text PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"client" text NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"return_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "itch_oauth_states_client_check" CHECK ((client = ANY (ARRAY['site'::text, 'launcher'::text]))),
	CONSTRAINT "itch_oauth_states_locale_check" CHECK ((locale = ANY (ARRAY['en'::text, 'pt-BR'::text, 'es'::text])))
);
CREATE TABLE "news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"slug" text NOT NULL CONSTRAINT "news_slug_key" UNIQUE,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text,
	"body" text DEFAULT '' NOT NULL,
	"image" text,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"game_id" uuid
);
CREATE TABLE "newsletter_subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" text NOT NULL CONSTRAINT "newsletter_subscribers_email_key" UNIQUE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"confirmation_token_hash" text,
	"unsubscribe_token_hash" text,
	"unsubscribed_at" timestamp with time zone,
	"confirmation_sent_at" timestamp with time zone
);
CREATE TABLE "password_resets" (
	"id" bigserial PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "platforms" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL CONSTRAINT "platforms_name_key" UNIQUE
);
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"category" text NOT NULL,
	"price_cents" integer NOT NULL,
	"image" text,
	"available" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_price_cents_check" CHECK ((price_cents >= 0))
);
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"expo_push_token" text NOT NULL CONSTRAINT "push_subscriptions_expo_push_token_key" UNIQUE,
	"platform" text NOT NULL,
	"device_id" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_platform_check" CHECK ((platform = ANY (ARRAY['android'::text, 'ios'::text])))
);
CREATE TABLE "release_channels" (
	"id" bigserial PRIMARY KEY,
	"game_id" uuid NOT NULL,
	"name" text NOT NULL,
	"label" text NOT NULL,
	"public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "release_channels_game_id_name_key" UNIQUE("game_id","name"),
	CONSTRAINT "release_channels_name_check" CHECK ((name = ANY (ARRAY['stable'::text, 'beta'::text, 'internal'::text])))
);
CREATE TABLE "schema_migrations" (
	"name" text PRIMARY KEY,
	"checksum" text NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "service_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"severity" text NOT NULL,
	"status" text DEFAULT 'investigating' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_incidents_severity_check" CHECK ((severity = ANY (ARRAY['notice'::text, 'degraded'::text, 'outage'::text]))),
	CONSTRAINT "service_incidents_status_check" CHECK ((status = ANY (ARRAY['investigating'::text, 'monitoring'::text, 'resolved'::text])))
);
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" text NOT NULL,
	"category" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_tickets_category_check" CHECK ((category = ANY (ARRAY['game'::text, 'account'::text, 'technical'::text, 'faq'::text, 'purchase'::text, 'other'::text]))),
	CONSTRAINT "support_tickets_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'closed'::text])))
);
CREATE TABLE "telemetry_events" (
	"id" bigserial PRIMARY KEY,
	"user_id" uuid,
	"game_id" uuid,
	"session_id" uuid,
	"event_type" text NOT NULL,
	"app_version" text,
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "telemetry_events_event_type_check" CHECK ((event_type = ANY (ARRAY['launcher_crash'::text, 'game_crash'::text, 'install_failed'::text, 'update_failed'::text])))
);
CREATE TABLE "user_achievements" (
	"user_id" uuid,
	"achievement_id" uuid,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_achievements_pkey" PRIMARY KEY("user_id","achievement_id")
);
CREATE TABLE "user_game_entitlements" (
	"user_id" uuid,
	"game_id" uuid,
	"source" text DEFAULT 'itch' NOT NULL,
	"external_reference" text,
	"acquired_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "user_game_entitlements_pkey" PRIMARY KEY("user_id","game_id"),
	CONSTRAINT "user_game_entitlements_source_check" CHECK ((source = 'itch'::text))
);
CREATE TABLE "user_itch_accounts" (
	"user_id" uuid PRIMARY KEY,
	"itch_user_id" bigint NOT NULL CONSTRAINT "user_itch_accounts_itch_user_id_key" UNIQUE,
	"itch_username" text NOT NULL,
	"itch_profile_url" text,
	"access_token_encrypted" text,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sync_at" timestamp with time zone
);
CREATE TABLE "user_sessions" (
	"sid" varchar,
	"sess" json NOT NULL,
	"expire" timestamp NOT NULL,
	CONSTRAINT "session_pkey" PRIMARY KEY("sid")
);
CREATE TABLE "user_totp" (
	"user_id" uuid PRIMARY KEY,
	"secret" text NOT NULL,
	"enabled" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"last_used_step" bigint
);
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" text NOT NULL CONSTRAINT "users_email_key" UNIQUE,
	"username" text NOT NULL CONSTRAINT "users_username_key" UNIQUE,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	"avatar_url" text,
	"bio" text DEFAULT '' NOT NULL,
	"website_url" text,
	"location" text,
	"telemetry_consent" boolean DEFAULT false NOT NULL,
	"email_verified_at" timestamp with time zone,
	"share_game_activity" boolean DEFAULT false NOT NULL,
	"share_playtime" boolean DEFAULT false NOT NULL,
	"share_achievements" boolean DEFAULT false NOT NULL,
	CONSTRAINT "users_role_check" CHECK ((role = ANY (ARRAY['user'::text, 'admin'::text])))
);
CREATE TABLE "videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"title" text NOT NULL,
	"category" text NOT NULL,
	"thumbnail" text,
	"video_url" text,
	"duration_seconds" integer,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"game_id" uuid
);
CREATE TABLE "wishlists" (
	"id" serial PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "wishlists_user_id_game_id_key" UNIQUE("user_id","game_id")
);
CREATE INDEX "account_email_tokens_expiry_idx" ON "account_email_tokens" ("expires_at");




CREATE INDEX "api_rate_limits_expires_idx" ON "api_rate_limits" ("expires_at");




CREATE INDEX "content_events_public_idx" ON "content_events" ("id");
CREATE INDEX "content_events_user_idx" ON "content_events" ("audience_user_id","id");


CREATE INDEX "game_activity_public_idx" ON "game_activity" ("user_id","last_played_at");

CREATE INDEX "game_builds_lookup_idx" ON "game_builds" ("game_id","channel_id","platform","published_at");
CREATE UNIQUE INDEX "game_builds_one_published_idx" ON "game_builds" ("game_id","channel_id","platform","architecture");




CREATE INDEX "idx_game_screenshots_game_id" ON "game_screenshots" ("game_id");
CREATE INDEX "game_sessions_open_idx" ON "game_sessions" ("user_id","game_id","started_at");

CREATE INDEX "game_sessions_user_idx" ON "game_sessions" ("user_id","started_at");
CREATE UNIQUE INDEX "games_itch_game_id_unique" ON "games" ("itch_game_id");


CREATE INDEX "idx_games_featured" ON "games" ("featured");
CREATE INDEX "idx_games_slug" ON "games" ("slug");
CREATE INDEX "idx_games_status" ON "games" ("status");
CREATE INDEX "idx_games_title" ON "games" ("title");
CREATE INDEX "idx_games_title_trgm" ON "games" USING gin ("title" gin_trgm_ops);



CREATE INDEX "itch_oauth_states_user_id_idx" ON "itch_oauth_states" ("user_id");
CREATE INDEX "idx_news_published_at" ON "news" ("published_at");
CREATE INDEX "news_game_id_idx" ON "news" ("game_id","published_at");


CREATE INDEX "idx_newsletter_created_at" ON "newsletter_subscribers" ("created_at");
CREATE UNIQUE INDEX "newsletter_confirmation_token_idx" ON "newsletter_subscribers" ("confirmation_token_hash");


CREATE UNIQUE INDEX "newsletter_unsubscribe_token_idx" ON "newsletter_subscribers" ("unsubscribe_token_hash");
CREATE INDEX "password_resets_active_idx" ON "password_resets" ("user_id","expires_at");

CREATE UNIQUE INDEX "password_resets_token_hash_idx" ON "password_resets" ("token_hash");
CREATE INDEX "password_resets_user_id_idx" ON "password_resets" ("user_id");





CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" ("user_id","enabled");

CREATE UNIQUE INDEX "release_channels_id_game_unique" ON "release_channels" ("id","game_id");



CREATE INDEX "idx_support_created_at" ON "support_tickets" ("created_at");
CREATE INDEX "idx_support_status" ON "support_tickets" ("status");

CREATE INDEX "telemetry_events_created_idx" ON "telemetry_events" ("created_at");

CREATE INDEX "telemetry_events_user_created_idx" ON "telemetry_events" ("user_id","created_at");

CREATE INDEX "user_game_entitlements_active_idx" ON "user_game_entitlements" ("user_id","revoked_at");



CREATE INDEX "IDX_session_expire" ON "user_sessions" ("expire");


CREATE INDEX "idx_users_email" ON "users" ("email");
CREATE INDEX "idx_users_username" ON "users" ("username");



CREATE INDEX "idx_videos_published_at" ON "videos" ("published_at");
CREATE INDEX "videos_game_id_idx" ON "videos" ("game_id","published_at");

CREATE INDEX "idx_wishlists_game_id" ON "wishlists" ("game_id");
CREATE INDEX "idx_wishlists_user_id" ON "wishlists" ("user_id");


ALTER TABLE "account_email_tokens" ADD CONSTRAINT "account_email_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE;
ALTER TABLE "beta_access" ADD CONSTRAINT "beta_access_channel_game_fkey" FOREIGN KEY ("channel_id","game_id") REFERENCES "release_channels"("id","game_id") ON DELETE CASCADE;
ALTER TABLE "beta_access" ADD CONSTRAINT "beta_access_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "release_channels"("id") ON DELETE CASCADE;
ALTER TABLE "beta_access" ADD CONSTRAINT "beta_access_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE;
ALTER TABLE "beta_access" ADD CONSTRAINT "beta_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "cloud_saves" ADD CONSTRAINT "cloud_saves_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE;
ALTER TABLE "cloud_saves" ADD CONSTRAINT "cloud_saves_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "content_events" ADD CONSTRAINT "content_events_audience_user_id_fkey" FOREIGN KEY ("audience_user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "game_activity" ADD CONSTRAINT "game_activity_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE;
ALTER TABLE "game_activity" ADD CONSTRAINT "game_activity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "game_builds" ADD CONSTRAINT "game_builds_channel_game_fkey" FOREIGN KEY ("channel_id","game_id") REFERENCES "release_channels"("id","game_id") ON DELETE CASCADE;
ALTER TABLE "game_builds" ADD CONSTRAINT "game_builds_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "release_channels"("id") ON DELETE CASCADE;
ALTER TABLE "game_builds" ADD CONSTRAINT "game_builds_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE;
ALTER TABLE "game_genres" ADD CONSTRAINT "game_genres_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE;
ALTER TABLE "game_genres" ADD CONSTRAINT "game_genres_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE CASCADE;
ALTER TABLE "game_platforms" ADD CONSTRAINT "game_platforms_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE;
ALTER TABLE "game_platforms" ADD CONSTRAINT "game_platforms_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE CASCADE;
ALTER TABLE "game_screenshots" ADD CONSTRAINT "game_screenshots_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE;
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE;
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "itch_oauth_states" ADD CONSTRAINT "itch_oauth_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "news" ADD CONSTRAINT "news_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE SET NULL;
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "release_channels" ADD CONSTRAINT "release_channels_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE;
ALTER TABLE "telemetry_events" ADD CONSTRAINT "telemetry_events_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE SET NULL;
ALTER TABLE "telemetry_events" ADD CONSTRAINT "telemetry_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE SET NULL;
ALTER TABLE "telemetry_events" ADD CONSTRAINT "telemetry_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "achievements"("id") ON DELETE CASCADE;
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "user_game_entitlements" ADD CONSTRAINT "user_game_entitlements_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE;
ALTER TABLE "user_game_entitlements" ADD CONSTRAINT "user_game_entitlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "user_itch_accounts" ADD CONSTRAINT "user_itch_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "user_totp" ADD CONSTRAINT "user_totp_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "videos" ADD CONSTRAINT "videos_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE SET NULL;
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE;
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE games ADD COLUMN access_type text;
UPDATE games SET access_type = CASE WHEN NULLIF(BTRIM(purchase_url), '') IS NULL THEN 'free' ELSE 'paid' END;
ALTER TABLE games ALTER COLUMN access_type SET NOT NULL;
ALTER TABLE games ALTER COLUMN access_type SET DEFAULT 'free';
ALTER TABLE games ADD CONSTRAINT games_access_type_check CHECK (access_type IN ('free', 'paid'));
ALTER TABLE games ADD COLUMN itch_url text;
UPDATE games SET itch_url = regexp_replace(purchase_url, '/purchase/?$', '') WHERE purchase_url IS NOT NULL;
ALTER TABLE games ADD COLUMN microsoft_product_id text;
ALTER TABLE games ADD COLUMN microsoft_badge_image text;
ALTER TABLE games ADD CONSTRAINT games_microsoft_badge_check CHECK (
  (microsoft_product_id IS NULL AND microsoft_badge_image IS NULL) OR
  (microsoft_product_id IS NOT NULL AND microsoft_badge_image IS NOT NULL
    AND microsoft_product_id ~ '^[A-Z0-9]{12}$'
    AND microsoft_badge_image ~ '^https://get[.]microsoft[.]com/images/[a-z]{2}-[a-z]{2}%20(light|dark)[.]svg$')
);
ALTER TABLE user_game_entitlements DROP CONSTRAINT user_game_entitlements_source_check;
ALTER TABLE user_game_entitlements ADD CONSTRAINT user_game_entitlements_source_check CHECK (source IN ('itch', 'free'));
UPDATE user_game_entitlements e SET revoked_at = now()
FROM games g WHERE g.id = e.game_id AND g.access_type = 'paid' AND e.source = 'free';
CREATE OR REPLACE FUNCTION invalidate_free_entitlements() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.access_type <> NEW.access_type THEN
    UPDATE user_game_entitlements SET revoked_at = now(), last_verified_at = now() WHERE game_id = NEW.id;
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER games_access_changed AFTER UPDATE OF access_type ON games
FOR EACH ROW EXECUTE FUNCTION invalidate_free_entitlements();
