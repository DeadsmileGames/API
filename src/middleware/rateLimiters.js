import crypto from 'node:crypto';
import net from 'node:net';
import rateLimit from 'express-rate-limit';
import { query } from '../config/database.js';
import { env } from '../config/env.js';
import { sendError } from '../utils/apiResponse.js';

function rateLimitHandler(_req, res) {
  return sendError(res, 429, 'RATE_LIMITED', 'Too many requests. Please slow down and try again shortly.');
}

function requestIp(req) {
  if (process.env.VERCEL) {
    const forwarded = String(req.get('x-vercel-forwarded-for') || req.get('x-forwarded-for') || '')
      .split(',')[0]
      .trim();
    if (net.isIP(forwarded)) return forwarded;
  }
  const direct = String(req.ip || req.socket?.remoteAddress || '').trim();
  return direct || 'unknown';
}

function keyHash(req) {
  return crypto.createHmac('sha256', env.sessionSecret).update(requestIp(req)).digest('hex');
}


function databaseLimiter({ scope, windowMs, limit }) {
  return async function persistentRateLimiter(req, res, next) {
    const now = Date.now();
    const startMs = Math.floor(now / windowMs) * windowMs;
    const windowStart = new Date(startMs);
    const expiresAt = new Date(startMs + windowMs);
    try {
      const { rows } = await query(
        `INSERT INTO api_rate_limits (scope, key_hash, window_start, hits, expires_at)
         VALUES ($1, $2, $3, 1, $4)
         ON CONFLICT (scope, key_hash, window_start) DO UPDATE SET
           hits = api_rate_limits.hits + 1,
           expires_at = EXCLUDED.expires_at
         RETURNING hits`,
        [scope, keyHash(req), windowStart, expiresAt],
      );
      const hits = Number(rows[0]?.hits || 1);
      const remaining = Math.max(0, limit - hits);
      const resetSeconds = Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1_000));
      res.setHeader('RateLimit-Limit', String(limit));
      res.setHeader('RateLimit-Remaining', String(remaining));
      res.setHeader('RateLimit-Reset', String(resetSeconds));
      if (hits > limit) {
        res.setHeader('Retry-After', String(resetSeconds));
        return rateLimitHandler(req, res);
      }
      if (Math.random() < 0.01) {
        query('DELETE FROM api_rate_limits WHERE expires_at < now()').catch(() => {});
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export const loginLimiter = databaseLimiter({ scope: 'login', windowMs: 15 * 60_000, limit: 10 });
export const twoFactorLimiter = databaseLimiter({ scope: 'two-factor', windowMs: 15 * 60_000, limit: 10 });
export const registerLimiter = databaseLimiter({ scope: 'register', windowMs: 60 * 60_000, limit: 10 });
export const publicWriteLimiter = databaseLimiter({ scope: 'public-write', windowMs: 15 * 60_000, limit: 20 });
export const integrationLimiter = databaseLimiter({ scope: 'integration', windowMs: 60_000, limit: 20 });
export const forgotPasswordLimiter = databaseLimiter({ scope: 'forgot-password', windowMs: 15 * 60_000, limit: 5 });
export const resetPasswordLimiter = databaseLimiter({ scope: 'reset-password', windowMs: 15 * 60_000, limit: 5 });
export const publicEmailLimiter = databaseLimiter({
  scope: 'account-email',
  windowMs: 15 * 60_000,
  limit: 6,
});

export const searchLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});
