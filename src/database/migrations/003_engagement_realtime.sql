ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS confirmation_token_hash text;
ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS unsubscribe_token_hash text;
ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz;
ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz;

UPDATE newsletter_subscribers
SET confirmed_at = COALESCE(confirmed_at, created_at),
    unsubscribe_token_hash = COALESCE(unsubscribe_token_hash, replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
WHERE confirmed_at IS NULL OR unsubscribe_token_hash IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_confirmation_token_idx
ON newsletter_subscribers (confirmation_token_hash)
WHERE confirmation_token_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_unsubscribe_token_idx
ON newsletter_subscribers (unsubscribe_token_hash)
WHERE unsubscribe_token_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expo_push_token text NOT NULL UNIQUE,
  platform text NOT NULL CHECK (platform IN ('android', 'ios')),
  device_id text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
ON push_subscriptions (user_id, enabled);

CREATE TABLE IF NOT EXISTS content_events (
  id bigserial PRIMARY KEY,
  event_type text NOT NULL CHECK (event_type IN ('news.published', 'game.published', 'video.published', 'wishlist.updated')),
  audience_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  entity_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_events_public_idx
ON content_events (id DESC)
WHERE audience_user_id IS NULL;

CREATE INDEX IF NOT EXISTS content_events_user_idx
ON content_events (audience_user_id, id DESC)
WHERE audience_user_id IS NOT NULL;
