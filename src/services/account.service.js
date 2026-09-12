import { AppError } from '../utils/AppError.js';
import { findUserById, findUserByUsername } from '../repositories/users.repository.js';
import { updateProfile, findPublicProfile } from '../repositories/users.profile.repository.js';
import { query } from '../config/database.js';
import { verifyPassword } from '../utils/password.js';
import { sanitizeUser } from './auth.service.js';

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

  return {
    id:         user.id,
    username:   user.username,
    avatarUrl:  user.avatar_url  || null,
    bio:        user.bio         || '',
    websiteUrl: user.website_url || null,
    location:   user.location    || null,
    createdAt:  user.created_at,
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

  await query('DELETE FROM users WHERE id = $1', [userId]);
}
