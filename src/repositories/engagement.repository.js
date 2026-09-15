import { query } from '../config/database.js';

export async function upsertNewsletterSubscriber({ email, confirmationTokenHash }) {
  const { rows } = await query(
    `INSERT INTO newsletter_subscribers
      (email, confirmation_token_hash, confirmation_sent_at, confirmed_at, unsubscribed_at)
     VALUES ($1, $2, now(), NULL, NULL)
     ON CONFLICT (email) DO UPDATE SET
       confirmation_token_hash = CASE
         WHEN newsletter_subscribers.confirmed_at IS NULL OR newsletter_subscribers.unsubscribed_at IS NOT NULL
         THEN EXCLUDED.confirmation_token_hash
         ELSE newsletter_subscribers.confirmation_token_hash
       END,
       confirmation_sent_at = CASE
         WHEN newsletter_subscribers.confirmed_at IS NULL OR newsletter_subscribers.unsubscribed_at IS NOT NULL
         THEN now()
         ELSE newsletter_subscribers.confirmation_sent_at
       END,
       confirmed_at = CASE
         WHEN newsletter_subscribers.unsubscribed_at IS NOT NULL THEN NULL
         ELSE newsletter_subscribers.confirmed_at
       END,
       unsubscribed_at = CASE
         WHEN newsletter_subscribers.unsubscribed_at IS NOT NULL THEN NULL
         ELSE newsletter_subscribers.unsubscribed_at
       END
     RETURNING id, email, confirmed_at, unsubscribed_at`,
    [email, confirmationTokenHash],
  );
  return rows[0];
}

export async function confirmNewsletter(tokenHash) {
  const { rows } = await query(
    `UPDATE newsletter_subscribers
     SET confirmed_at = now(), confirmation_token_hash = NULL, unsubscribed_at = NULL
     WHERE confirmation_token_hash = $1
       AND unsubscribed_at IS NULL
       AND confirmation_sent_at > now() - interval '24 hours'
     RETURNING id, email, confirmed_at`,
    [tokenHash],
  );
  return rows[0] || null;
}

export async function unsubscribeNewsletterById(id) {
  const { rows } = await query(
    `UPDATE newsletter_subscribers
     SET unsubscribed_at = now(), confirmation_token_hash = NULL
     WHERE id = $1 AND unsubscribed_at IS NULL
     RETURNING id, email, unsubscribed_at`,
    [id],
  );
  return rows[0] || null;
}

export async function unsubscribeNewsletterLegacy(token) {
  const { rows } = await query(
    `UPDATE newsletter_subscribers
     SET unsubscribed_at = now(), confirmation_token_hash = NULL
     WHERE unsubscribe_token_hash = $1 AND unsubscribed_at IS NULL
     RETURNING id, email, unsubscribed_at`,
    [token],
  );
  return rows[0] || null;
}

export async function listConfirmedSubscribers() {
  const { rows } = await query(
    `SELECT id, email
     FROM newsletter_subscribers
     WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL
     ORDER BY id`,
  );
  return rows;
}

export async function savePushSubscription({ userId, token, platform, deviceId }) {
  const { rows } = await query(
    `INSERT INTO push_subscriptions (user_id, expo_push_token, platform, device_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (expo_push_token) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       platform = EXCLUDED.platform,
       device_id = EXCLUDED.device_id,
       enabled = true,
       updated_at = now()
     RETURNING id, platform, device_id, enabled, updated_at`,
    [userId, token, platform, deviceId || null],
  );
  return rows[0];
}

export async function disablePushSubscription(userId, token) {
  const { rowCount } = await query(
    `UPDATE push_subscriptions SET enabled = false, updated_at = now()
     WHERE user_id = $1 AND expo_push_token = $2`,
    [userId, token],
  );
  return rowCount > 0;
}

export async function disablePushTokens(tokens) {
  if (!tokens.length) return;
  await query(
    `UPDATE push_subscriptions SET enabled = false, updated_at = now()
     WHERE expo_push_token = ANY($1::text[])`,
    [tokens],
  );
}

export async function listPushTokens() {
  const { rows } = await query(
    `SELECT expo_push_token FROM push_subscriptions WHERE enabled = true ORDER BY id`,
  );
  return rows.map((row) => row.expo_push_token);
}

export async function createEvent({ eventType, audienceUserId = null, entityId, payload }) {
  const { rows } = await query(
    `INSERT INTO content_events (event_type, audience_user_id, entity_id, payload)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING id, event_type, audience_user_id, entity_id, payload, created_at`,
    [eventType, audienceUserId, String(entityId), JSON.stringify(payload || {})],
  );
  return rows[0];
}

export async function findEventById(id) {
  const { rows } = await query(
    `SELECT id, event_type, audience_user_id, entity_id, payload, created_at
     FROM content_events WHERE id = $1`,
    [id],
  );
  return rows[0] || null;
}

export async function listEvents({ userId = null, after = 0, limit = 50 }) {
  if (after > 0) {
    const { rows } = await query(
      `SELECT id, event_type, entity_id, payload, created_at
       FROM content_events
       WHERE id > $1 AND (audience_user_id IS NULL OR audience_user_id = $2)
       ORDER BY id ASC
       LIMIT $3`,
      [after, userId, limit],
    );
    return rows;
  }

  const { rows } = await query(
    `SELECT * FROM (
       SELECT id, event_type, entity_id, payload, created_at
       FROM content_events
       WHERE audience_user_id IS NULL OR audience_user_id = $1
       ORDER BY id DESC
       LIMIT $2
     ) events
     ORDER BY id ASC`,
    [userId, limit],
  );
  return rows;
}
