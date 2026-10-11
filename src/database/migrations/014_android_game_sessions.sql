ALTER TABLE game_sessions DROP CONSTRAINT IF EXISTS game_sessions_platform_check;
ALTER TABLE game_sessions ADD CONSTRAINT game_sessions_platform_check
CHECK (platform IN ('windows', 'linux', 'macos', 'android'));
