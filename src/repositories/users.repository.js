import { pool, query } from "../config/database.js";

const USER_FIELDS = `
  id, email, username, role,
  avatar_url, bio, website_url, location, profile_banner_url,
  created_at, updated_at, last_login_at,
  email_verified_at,
  share_game_activity,
  share_playtime,
  share_achievements
`;

export async function findUserByEmail(email) {
  const { rows } = await query(
    `SELECT ${USER_FIELDS}, password_hash FROM users WHERE email = $1`,
    [email],
  );
  return rows[0] || null;
}

export async function findUserByUsername(username) {
  const { rows } = await query("SELECT id FROM users WHERE LOWER(username) = LOWER($1)", [
    username,
  ]);
  return rows[0] || null;
}

export async function findUserById(id) {
  const { rows } = await query(`SELECT ${USER_FIELDS} FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
}

export async function createUser({ username, email, passwordHash, legalAcceptance }) {
  if (
    legalAcceptance?.termsVersion !== "2026-10" ||
    legalAcceptance?.privacyVersion !== "2026-10" ||
    !["en", "pt-BR", "es"].includes(legalAcceptance?.locale)
  ) {
    throw new Error("Registration requires the current legal acceptance record.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, 'user')
       RETURNING id, email, username, role, created_at, updated_at, last_login_at`,
      [username.toLowerCase(), email, passwordHash],
    );
    await client.query(
      `INSERT INTO user_legal_acceptances (user_id, terms_version, privacy_version, locale)
       VALUES ($1, $2, $3, $4)`,
      [rows[0].id, legalAcceptance.termsVersion, legalAcceptance.privacyVersion, legalAcceptance.locale],
    );
    await client.query("COMMIT");
    return rows[0];
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function updateLastLogin(userId) {
  await query("UPDATE users SET last_login_at = now() WHERE id = $1", [userId]);
}

export async function upsertAdminUser({ username, email, passwordHash }) {
  const { rows } = await query(
    `INSERT INTO users (username, email, password_hash, role, email_verified_at)
     VALUES ($1, $2, $3, 'admin', now())
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           role          = 'admin',
           email_verified_at = COALESCE(users.email_verified_at, now())
     RETURNING id, email, username, role`,
    [username.toLowerCase(), email, passwordHash],
  );
  return rows[0];
}
