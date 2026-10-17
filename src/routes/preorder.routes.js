import { Router } from "express";
import rateLimit from "express-rate-limit";
import { sendError } from "../utils/apiResponse.js";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { publicWriteLimiter, publicEmailLimiter } from "../middleware/rateLimiters.js";
import * as controller from "../controllers/preorder.controller.js";
const slug=z.object({slug:z.string().min(2).max(120).regex(/^[a-z0-9-]+$/)}).strict();
const token=z.object({token:z.string().min(32).max(128).regex(/^[A-Za-z0-9_-]+$/)}).strict();
const registration=z.object({firstName:z.string().trim().min(1).max(100),lastName:z.string().trim().min(1).max(100),age:z.coerce.number().int().min(1).max(120),email:z.string().trim().email().max(254),locale:z.enum(["en","pt-BR","es"]).optional()}).strict();
const redeem=z.object({code:z.string().trim().regex(/^\d{6}$/)}).strict();
export const preorderRouter=Router();
preorderRouter.use(rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => sendError(res, 429, "RATE_LIMITED"),
}));
preorderRouter.get("/", rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => sendError(res, 429, "RATE_LIMITED"),
}), controller.listAvailable);
preorderRouter.post("/redeem",publicEmailLimiter,validate(redeem),requireAuth,controller.redeem);
preorderRouter.post("/confirm/:token",publicEmailLimiter,validate(token,"params"),controller.confirm);
preorderRouter.get("/:slug/status",validate(slug,"params"),requireAuth,controller.status);
preorderRouter.get("/:slug/reward/download",validate(slug,"params"),requireAuth,controller.ownerDownload);
preorderRouter.get("/:slug/reward",validate(slug,"params"),requireAuth,controller.ownerReward);
preorderRouter.get("/:slug",validate(slug,"params"),controller.info);
preorderRouter.post("/:slug",publicWriteLimiter,validate(slug,"params"),requireAuth,validate(registration),controller.register);
preorderRouter.delete("/:slug",publicWriteLimiter,validate(slug,"params"),requireAuth,controller.cancel);
preorderRouter.get("/reward/:token/download",validate(token,"params"),requireAuth,controller.download);
preorderRouter.get("/reward/:token",validate(token,"params"),requireAuth,controller.reward);
