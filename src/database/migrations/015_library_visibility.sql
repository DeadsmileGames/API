ALTER TABLE user_game_entitlements
  ADD COLUMN IF NOT EXISTS hidden_from_library_at timestamp with time zone;
