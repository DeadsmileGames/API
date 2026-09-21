import crypto from 'node:crypto';
import { AppError } from '../utils/AppError.js';
import { hashPassword } from '../utils/password.js';
import { findUserByEmail } from '../repositories/users.repository.js';
import {
  consumeResetToken,
  createResetToken,
  deleteExpiredResetTokens,
} from '../repositories/password-resets.repository.js';
import { sendPasswordResetEmail } from './email.service.js';
import { env } from '../config/env.js';

const TOKEN_TTL_MS = 60 * 60 * 1000;
const MIN_RESPONSE_MS = 300;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function requestPasswordReset(email) {
  const startedAt = Date.now();
  const user = await findUserByEmail(email);

  if (Math.random() < 0.02) deleteExpiredResetTokens().catch(() => {});

  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = sha256(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    await createResetToken({ userId: user.id, tokenHash, expiresAt });
    const resetUrl = `${env.frontendUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
    try {
      await sendPasswordResetEmail({
        to: user.email,
        username: user.username,
        resetUrl,
      });
    } catch (error) {
      console.error('Password reset delivery failed', { code: error?.code || null });
    }
  }

  const remaining = MIN_RESPONSE_MS - (Date.now() - startedAt);
  if (remaining > 0) await sleep(remaining);
  return { sent: true };
}

export async function resetPassword({ token, password }) {
  if (!token || typeof token !== 'string') {
    throw new AppError(400, 'INVALID_TOKEN', 'Invalid or expired reset link.');
  }

  const passwordHash = await hashPassword(password);
  const consumed = await consumeResetToken({ tokenHash: sha256(token), passwordHash });
  if (!consumed) {
    throw new AppError(400, 'INVALID_TOKEN', 'Invalid or expired reset link.');
  }
  return { reset: true };
}
