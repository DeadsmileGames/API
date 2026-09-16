import { query } from '../config/database.js';

const USER_FIELDS = `
  id, email, username, role,
  avatar_url, bio, website_url, location,
  created_at, updated_at, last_login_at
`;

export async function findUserByEmail(email) {
  const { rows } = await query(
    `SELECT ${USER_FIELDS}, password_hash FROM users WHERE email = $1`,
    [email]
  );
  return rows[0] || null;
}

export async function findUserByUsername(username) {
  const { rows } = await query('SELECT id FROM users WHERE username = $1', [username]);
  return rows[0] || null;
}

export async function findUserById(id) {
  const { rows } = await query(
    `SELECT ${USER_FIELDS} FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function createUser({ username, email, passwordHash }) {
  const { rows } = await query(
    `INSERT INTO users (username, email, password_hash, role)
     VALUES ($1, $2, $3, 'user')
     RETURNING id, email, username, role, created_at, updated_at, last_login_at`,
    [username, email, passwordHash]
  );
  return rows[0];
}

export async function updateLastLogin(userId) {
  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [userId]);
}

export async function upsertAdminUser({ username, email, passwordHash }) {
  const { rows } = await query(
    `INSERT INTO users (username, email, password_hash, role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           role          = 'admin'
     RETURNING id, email, username, role`,
    [username, email, passwordHash]
  );
  return rows[0];
}

export async function deleteUserById(id) {
  const { rows } = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
  return rows[0] || null;
}
