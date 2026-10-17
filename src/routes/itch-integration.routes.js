import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/requireAuth.js";
import { integrationLimiter } from "../middleware/rateLimiters.js";
import { validate } from "../middleware/validate.js";
import { sendError } from "../utils/apiResponse.js";
import {
  completeItchSchema,
  connectItchSchema,
} from "../validators/itch-integration.validators.js";
import * as controller from "../controllers/itch-integration.controller.js";

export const itchIntegrationRouter = Router();
itchIntegrationRouter.use(rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => sendError(res, 429, "RATE_LIMITED"),
}));

itchIntegrationRouter.get("/callback", controller.callback);
itchIntegrationRouter.post(
  "/complete",
  integrationLimiter,
  validate(completeItchSchema),
  controller.complete,
);
itchIntegrationRouter.get("/", requireAuth, controller.status);
itchIntegrationRouter.post(
  "/connect",
  requireAuth,
  integrationLimiter,
  validate(connectItchSchema),
  controller.connect,
);
itchIntegrationRouter.delete("/", requireAuth, integrationLimiter, controller.disconnect);
