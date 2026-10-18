ALTER TABLE itch_oauth_states
  ADD COLUMN IF NOT EXISTS frontend_origin text;

UPDATE itch_oauth_states
SET frontend_origin = 'https://deadsmilegames.onrender.com'
WHERE frontend_origin IS NULL;

ALTER TABLE itch_oauth_states
  ALTER COLUMN frontend_origin SET NOT NULL;

DELETE FROM itch_oauth_states
WHERE client <> 'site';

ALTER TABLE itch_oauth_states
  DROP CONSTRAINT IF EXISTS itch_oauth_states_client_check;

ALTER TABLE itch_oauth_states
  ADD CONSTRAINT itch_oauth_states_client_check CHECK (client = 'site');
