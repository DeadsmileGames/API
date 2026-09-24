import { pool, query } from '../config/database.js';

export async function createPendingEmailToken({
  userId,
  purpose,
  email,
  hash,
  expiresAt,
}) {
  const { rows } = await query(
    `INSERT INTO account_email_tokens
       (user_id, purpose, target_email, token_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5)

     ON CONFLICT (user_id) DO UPDATE SET
       purpose = EXCLUDED.purpose,
       target_email = EXCLUDED.target_email,
       token_hash = EXCLUDED.token_hash,
       expires_at = EXCLUDED.expires_at,
       last_sent_at = now()

     WHERE
       account_email_tokens.last_sent_at <
         now() - interval '60 seconds'
       OR account_email_tokens.expires_at <= now()

     RETURNING user_id`,
    [userId, purpose, email, hash, expiresAt],
  );

  return Boolean(rows[0]);
}

export async function deleteUnsentToken(userId, hash) {
  await query(
    `DELETE FROM account_email_tokens
     WHERE user_id = $1 AND token_hash = $2`,
    [userId, hash],
  );
}

export async function confirmEmailToken(hash) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT user_id, purpose, target_email
       FROM account_email_tokens
       WHERE token_hash = $1
         AND expires_at > now()
       FOR UPDATE`,
      [hash],
    );

    const token = rows[0];

    if (!token) {
      await client.query('ROLLBACK');
      return null;
    }

    const users = await client.query(
      `SELECT id, email, email_verified_at
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [token.user_id],
    );

    const user = users.rows[0];

    if (
      !user ||
      (
        token.purpose === 'register' &&
        (
          user.email !== token.target_email ||
          user.email_verified_at
        )
      )
    ) {
      await client.query('ROLLBACK');
      return null;
    }

    if (
      token.purpose === 'change' &&
      (
        !user.email_verified_at ||
        user.email === token.target_email
      )
    ) {
      await client.query('ROLLBACK');
      return null;
    }

    if (token.purpose === 'register') {
      await client.query(
        `UPDATE users
         SET email_verified_at = now(),
             updated_at = now()
         WHERE id = $1`,
        [user.id],
      );
    } else {
      const conflict = await client.query(
        `SELECT id FROM users
         WHERE email = $1 AND id <> $2`,
        [token.target_email, user.id],
      );

      if (conflict.rows.length) {
        await client.query('ROLLBACK');
        return { conflict: true };
      }

      await client.query(
        `UPDATE users
         SET email = $2,
             email_verified_at = now(),
             updated_at = now()
         WHERE id = $1`,
        [user.id, token.target_email],
      );

      // Invalida links de recuperacao de senha anteriores.
      await client.query(
        `UPDATE password_resets
         SET used_at = now()
         WHERE user_id = $1
           AND used_at IS NULL`,
        [user.id],
      );

      // Encerra as sessoes HTTP existentes.
      await client.query(
        `DELETE FROM user_sessions
         WHERE sess->>'userId' = $1`,
        [String(user.id)],
      );
    }

    // O link nao podera ser utilizado novamente.
    await client.query(
      `DELETE FROM account_email_tokens
       WHERE user_id = $1`,
      [user.id],
    );

    await client.query('COMMIT');

    return {
      purpose: token.purpose,
      oldEmail: user.email,
      newEmail: token.target_email,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}