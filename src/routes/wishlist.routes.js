import { Router } from "express";
import rateLimit from "express-rate-limit";
import { sendError } from "../utils/apiResponse.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { sendError } from "../utils/apiResponse.js";
import { validate } from "../middleware/validate.js";
import { z } from "zod";
import * as controller from "../controllers/wishlist.controller.js";

const gameBodySchema = z
  .object({
    gameId: z.string().uuid({ message: "gameId must be a valid UUID" }),
  })
  .strict();

const gameParamsSchema = z
  .object({
    gameId: z.string().uuid({ message: "gameId must be a valid UUID" }),
  })
  .strict();

export const wishlistRouter = Router();
wishlistRouter.use(rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => sendError(res, 429, "RATE_LIMITED"),
}), requireAuth);
wishlistRouter.get("/", controller.list);
wishlistRouter.post("/", validate(gameBodySchema), controller.add);
wishlistRouter.delete(
  "/:gameId",
  validate(gameParamsSchema, "params"),
  controller.remove,
);
wishlistRouter.get(
  "/:gameId/check",
  validate(gameParamsSchema, "params"),
  controller.check,
);
