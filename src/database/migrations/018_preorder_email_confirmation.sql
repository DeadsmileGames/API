ALTER TABLE game_preorders
  ADD COLUMN IF NOT EXISTS confirmation_token_hash char(64),
  ADD COLUMN IF NOT EXISTS confirmation_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS game_preorders_confirmation_token_uidx
  ON game_preorders(confirmation_token_hash)
  WHERE confirmation_token_hash IS NOT NULL;

UPDATE game_preorders
SET confirmed_at = created_at
WHERE confirmed_at IS NULL AND confirmation_token_hash IS NULL;

CREATE INDEX IF NOT EXISTS game_preorders_confirmed_queue_idx
  ON game_preorders(email_status, created_at)
  WHERE confirmed_at IS NOT NULL AND email_status IN ('waiting', 'failed');
