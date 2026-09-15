import { AppError } from '../utils/AppError.js';
import { findUserById, findUserByUsername } from '../repositories/users.repository.js';
import { updateProfile, findPublicProfile } from '../repositories/users.profile.repository.js';
import { pool, query } from '../config/database.js';
import { verifyPassword } from '../utils/password.js';
import { sanitizeUser } from './auth.service.js';
import { publicAchievements, publicActivity } from '../repositories/platform.repository.js';

export async function getAccount(userId) {
  const user = await findUserById(userId);
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Account not found.');
  return sanitizeUser(user);
}

export async function updateAccount(userId, payload) {
  const current = await findUserById(userId);
  if (!current) throw new AppError(404, 'USER_NOT_FOUND', 'Account not found.');

  if (payload.username && payload.username !== current.username) {
    const existing = await findUserByUsername(payload.username);
    if (existing && existing.id !== userId) {
      throw new AppError(409, 'USERNAME_TAKEN', 'That username is already taken.');
    }
  }

  if (payload.email && payload.email !== current.email) {
    const { rows } = await query(
      'SELECT id FROM users WHERE email = $1 AND id <> $2',
      [payload.email, userId]
    );
    if (rows[0]) throw new AppError(409, 'EMAIL_TAKEN', 'That email is already registered.');
  }

  const updated = await updateProfile(userId, {
    username:   payload.username   || current.username,
    email:      payload.email      || current.email,
    bio:        payload.bio        ?? current.bio,
    websiteUrl: payload.websiteUrl ?? current.website_url,
    location:   payload.location   ?? current.location,
    avatarUrl:  payload.avatarUrl  ?? current.avatar_url,
  });

  return sanitizeUser(updated);
}

export async function getPublicProfile(username) {
  const user = await findPublicProfile(username);
  if (!user) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found.');

  const [recentGames, achievements] = await Promise.all([
    publicActivity(user.id),
    publicAchievements(user.id),
  ]);

  return {
    id:         user.id,
    username:   user.username,
    avatarUrl:  user.avatar_url  || null,
    bio:        user.bio         || '',
    websiteUrl: user.website_url || null,
    location:   user.location    || null,
    createdAt:  user.created_at,
    recentGames: recentGames.map((item) => ({
      id: item.id,
      title: item.title,
      slug: item.slug,
      coverImage: item.cover_image,
      heroImage: item.hero_image,
      purchaseUrl: item.purchase_url,
      totalMs: Number(item.total_ms),
      sessions: item.sessions,
      lastPlayedAt: item.last_played_at,
      screenshots: item.screenshots.map((shot) => shot.url),
    })),
    achievements: achievements.map((item) => ({
      key: item.key,
      title: item.title,
      description: item.description,
      iconUrl: item.icon_url,
      points: item.points,
      unlockedAt: item.unlocked_at,
      gameTitle: item.game_title,
      gameSlug: item.game_slug,
    })),
  };
}

export async function deleteAccount(userId, password) {
  const { rows } = await query(
    'SELECT id, password_hash FROM users WHERE id = $1',
    [userId]
  );
  const user = rows[0];
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Account not found.');

  const valid = await verifyPassword(user.password_hash, password);
  if (!valid) throw new AppError(401, 'INVALID_PASSWORD', 'Current password is incorrect.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM user_sessions WHERE sess->>'userId' = $1`, [String(userId)]);
    await client.query('DELETE FROM users WHERE id = $1', [userId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
