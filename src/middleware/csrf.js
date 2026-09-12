import crypto from 'node:crypto';

import { sendError, sendSuccess } from '../utils/apiResponse.js';
import { env } from '../config/env.js';

const CSRF_COOKIE = 'deadsmile.csrf';
const CSRF_HEADER = 'x-csrf-token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const CSRF_MAX_AGE = 60 * 60 * 24;

function createToken() {
  return crypto.randomBytes(32).toString('hex');
}

function cookieOptions() {
  return {
    httpOnly: false,
    secure: env.isProduction,
    sameSite: env.isProduction ? 'none' : 'lax',
    maxAge: CSRF_MAX_AGE,
    path: '/',
    partitioned: env.isProduction,
  };
}

export function csrfCookie(req, res, next) {
  let token = req.cookies?.[CSRF_COOKIE];

  if (!token) {
    token = createToken();

    res.cookie(
      CSRF_COOKIE,
      token,
      cookieOptions()
    );

    if (!req.cookies) {
      req.cookies = {};
    }

    req.cookies[CSRF_COOKIE] = token;
  }

  res.locals.csrfToken = token;

  next();
}

export function csrfToken(_req, res) {
  return sendSuccess(res, {
    token: res.locals.csrfToken,
  });
}

export function verifyCsrf(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get(CSRF_HEADER);

  if (!cookieToken || !headerToken) {
    return sendError(
      res,
      403,
      'CSRF_VALIDATION_FAILED',
      'Request could not be verified. Please refresh and try again.'
    );
  }

  const a = Buffer.from(cookieToken);
  const b = Buffer.from(headerToken);

  if (
    a.length !== b.length ||
    !crypto.timingSafeEqual(a, b)
  ) {
    return sendError(
      res,
      403,
      'CSRF_VALIDATION_FAILED',
      'Request could not be verified. Please refresh and try again.'
    );
  }

  next();
}