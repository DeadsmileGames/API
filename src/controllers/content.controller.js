import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import * as service from "../services/content.service.js";
import { getGameLatestNews } from "../services/games.service.js";

export const news = asyncHandler(async (req, res) => {
  const data = await service.getNews(req.query);
  sendSuccess(res, data);
});

export const latestNewsByGame = asyncHandler(async (req, res) => {
  const data = await getGameLatestNews(req.params.slug, req.query);
  sendSuccess(res, data);
});

export const newsDetails = asyncHandler(async (req, res) => {
  const data = await service.getNewsBySlug(req.params.slug);
  sendSuccess(res, data);
});

export const videos = asyncHandler(async (req, res) => {
  const data = await service.getVideos(req.query);
  sendSuccess(res, data);
});

export const premiere = asyncHandler(async (_req, res) => {
  sendSuccess(res, await service.getPremiere());
});

export const videoDetails = asyncHandler(async (req, res) => {
  const data = await service.getVideoById(req.params.id);
  sendSuccess(res, data);
});

export const downloads = asyncHandler(async (req, res) => {
  const data = await service.getDownloads();
  sendSuccess(res, data);
});

export const products = asyncHandler(async (req, res) => {
  const data = await service.getProducts();
  sendSuccess(res, data);
});
