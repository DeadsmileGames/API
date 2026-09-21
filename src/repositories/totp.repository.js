import { query } from '../config/database.js';

export async function findTotpByUserId(userId) {
  const { rows } = await query(
    'SELECT user_id, secret, enabled, created_at, updated_at FROM user_totp WHERE user_id = $1',
    [userId],
  );
  return rows[0] || null;
}

export async function upsertTotpSecret(userId, secret) {
  const { rows } = await query(
    `INSERT INTO user_totp (user_id, secret, enabled)
     VALUES ($1, $2, FALSE)
     ON CONFLICT (user_id) DO UPDATE SET secret = EXCLUDED.secret, enabled = FALSE, updated_at = NOW()
     RETURNING user_id, enabled, created_at, updated_at`,
    [userId, secret],
  );
  return rows[0];
}

export async function replaceTotpSecret(userId, expectedSecret, encryptedSecret) {
  await query(
    `UPDATE user_totp SET secret = $3, updated_at = NOW()
     WHERE user_id = $1 AND secret = $2`,
    [userId, expectedSecret, encryptedSecret],
  );
}

export async function enableTotp(userId) {
  const { rows } = await query(
    `UPDATE user_totp SET enabled = TRUE, updated_at = NOW() WHERE user_id = $1 RETURNING user_id, enabled, updated_at`,
    [userId],
  );
  return rows[0];
}

export async function disableTotp(userId) {
  const { rows } = await query(
    `DELETE FROM user_totp WHERE user_id = $1 RETURNING user_id`,
    [userId],
  );
  return rows[0];
}
