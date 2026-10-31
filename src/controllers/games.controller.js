import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import {
  getGamesList,
  getGameDetails,
  getGameDownload,
  prepareGameDownload,
  getGameLatestNews,
} from "../services/games.service.js";

export const list = asyncHandler(async (req, res) => {
  const data = await getGamesList(req.validatedQuery ?? req.query);
  sendSuccess(res, data);
});

export const details = asyncHandler(async (req, res) => {
  const data = await getGameDetails(req.params.slug, res.locals.locale);
  sendSuccess(res, data);
});

export const download = asyncHandler(async (req, res) => {
  res.set("Cache-Control", "no-store");
  sendSuccess(res, await getGameDownload(req.params.slug, req.session?.userId));
});

export const prepareDownload = asyncHandler(async (req, res) => {
  res.set("Cache-Control", "no-store");
  sendSuccess(res, await prepareGameDownload(req.params.slug, req.session?.userId));
});

export const latestNews = asyncHandler(async (req, res) => {
  sendSuccess(res, await getGameLatestNews(req.params.slug, req.validatedQuery ?? req.query));
});
