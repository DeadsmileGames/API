import crypto from "node:crypto";
import { sendError, sendSuccess } from "../utils/apiResponse.js";
import { env } from "../config/env.js";

const CSRF_COOKIE = "deadsmile.csrf";
const CSRF_HEADER = "x-csrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_MAX_AGE = 24 * 60 * 60 * 1_000;

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.cookieSameSite,
    maxAge: CSRF_MAX_AGE,
    path: "/",
    signed: true,
    partitioned: env.isProduction && env.cookieSameSite === "none",
  };
}

export function csrfCookie(req, res, next) {
  let token = req.signedCookies?.[CSRF_COOKIE];
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
    token = createToken();
    res.cookie(CSRF_COOKIE, token, cookieOptions());
    if (!req.signedCookies) req.signedCookies = {};
    req.signedCookies[CSRF_COOKIE] = token;
  }

  const needsSessionBinding = req.path === "/api/csrf" || !SAFE_METHODS.has(req.method);
  if (needsSessionBinding && req.session && req.session.csrfToken !== token) {
    req.session.csrfToken = token;
  }

  res.locals.csrfToken = token;
  next();
}

export function csrfToken(_req, res) {
  res.set("Cache-Control", "no-store");
  return sendSuccess(res, { token: res.locals.csrfToken });
}

export function verifyCsrf(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  if (req.get("sec-fetch-site")?.toLowerCase() === "cross-site") {
    const origin = req.get("origin");
    let trustedOrigin = false;
    try {
      trustedOrigin = Boolean(origin) && env.frontendOrigins.includes(new URL(origin).origin);
    } catch {
      trustedOrigin = false;
    }
    if (!trustedOrigin) return sendError(res, 403, "CSRF_VALIDATION_FAILED");
  }

  const cookieToken = req.signedCookies?.[CSRF_COOKIE];
  const headerToken = req.get(CSRF_HEADER);
  const sessionToken = req.session?.csrfToken;
  if (
    !cookieToken ||
    !headerToken ||
    !sessionToken ||
    !/^[a-f0-9]{64}$/i.test(cookieToken) ||
    !/^[a-f0-9]{64}$/i.test(headerToken) ||
    !/^[a-f0-9]{64}$/i.test(sessionToken) ||
    sessionToken !== cookieToken
  ) {
    return sendError(res, 403, "CSRF_VALIDATION_FAILED");
  }

  const cookieBytes = Buffer.from(cookieToken, "hex");
  const headerBytes = Buffer.from(headerToken, "hex");
  const sessionBytes = Buffer.from(sessionToken, "hex");
  if (
    cookieBytes.length !== headerBytes.length ||
    !crypto.timingSafeEqual(cookieBytes, headerBytes) ||
    sessionBytes.length !== headerBytes.length ||
    !crypto.timingSafeEqual(sessionBytes, headerBytes)
  ) {
    return sendError(res, 403, "CSRF_VALIDATION_FAILED");
  }
  next();
}
