import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import {
  registerUser,
  authenticateUser,
  completeTwoFactorLogin,
} from "../services/auth.service.js";

import {
  requestPasswordReset,
  resetPassword,
} from "../services/password-reset.service.js";

import { verifyRecaptcha } from "../services/recaptcha.service.js";

import { getAccount } from "../services/account.service.js";

import { env } from "../config/env.js";

import { verifyTotpLogin } from "../services/totp.service.js";

import { AppError } from "../utils/AppError.js";

const TWO_FACTOR_CHALLENGE_TTL_MS = 5 * 60 * 1000;

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

function destroySession(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

export const verifyTwoFactor = asyncHandler(async (req, res) => {
  const { token } = req.body;

  const pendingUserId = req.session?.pendingTwoFactorUserId;
  const expiresAt = req.session?.pendingTwoFactorExpiresAt;

  if (!pendingUserId || !expiresAt || Date.now() >= expiresAt) {
    throw new AppError(
      401,
      "TWO_FACTOR_CHALLENGE_EXPIRED",
      "Your 2FA sign-in request has expired. Please sign in again.",
    );
  }

  const valid = await verifyTotpLogin(pendingUserId, token);

  if (!valid) {
    throw new AppError(400, "INVALID_TOTP", "Invalid 2FA code.");
  }
  const account = await completeTwoFactorLogin(pendingUserId);
  await regenerateSession(req);

  req.session.userId = account.id;
  req.session.role = account.role;

  return sendSuccess(res, account);
});

export const register = asyncHandler(async (req, res) => {
  const user = await registerUser(req.body);
  await regenerateSession(req);

  req.session.userId = user.id;
  req.session.role = user.role;

  return sendSuccess(res, user, 201);
});

export const login = asyncHandler(async (req, res) => {
  const { email, password, recaptchaToken } = req.body;
  await verifyRecaptcha(recaptchaToken, req.ip);

  const result = await authenticateUser({
    email,
    password,
  });
  if (result.requiresTwoFactor) {
    await regenerateSession(req);

    req.session.pendingTwoFactorUserId = result.userId;

    req.session.pendingTwoFactorExpiresAt =
      Date.now() + TWO_FACTOR_CHALLENGE_TTL_MS;

    return sendSuccess(res, {
      requiresTwoFactor: true,
    });
  }
  await regenerateSession(req);

  req.session.userId = result.id;
  req.session.role = result.role;

  return sendSuccess(res, result);
});

export const logout = asyncHandler(async (req, res) => {
  await destroySession(req);

  res.clearCookie("deadsmile.sid", {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.cookieSameSite,
    path: "/",
  });

  return sendSuccess(res, {
    loggedOut: true,
  });
});

async function performLogin(req, res, { requireRecaptcha = false } = {}) {
  const { email, password, recaptchaToken } = req.body;

  if (requireRecaptcha) {
    await verifyRecaptcha(recaptchaToken, req.ip);
  }

  const result = await authenticateUser({
    email,
    password,
  });

  if (result.requiresTwoFactor) {
    await regenerateSession(req);

    req.session.pendingTwoFactorUserId = result.userId;

    req.session.pendingTwoFactorExpiresAt =
      Date.now() + TWO_FACTOR_CHALLENGE_TTL_MS;

    return sendSuccess(res, {
      requiresTwoFactor: true,
    });
  }

  await regenerateSession(req);

  req.session.userId = result.id;
  req.session.role = result.role;

  return sendSuccess(res, result);
}

export const mobileLogin = asyncHandler(async (req, res) => {
  return performLogin(req, res, {
    requireRecaptcha: false,
  });
});

export const mobileRegister = asyncHandler(async (req, res) => {
  const user = await registerUser(req.body);
  await regenerateSession(req);
  req.session.userId = user.id;
  req.session.role = user.role;
  return sendSuccess(res, user, 201);
});

export const me = asyncHandler(async (req, res) => {
  const user = await getAccount(req.session.userId);

  return sendSuccess(res, user);
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email, recaptchaToken } = req.body;
  await verifyRecaptcha(recaptchaToken, req.ip);
  await requestPasswordReset(email);
  return sendSuccess(res, { sent: true });
});

export const resetPasswordHandler = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const result = await resetPassword({ token, password });
  return sendSuccess(res, result);
});