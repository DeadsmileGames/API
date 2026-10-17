

WITH removed_preorders AS (
  DELETE FROM game_preorders
  WHERE created_at < TIMESTAMPTZ '2026-10-17 13:25:00+00'
  RETURNING user_id, game_id
)
DELETE FROM game_preorder_daily_limits limits
USING removed_preorders removed
WHERE removed.user_id IS NOT NULL
  AND limits.user_id = removed.user_id
  AND limits.game_id = removed.game_id;
