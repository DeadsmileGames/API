ALTER TABLE support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_category_check;

ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_category_check
  CHECK (category = ANY (ARRAY['game'::text, 'account'::text, 'technical'::text, 'faq'::text, 'purchase'::text, 'other'::text]));

CREATE TABLE IF NOT EXISTS api_rate_limits (
  scope text NOT NULL,
  key_hash text NOT NULL,
  window_start timestamp with time zone NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  expires_at timestamp with time zone NOT NULL,
  CONSTRAINT api_rate_limits_pkey PRIMARY KEY (scope, key_hash, window_start),
  CONSTRAINT api_rate_limits_hits_check CHECK (hits >= 0),
  CONSTRAINT api_rate_limits_key_hash_check CHECK (key_hash ~ '^[a-f0-9]{64}$'::text)
);

CREATE INDEX IF NOT EXISTS api_rate_limits_expires_idx ON api_rate_limits (expires_at);
CREATE INDEX IF NOT EXISTS telemetry_events_user_created_idx ON telemetry_events (user_id, created_at);
CREATE INDEX IF NOT EXISTS password_resets_active_idx ON password_resets (user_id, expires_at) WHERE used_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS release_channels_id_game_unique ON release_channels (id, game_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM game_builds b
    JOIN release_channels c ON c.id = b.channel_id
    WHERE c.game_id <> b.game_id
  ) THEN
    RAISE EXCEPTION 'Cannot apply hardening: game_builds contains channel/game mismatches';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM beta_access b
    JOIN release_channels c ON c.id = b.channel_id
    WHERE c.game_id <> b.game_id
  ) THEN
    RAISE EXCEPTION 'Cannot apply hardening: beta_access contains channel/game mismatches';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'game_builds_channel_game_fkey') THEN
    ALTER TABLE game_builds
      ADD CONSTRAINT game_builds_channel_game_fkey
      FOREIGN KEY (channel_id, game_id) REFERENCES release_channels (id, game_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'beta_access_channel_game_fkey') THEN
    ALTER TABLE beta_access
      ADD CONSTRAINT beta_access_channel_game_fkey
      FOREIGN KEY (channel_id, game_id) REFERENCES release_channels (id, game_id) ON DELETE CASCADE;
  END IF;
END
$$;
