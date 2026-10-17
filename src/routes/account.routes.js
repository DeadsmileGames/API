import { Router } from "express";
import rateLimit from "express-rate-limit";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  updateAccountSchema,
  deleteAccountSchema,
  publicProfileSchema,
} from "../validators/account.validators.js";
import {
  show,
  update,
  remove,
  publicProfile,
  privacy,
  changePrivacy,
  changeEmail,
} from "../controllers/account.controller.js";
import * as totpController from "../controllers/totp.controller.js";
import { totpTokenSchema } from "../validators/totp.validators.js";
import { env } from "../config/env.js";
import { sendError } from "../utils/apiResponse.js";
import { twoFactorLimiter, publicEmailLimiter } from "../middleware/rateLimiters.js";
import {
  changeEmailSchema,
  privacySchema,
} from "../validators/account-email.validators.js";
import { listSessions, revokeSession } from "../controllers/sessions.controller.js";

function trustedFrontendOrigin(req, res, next) {
  const origin = req.get("origin");
  const referer = req.get("referer");
  let refererOrigin = null;
  if (referer) {
    try {
      refererOrigin = new URL(referer).origin;
    } catch {
      refererOrigin = null;
    }
  }
  if (origin === env.frontendUrl || refererOrigin === env.frontendUrl) return next();
  return sendError(res, 403, "TRUSTED_ORIGIN_REQUIRED");
}

export const accountRouter = Router();
accountRouter.use(rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test" || process.env.CI === "true",
  handler: (_req, res) => sendError(res, 429, "RATE_LIMITED"),
}));

accountRouter.post(
  "/email/change",
  requireAuth,
  publicEmailLimiter,
  validate(changeEmailSchema),
  changeEmail,
);
accountRouter.get("/privacy", requireAuth, privacy);

accountRouter.put("/privacy", requireAuth, validate(privacySchema), changePrivacy);
accountRouter.get("/sessions", requireAuth, listSessions);

accountRouter.delete("/sessions/:deviceId", requireAuth, revokeSession);
accountRouter.get(
  "/profile/:username",
  validate(publicProfileSchema, "params"),
  publicProfile,
);
accountRouter.get("/", requireAuth, show);
accountRouter.patch("/", requireAuth, validate(updateAccountSchema), update);
accountRouter.delete("/", requireAuth, validate(deleteAccountSchema), remove);
accountRouter.get("/totp/status", rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test" || process.env.CI === "true",
    handler: (_req, res) => sendError(res, 429, "RATE_LIMITED"),
  }), requireAuth, totpController.status);
accountRouter.get(
  "/totp/setup",
  requireAuth,
  trustedFrontendOrigin,
  totpController.setup,
);
accountRouter.post("/totp/setup", rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test" || process.env.CI === "true",
    handler: (_req, res) => sendError(res, 429, "RATE_LIMITED"),
  }), requireAuth, twoFactorLimiter, totpController.setup);
accountRouter.post(
  "/totp/enable",
  requireAuth,
  rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test" || process.env.CI === "true",
    handler: (_req, res) => sendError(res, 429, "RATE_LIMITED"),
  }),
  twoFactorLimiter,
  validate(totpTokenSchema),
  totpController.enable,
);
accountRouter.delete(
  "/totp/disable",
  requireAuth,
  rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test" || process.env.CI === "true",
    handler: (_req, res) => sendError(res, 429, "RATE_LIMITED"),
  }),
  twoFactorLimiter,
  validate(totpTokenSchema),
  totpController.disable,
);
