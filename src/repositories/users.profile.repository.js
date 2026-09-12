import { query } from '../config/database.js';

export async function findPublicProfile(username) {
  const { rows } = await query(
    `SELECT id, username, avatar_url, bio, website_url, location, created_at
     FROM users WHERE username = $1`,
    [username]
  );
  return rows[0] || null;
}

export async function updateProfile(userId, { username, email, bio, websiteUrl, location, avatarUrl }) {
  const { rows } = await query(
    `UPDATE users
     SET username   = $1,
         email      = $2,
         bio        = $3,
         website_url = $4,
         location   = $5,
         avatar_url = $6,
         updated_at = now()
     WHERE id = $7
     RETURNING id, email, username, role, avatar_url, bio, website_url, location,
               created_at, updated_at, last_login_at`,
    [username, email, bio || '', websiteUrl || null, location || null, avatarUrl || null, userId]
  );
  return rows[0] || null;
}
