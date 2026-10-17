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
  integrationLimiter,
  authenticatedApiLimiter,
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
  mobileToken,
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
authRouter.use(authenticatedApiLimiter);
authRouter.post(
  "/confirm-email",
  publicEmailLimiter,
  validate(emailTokenSchema),
  confirmEmail,
);

authRouter.post(
  "/resend-email",
  publicEmailLimiter,
  validate(resendEmailSchema),
  resendEmail,
);

authRouter.post("/register", registerLimiter, validate(registerSchema), register);
authRouter.post("/login", loginLimiter, validate(loginSchema), login);
authRouter.post("/logout", requireAuth, logout);
authRouter.get("/me", requireAuth, me);
authRouter.post(
  "/verify-2fa",
  twoFactorLimiter,
  twoFactorAccountLimiter,
  validate(totpTokenSchema),
  verifyTwoFactor,
);
authRouter.post("/mobile-login", loginLimiter, validate(mobileLoginSchema), mobileLogin);
authRouter.post(
  "/mobile-token",
  rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => sendError(res, 429, "RATE_LIMITED"),
  }),
  requireAuth,
  integrationLimiter,
  mobileToken,
);
authRouter.post(
  "/mobile-register",
  registerLimiter,
  validate(mobileRegisterSchema),
  mobileRegister,
);
authRouter.post(
  "/forgot-password",
  forgotPasswordLimiter,
  validate(forgotPasswordSchema),
  forgotPassword,
);

authRouter.post(
  "/reset-password",
  resetPasswordLimiter,
  validate(resetPasswordSchema),
  resetPasswordHandler,
);
