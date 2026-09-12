import { query } from '../config/database.js';

export async function createResetToken({ userId, tokenHash, expiresAt }) {
  await query(
    `UPDATE password_resets
        SET used_at = NOW()
      WHERE user_id = $1 AND used_at IS NULL`,
    [userId],
  );

  const { rows } = await query(
    `INSERT INTO password_resets (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, expires_at`,
    [userId, tokenHash, expiresAt],
  );
  return rows[0];
}

export async function findValidByHash(tokenHash) {
  const { rows } = await query(
    `SELECT id, user_id, expires_at, used_at
       FROM password_resets
      WHERE token_hash = $1
      LIMIT 1`,
    [tokenHash],
  );
  const row = rows[0];
  if (!row) return null;
  if (row.used_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return row;
}

export async function markUsed(id) {
  await query(
    `UPDATE password_resets SET used_at = NOW() WHERE id = $1`,
    [id],
  );
}