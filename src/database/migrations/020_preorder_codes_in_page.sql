ALTER TABLE game_preorders
  ADD COLUMN IF NOT EXISTS reward_code varchar(6)
  CHECK (reward_code IS NULL OR reward_code ~ '^[0-9]{6}$');

DROP INDEX IF EXISTS game_preorders_email_queue_idx;
DROP INDEX IF EXISTS game_preorders_confirmed_queue_idx;
ALTER TABLE game_preorders DROP COLUMN IF EXISTS code_sent_at;
ALTER TABLE game_preorders DROP COLUMN IF EXISTS email_status;

DROP TABLE IF EXISTS preorder_email_batches;
