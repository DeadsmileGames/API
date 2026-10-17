ALTER TABLE games
 ADD COLUMN IF NOT EXISTS preorder_enabled boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS preorder_starts_at timestamptz,
 ADD COLUMN IF NOT EXISTS preorder_ends_at timestamptz,
 ADD COLUMN IF NOT EXISTS preorder_age_ratings jsonb NOT NULL DEFAULT '{"en":13,"pt-BR":13,"es":13}'::jsonb,
 ADD COLUMN IF NOT EXISTS preorder_reward_type text,
 ADD COLUMN IF NOT EXISTS preorder_reward_description text,
 ADD COLUMN IF NOT EXISTS preorder_reward_zip bytea,
 ADD COLUMN IF NOT EXISTS preorder_reward_wallpapers jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE games ADD CONSTRAINT games_preorder_window_check CHECK (NOT preorder_enabled OR (preorder_starts_at IS NOT NULL AND preorder_ends_at IS NOT NULL AND preorder_ends_at > preorder_starts_at));
ALTER TABLE games ADD CONSTRAINT games_preorder_reward_type_check CHECK (preorder_reward_type IS NULL OR preorder_reward_type IN ('video','wallpapers','package','other'));
CREATE TABLE IF NOT EXISTS game_preorders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
 first_name varchar(100) NOT NULL, last_name varchar(100) NOT NULL, age smallint NOT NULL CHECK(age BETWEEN 1 AND 120),
 locale varchar(10) NOT NULL CHECK(locale IN ('en','pt-BR','es')), email varchar(254) NOT NULL,
 code_hash char(64) UNIQUE, code_sent_at timestamptz, email_status text NOT NULL DEFAULT 'waiting' CHECK(email_status IN ('waiting','sent','failed')),
 claim_token_hash char(64) UNIQUE, claim_token_expires_at timestamptz, reward_accessed_at timestamptz,
 reward_download_token_hash char(64) UNIQUE, redeemed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(game_id,email)
);
CREATE INDEX IF NOT EXISTS game_preorders_email_queue_idx ON game_preorders(email_status,created_at) WHERE email_status IN ('waiting','failed');
CREATE TABLE IF NOT EXISTS preorder_email_batches (id boolean PRIMARY KEY DEFAULT true CHECK(id=true), last_batch_at timestamptz);
INSERT INTO preorder_email_batches(id,last_batch_at) VALUES(true,NULL) ON CONFLICT(id) DO NOTHING;
