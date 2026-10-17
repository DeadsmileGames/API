import { Router } from "express";
import rateLimit from "express-rate-limit";
import { validate } from "../middleware/validate.js";
import {
  loginLimiter,
  registerLimiter,
  twoFactorLimiter,
  twoFactorAccountLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  publicEmailLimiter,
} from "../middleware/rateLimiters.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { sendError } from "../utils/apiResponse.js";
import { totpTokenSchema } from "../validators/totp.validators.js";
import {
  registerSchema,
  loginSchema,
  mobileLoginSchema,
  mobileRegisterSchema,
} from "../validators/auth.validators.js";

import {
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validators/password-reset.validators.js";

import {
  register,
  login,
  mobileLogin,
  logout,
  me,
  mobileRegister,
  verifyTwoFactor,
  forgotPassword,
  confirmEmail,
  resendEmail,
  resetPasswordHandler,
} from "../controllers/auth.controller.js";

import {
  emailTokenSchema,
  resendEmailSchema,
} from "../validators/account-email.validators.js";

export const authRouter = Router();
authRouter.use(rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test" || process.env.CI === "true",
    handler: (_req, res) => sendError(res, 429, "RATE_LIMITED"),
  }));
authRouter.post(
  "/confirm-email",
  rateLimit({
    windowMs: 15 * 60_000,
    limit: 6,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test" || process.env.CI === "true",
    handler: (_req, res) => sendError(res, 429, "RATE_LIMITED"),
  }),
  publicEmailLimiter,
  validate(emailTokenSchema),
  confirmEmail,
);

authRouter.post(
  "/resend-email",
  rateLimit({
    windowMs: 15 * 60_000,
    limit: 6,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test" || process.env.CI === "true",
    handler: (_req, res) => sendError(res, 429, "RATE_LIMITED"),
  }),
  publicEmailLimiter,
  validate(resendEmailSchema),
  resendEmail,
);

authRouter.post("/register", rateLimit({
  windowMs: 60 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test" || process.env.CI === "true",
  handler: (_req, res) => sendError(res, 429, "RATE_LIMITED"),
}), registerLimiter, validate(registerSchema), register);
authRouter.post("/login", rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test" || process.env.CI === "true",
  handler: (_req, res) => sendError(res, 429, "RATE_LIMITED"),
}), loginLimiter, validate(loginSchema), login);
authRouter.post("/logout", rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test" || process.env.CI === "true",
  handler: (_req, res) => sendError(res, 429, "RATE_LIMITED"),
}), requireAuth, logout);
authRouter.get("/me", rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test" || process.env.CI === "true",
  handler: (_req, res) => sendError(res, 429, "RATE_LIMITED"),
}), requireAuth, me);
authRouter.post(
  "/verify-2fa",
  rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test" || process.env.CI === "true",
    handler: (_req, res) => sendError(res, 429, "RATE_LIMITED"),
  }),
  twoFactorLimiter,
  twoFactorAccountLimiter,
  validate(totpTokenSchema),
  verifyTwoFactor,
);
authRouter.post("/mobile-login", rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test" || process.env.CI === "true",
  handler: (_req, res) => sendError(res, 429, "RATE_LIMITED"),
}), loginLimiter, validate(mobileLoginSchema), mobileLogin);
authRouter.post(
  "/mobile-register",
  rateLimit({
    windowMs: 60 * 60_000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test" || process.env.CI === "true",
    handler: (_req, res) => sendError(res, 429, "RATE_LIMITED"),
  }),
  registerLimiter,
  validate(mobileRegisterSchema),
  mobileRegister,
);
authRouter.post(
  "/forgot-password",
  rateLimit({
    windowMs: 15 * 60_000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test" || process.env.CI === "true",
    handler: (_req, res) => sendError(res, 429, "RATE_LIMITED"),
  }),
  forgotPasswordLimiter,
  validate(forgotPasswordSchema),
  forgotPassword,
);

authRouter.post(
  "/reset-password",
  rateLimit({
    windowMs: 15 * 60_000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test" || process.env.CI === "true",
    handler: (_req, res) => sendError(res, 429, "RATE_LIMITED"),
  }),
  resetPasswordLimiter,
  validate(resetPasswordSchema),
  resetPasswordHandler,
);
