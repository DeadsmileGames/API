-- The active-library query and remove/restore routes require this membership state.
-- Older production databases applied access-control migrations before this column existed.
ALTER TABLE user_game_entitlements
  ADD COLUMN IF NOT EXISTS hidden_from_library_at timestamptz;

CREATE INDEX IF NOT EXISTS user_game_entitlements_library_visibility_idx
  ON user_game_entitlements (user_id, hidden_from_library_at)
  WHERE revoked_at IS NULL;
