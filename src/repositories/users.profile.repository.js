import { query } from "../config/database.js";

export async function findPublicProfile(username) {
  const { rows } = await query(
    `SELECT
       id,
       username,
       avatar_url,
       bio,
       website_url,
       location,
       profile_banner_url,
       created_at,
       share_playtime
     FROM users
     WHERE LOWER(username) = LOWER($1)
     LIMIT 1`,
    [username],
  );

  return rows[0] || null;
}

export async function updateProfile(
  userId,
  { username, email, bio, websiteUrl, location, avatarUrl, profileBannerUrl },
) {
  const { rows } = await query(
    `UPDATE users
     SET username   = $1,
         email      = $2,
         bio        = $3,
         website_url = $4,
         location   = $5,
         avatar_url = $6,
         profile_banner_url = $7,
         updated_at = now()
     WHERE id = $8
     RETURNING id, email, username, role, avatar_url, bio, website_url, location,
               profile_banner_url, created_at, updated_at, last_login_at`,
    [
      username,
      email,
      bio || "",
      websiteUrl || null,
      location || null,
      avatarUrl || null,
      profileBannerUrl || null,
      userId,
    ],
  );
  return rows[0] || null;
}
