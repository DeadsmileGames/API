import { pool, query } from '../config/database.js';

export async function createResetToken({ userId, tokenHash, expiresAt }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE password_resets
       SET used_at = NOW()
       WHERE user_id = $1 AND used_at IS NULL`,
      [userId],
    );
    const { rows } = await client.query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, expires_at`,
      [userId, tokenHash, expiresAt],
    );
    await client.query('COMMIT');
    return rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function consumeResetToken({ tokenHash, passwordHash }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT id, user_id, expires_at, used_at
       FROM password_resets
       WHERE token_hash = $1
       FOR UPDATE`,
      [tokenHash],
    );
    const record = rows[0];
    if (!record || record.used_at || new Date(record.expires_at).getTime() <= Date.now()) {
      await client.query('ROLLBACK');
      return null;
    }

    const userResult = await client.query(
      `UPDATE users
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id`,
      [passwordHash, record.user_id],
    );
    if (!userResult.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query(
      'DELETE FROM account_email_tokens WHERE user_id = $1',
      [record.user_id],
    );
    await client.query(`DELETE FROM user_sessions WHERE sess->>'userId' = $1`, [String(record.user_id)]);
    await client.query('COMMIT');
    return { userId: record.user_id };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteExpiredResetTokens() {
  await query(
    `DELETE FROM password_resets
     WHERE expires_at < NOW() - interval '24 hours'
        OR used_at < NOW() - interval '24 hours'`,
  );
}
