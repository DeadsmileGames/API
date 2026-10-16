import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { searchLimiter } from "../middleware/rateLimiters.js";
import {
  contentIdSchema,
  contentListSchema,
  contentSlugSchema,
} from "../validators/content.validators.js";
import * as controller from "../controllers/content.controller.js";

export const newsRouter = Router();
newsRouter.get("/", validate(contentListSchema, "query"), controller.news);
newsRouter.get("/:slug", validate(contentSlugSchema, "params"), controller.newsDetails);

export const videosRouter = Router();
videosRouter.get("/", validate(contentListSchema, "query"), controller.videos);
videosRouter.get("/premiere", controller.premiere);
videosRouter.get(
  "/:id/live-chat",
  searchLimiter,
  validate(contentIdSchema, "params"),
  controller.videoLiveChat,
);
videosRouter.get("/:id", validate(contentIdSchema, "params"), controller.videoDetails);

export const downloadsRouter = Router();
downloadsRouter.get("/", controller.downloads);

export const productsRouter = Router();
productsRouter.get("/", controller.products);


export const soundtracksRouter = Router();
soundtracksRouter.get("/", controller.soundtracks);
