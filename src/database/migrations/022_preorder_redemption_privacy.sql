-- Personal details and the one-time code are no longer needed once a reward is redeemed.
-- Keep the minimal preorder row and claim token so the reward page/library access can finish.
ALTER TABLE game_preorders
  ALTER COLUMN first_name DROP NOT NULL,
  ALTER COLUMN last_name DROP NOT NULL,
  ALTER COLUMN age DROP NOT NULL,
  ALTER COLUMN email DROP NOT NULL;
