import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { integrationLimiter, searchLimiter } from "../middleware/rateLimiters.js";
import { validate } from "../middleware/validate.js";
import {
  completeItchSchema,
  connectItchSchema,
  itchOAuthFlowSchema,
} from "../validators/itch-integration.validators.js";
import * as controller from "../controllers/itch-integration.controller.js";

export const itchIntegrationRouter = Router();

itchIntegrationRouter.get("/callback", searchLimiter, integrationLimiter, controller.callback);
itchIntegrationRouter.post(
  "/flow",
  searchLimiter,
  integrationLimiter,
  validate(itchOAuthFlowSchema),
  controller.flow,
);
itchIntegrationRouter.post(
  "/complete",
  searchLimiter,
  requireAuth,
  integrationLimiter,
  validate(completeItchSchema),
  controller.complete,
);
itchIntegrationRouter.get("/", searchLimiter, requireAuth, integrationLimiter, controller.status);
itchIntegrationRouter.post(
  "/connect",
  searchLimiter,
  requireAuth,
  integrationLimiter,
  validate(connectItchSchema),
  controller.connect,
);
itchIntegrationRouter.delete("/", searchLimiter, requireAuth, integrationLimiter, controller.disconnect);
