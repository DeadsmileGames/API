import rateLimit from 'express-rate-limit';
import { sendError } from '../utils/apiResponse.js';

function rateLimitHandler(_req, res) {
  return sendError(res, 429, 'RATE_LIMITED', 'Too many requests. Please slow down and try again shortly.');
}

export const loginLimiter = rateLimit({
  windowMs:       15 * 60 * 1_000,
  limit:          10,
  standardHeaders: true,
  legacyHeaders:  false,
  handler:        rateLimitHandler,
});

export const twoFactorLimiter = rateLimit({
  windowMs:       15 * 60 * 1_000,
  limit:          10,
  standardHeaders: true,
  legacyHeaders:  false,
  handler:        rateLimitHandler,
});

export const registerLimiter = rateLimit({
  windowMs:       60 * 60 * 1_000,
  limit:          10,
  standardHeaders: true,
  legacyHeaders:  false,
  handler:        rateLimitHandler,
});

export const searchLimiter = rateLimit({
  windowMs:       60 * 1_000,
  limit:          60,
  standardHeaders: true,
  legacyHeaders:  false,
  handler:        rateLimitHandler,
});

export const publicWriteLimiter = rateLimit({
  windowMs:       15 * 60 * 1_000,
  limit:          20,
  standardHeaders: true,
  legacyHeaders:  false,
  handler:        rateLimitHandler,
});

export const integrationLimiter = rateLimit({
  windowMs: 60 * 1_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

export const forgotPasswordLimiter =
  rateLimit({
    windowMs: 15 * 60 * 1_000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
    skipSuccessfulRequests: false,
  });
