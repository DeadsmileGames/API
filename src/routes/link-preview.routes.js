import { Router } from "express";
import { searchLimiter } from "../middleware/rateLimiters.js";
import { sendError, sendSuccess } from "../utils/apiResponse.js";
import { getPageTitle, normalizePreviewUrl } from "../utils/linkPreview.js";

export const linkPreviewRouter = Router();

linkPreviewRouter.get("/", searchLimiter, async (req, res) => {
  const input = typeof req.query.url === "string" ? req.query.url : "";
  const url = normalizePreviewUrl(input);
  if (!url) return sendError(res, 400, "INVALID_REQUEST");

  const preview = await getPageTitle(url.href);
  res.set("Cache-Control", "public, max-age=3600");
  return sendSuccess(res, preview);
});
