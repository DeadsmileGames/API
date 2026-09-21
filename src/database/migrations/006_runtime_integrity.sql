DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'game_sessions_platform_check') THEN
    ALTER TABLE game_sessions
      ADD CONSTRAINT game_sessions_platform_check
      CHECK (platform IN ('windows', 'linux', 'macos'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'game_builds_published_source_check') THEN
    ALTER TABLE game_builds
      ADD CONSTRAINT game_builds_published_source_check
      CHECK (
        status <> 'published'
        OR NULLIF(BTRIM(itch_channel), '') IS NOT NULL
        OR (
          download_url IS NOT NULL
          AND sha256 IS NOT NULL
          AND size_bytes IS NOT NULL
          AND size_bytes > 0
        )
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS game_sessions_open_idx
ON game_sessions (user_id, game_id, started_at DESC)
WHERE ended_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS game_builds_one_published_idx
ON game_builds (game_id, channel_id, platform, architecture)
WHERE status = 'published';
