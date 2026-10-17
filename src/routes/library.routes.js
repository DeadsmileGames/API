import { Router } from "express";
import rateLimit from "express-rate-limit";
import { sendError } from "../utils/apiResponse.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { integrationLimiter } from "../middleware/rateLimiters.js";
import { validate } from "../middleware/validate.js";
import { libraryGameSchema } from "../validators/itch-integration.validators.js";
import * as controller from "../controllers/library.controller.js";

export const libraryRouter = Router();

libraryRouter.use(rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => sendError(res, 429, "RATE_LIMITED"),
}), requireAuth);
libraryRouter.get("/", rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => sendError(res, 429, "RATE_LIMITED"),
  }), controller.list);
libraryRouter.get("/catalog", rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => sendError(res, 429, "RATE_LIMITED"),
  }), controller.catalog);
libraryRouter.post("/sync", rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => sendError(res, 429, "RATE_LIMITED"),
  }), integrationLimiter, controller.sync);
libraryRouter.post(
  "/:gameId",
  rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => sendError(res, 429, "RATE_LIMITED"),
  }),
  integrationLimiter,
  validate(libraryGameSchema, "params"),
  controller.add,
);
libraryRouter.delete(
  "/:gameId",
  integrationLimiter,
  validate(libraryGameSchema, "params"),
  controller.remove,
);
libraryRouter.post(
  "/:gameId/verify",
  rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => sendError(res, 429, "RATE_LIMITED"),
  }),
  integrationLimiter,
  validate(libraryGameSchema, "params"),
  controller.verify,
);
libraryRouter.post(
  "/:gameId/install-metadata",
  rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => sendError(res, 429, "RATE_LIMITED"),
  }),
  integrationLimiter,
  validate(libraryGameSchema, "params"),
  controller.installMetadata,
);
