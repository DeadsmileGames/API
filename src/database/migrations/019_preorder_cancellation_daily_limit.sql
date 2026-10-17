ALTER TABLE game_preorders
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE;

UPDATE game_preorders p
SET user_id = u.id
FROM users u
WHERE p.user_id IS NULL AND lower(u.email) = lower(p.email);

CREATE INDEX IF NOT EXISTS game_preorders_user_game_idx
  ON game_preorders(user_id, game_id)
  WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS game_preorder_daily_limits (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  activity_date date NOT NULL,
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 2),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_id, activity_date)
);
