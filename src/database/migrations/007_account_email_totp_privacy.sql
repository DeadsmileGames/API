ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
CREATE TABLE IF NOT EXISTS account_email_tokens (
  user_id uuid PRIMARY KEY
    REFERENCES users(id) ON DELETE CASCADE,

  purpose text NOT NULL
    CHECK (purpose IN ('register', 'change')),

  target_email varchar(254) NOT NULL,

  token_hash text NOT NULL UNIQUE
    CHECK (token_hash ~ '^[a-f0-9]{64}$'),

  expires_at timestamptz NOT NULL,

  last_sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_email_tokens_expiry_idx
ON account_email_tokens (expires_at);
ALTER TABLE user_totp
ADD COLUMN IF NOT EXISTS last_used_step bigint;
ALTER TABLE users
ADD COLUMN IF NOT EXISTS
share_game_activity boolean NOT NULL DEFAULT false;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS
share_playtime boolean NOT NULL DEFAULT false;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS
share_achievements boolean NOT NULL DEFAULT false;

ALTER TABLE game_activity
ALTER COLUMN public SET DEFAULT false;

UPDATE game_activity
SET public = false
WHERE public = true;