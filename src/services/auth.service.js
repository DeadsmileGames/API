import { AppError } from '../utils/AppError.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByUsername,
  updateLastLogin,
} from '../repositories/users.repository.js';
import { findTotpByUserId } from '../repositories/totp.repository.js';

const INVALID_CREDENTIALS = 'Invalid email or password.';

const decoyHashPromise = hashPassword(`decoy-${Math.random()}-${Date.now()}`);

export async function registerUser({ username, email, password }) {
  const [existingEmail, existingUsername] = await Promise.all([
    findUserByEmail(email),
    findUserByUsername(username),
  ]);

  if (existingEmail)    throw new AppError(409, 'EMAIL_TAKEN',    'That email is already registered.');
  if (existingUsername) throw new AppError(409, 'USERNAME_TAKEN', 'That username is already taken.');

  const passwordHash = await hashPassword(password);
  const user = await createUser({ username, email, passwordHash });
  return sanitizeUser(user);
}

export async function authenticateUser({ email, password }) {
  const user = await findUserByEmail(email);

  if (!user) {
    const decoyHash = await decoyHashPromise;
    await verifyPassword(decoyHash, password).catch(() => {});
    throw new AppError(401, 'INVALID_CREDENTIALS', INVALID_CREDENTIALS);
  }

  const valid = await verifyPassword(user.password_hash, password);
  if (!valid) throw new AppError(401, 'INVALID_CREDENTIALS', INVALID_CREDENTIALS);
  const totp = await findTotpByUserId(user.id);

  if (totp?.enabled) {
    return { requiresTwoFactor: true, userId: user.id };
  }

  await updateLastLogin(user.id);
  return sanitizeUser(user);
}


export async function completeTwoFactorLogin(userId) {
  const user = await findUserById(userId);
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Account not found.');

  await updateLastLogin(userId);
  const updatedUser = await findUserById(userId);
  return sanitizeUser(updatedUser || user);
}

export function sanitizeUser(user) {
  return {
    id:          user.id,
    email:       user.email,
    username:    user.username,
    role:        user.role,
    avatarUrl:   user.avatar_url    || null,
    bio:         user.bio           || '',
    websiteUrl:  user.website_url   || null,
    location:    user.location      || null,
    createdAt:   user.created_at,
    updatedAt:   user.updated_at,
    lastLoginAt: user.last_login_at,
  };
}
