import { sanitizeContent } from "../utils/contentHtml.js";
import { AppError } from "../utils/AppError.js";
import {
  listNews,
  findNews,
  listVideos,
  findVideo,
  listDownloads,
  listProducts,
  listGameScreenshots,
} from "../repositories/content.repository.js";
import { findPremiere, getYoutubeDetails, getYoutubeDetailsForVideos } from "./youtube.service.js";

export async function getNews(query) {
  return listNews(query);
}

export async function getNewsBySlug(slug) {
  const item = await findNews(slug);
  if (!item) throw new AppError(404, "NEWS_NOT_FOUND");
  return { ...item, body: sanitizeContent(item.body) };
}

export async function getVideos(query, language = "en") {
  return getYoutubeDetailsForVideos(await listVideos(query), language);
}

export async function getVideoById(id, language = "en") {
  const item = await findVideo(id);
  if (!item) throw new AppError(404, "VIDEO_NOT_FOUND");
  return { ...item, youtube: await getYoutubeDetails(item.video_url, language) };
}

export async function getPremiere(language = "en") {
  const found = await findPremiere(await listVideos({ limit: 50 }), language);
  if (!found) return { premiere: null };
  const { video, info } = found;
  return {
    premiere: {
      id: video.id,
      title: info.title || video.title,
      category: video.category,
      video_url: video.video_url,
      thumbnail: info.thumbnail || video.thumbnail,
      description: info.description || "",
      published_at: info.publishedAt || video.published_at,
      state: info.state,
      starts_at: info.startsAt,
      actual_started_at: info.actualStartedAt,
      game_id: video.game_id,
      game_title: video.game_title,
      game_slug: video.game_slug,
      screenshots: video.game_id ? await listGameScreenshots(video.game_id) : [],
    },
  };
}

export async function getDownloads() {
  return listDownloads();
}

export async function getProducts() {
  return listProducts();
}
