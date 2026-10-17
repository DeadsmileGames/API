import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/requireAuth.js";
import { integrationLimiter } from "../middleware/rateLimiters.js";
import { validate } from "../middleware/validate.js";
import { sendError } from "../utils/apiResponse.js";
import {
  completeItchSchema,
  connectItchSchema,
  itchOAuthFlowSchema,
} from "../validators/itch-integration.validators.js";
import * as controller from "../controllers/itch-integration.controller.js";

const itchOAuthRouteLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test" || process.env.CI === "true",
  handler: (_req, res) => sendError(res, 429, "RATE_LIMITED"),
});

export const itchIntegrationRouter = Router();
itchIntegrationRouter.use(itchOAuthRouteLimiter);

itchIntegrationRouter.get("/callback", integrationLimiter, controller.callback);
itchIntegrationRouter.post(
  "/flow",
  integrationLimiter,
  validate(itchOAuthFlowSchema),
  controller.flow,
);
itchIntegrationRouter.post(
  "/complete",
  requireAuth,
  integrationLimiter,
  validate(completeItchSchema),
  controller.complete,
);
itchIntegrationRouter.get("/", requireAuth, integrationLimiter, controller.status);
itchIntegrationRouter.post(
  "/connect",
  requireAuth,
  integrationLimiter,
  validate(connectItchSchema),
  controller.connect,
);
itchIntegrationRouter.delete("/", requireAuth, integrationLimiter, controller.disconnect);
