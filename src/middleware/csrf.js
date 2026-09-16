import crypto from 'node:crypto';
import { sendError, sendSuccess } from '../utils/apiResponse.js';
import { env } from '../config/env.js';

const CSRF_COOKIE = 'deadsmile.csrf';
const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_MAX_AGE = 24 * 60 * 60 * 1_000;

function createToken() {
  return crypto.randomBytes(32).toString('hex');
}

function cookieOptions() {
  return {
    httpOnly: false,
    secure: env.isProduction,
    sameSite: env.cookieSameSite,
    maxAge: CSRF_MAX_AGE,
    path: '/',
    partitioned: env.isProduction && env.cookieSameSite === 'none',
  };
}

export function csrfCookie(req, res, next) {
  let token = req.cookies?.[CSRF_COOKIE];
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
    token = createToken();
    res.cookie(CSRF_COOKIE, token, cookieOptions());
    if (!req.cookies) req.cookies = {};
    req.cookies[CSRF_COOKIE] = token;
  }
  res.locals.csrfToken = token;
  next();
}

export function csrfToken(_req, res) {
  res.set('Cache-Control', 'no-store');
  return sendSuccess(res, { token: res.locals.csrfToken });
}

export function verifyCsrf(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get(CSRF_HEADER);
  if (
    !cookieToken
    || !headerToken
    || !/^[a-f0-9]{64}$/i.test(cookieToken)
    || !/^[a-f0-9]{64}$/i.test(headerToken)
  ) {
    return sendError(res, 403, 'CSRF_VALIDATION_FAILED', 'Request could not be verified. Please refresh and try again.');
  }
  const a = Buffer.from(cookieToken, 'hex');
  const b = Buffer.from(headerToken, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return sendError(res, 403, 'CSRF_VALIDATION_FAILED', 'Request could not be verified. Please refresh and try again.');
  }
  next();
}
