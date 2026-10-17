import { Router } from "express";
import rateLimit from "express-rate-limit";
import { sendError } from "../utils/apiResponse.js";
import { expectedAccount } from "../middleware/expectedAccount.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { integrationLimiter } from "../middleware/rateLimiters.js";
import { validate } from "../middleware/validate.js";
import * as controller from "../controllers/platform.controller.js";
import {
  achievementSchema,
  consentSchema,
  eventQuerySchema,
  gameIdSchema,
  saveBodySchema,
  saveParamsSchema,
  sessionEndSchema,
  sessionIdSchema,
  sessionStartSchema,
  telemetrySchema,
  pushSubscriptionSchema,
} from "../validators/platform.validators.js";

export const platformRouter = Router();
platformRouter.use(rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test" || process.env.CI === "true",
  handler: (_req, res) => sendError(res, 429, "RATE_LIMITED"),
}));

platformRouter.get("/status", controller.status);
platformRouter.get("/events", validate(eventQuerySchema, "query"), controller.events);
platformRouter.use(requireAuth);
platformRouter.get("/live-ticket", integrationLimiter, controller.liveTicket);
platformRouter.post(
  "/push-subscriptions",
  integrationLimiter,
  validate(pushSubscriptionSchema),
  controller.pushSubscription,
);
platformRouter.delete(
  "/push-subscriptions",
  integrationLimiter,
  validate(pushSubscriptionSchema.pick({ token: true })),
  controller.removePushSubscription,
);
platformRouter.post(
  "/sessions",
  integrationLimiter,
  validate(sessionStartSchema),
  controller.startSession,
);
platformRouter.post(
  "/sessions/:sessionId/end",
  integrationLimiter,
  validate(sessionIdSchema, "params"),
  validate(sessionEndSchema),
  controller.endSession,
);
platformRouter.get(
  "/achievements/:gameId",
  validate(gameIdSchema, "params"),
  controller.achievements,
);
platformRouter.post(
  "/achievements/:gameId/:key/unlock",
  integrationLimiter,
  validate(achievementSchema, "params"),
  expectedAccount,
  controller.unlock,
);
platformRouter.get(
  "/saves/:gameId/:slot",
  integrationLimiter,
  validate(saveParamsSchema, "params"),
  controller.downloadSave,
);
platformRouter.put(
  "/saves/:gameId/:slot",
  integrationLimiter,
  validate(saveParamsSchema, "params"),
  validate(saveBodySchema),
  expectedAccount,
  controller.uploadSave,
);
platformRouter.get("/telemetry-consent", controller.getConsent);
platformRouter.patch("/telemetry-consent", validate(consentSchema), controller.consent);
platformRouter.post(
  "/telemetry",
  integrationLimiter,
  validate(telemetrySchema),
  controller.telemetry,
);
platformRouter.get(
  "/saves/:gameId",
  integrationLimiter,
  validate(gameIdSchema, "params"),
  controller.saves,
);
platformRouter.delete(
  "/saves/:gameId/:slot",
  integrationLimiter,
  validate(saveParamsSchema, "params"),
  controller.deleteSave,
);
