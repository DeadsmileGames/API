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
import { findPremiere, getYoutubeDetails } from "./youtube.service.js";

export async function getNews(query) {
  return listNews(query);
}

export async function getNewsBySlug(slug) {
  const item = await findNews(slug);
  if (!item) throw new AppError(404, "NEWS_NOT_FOUND");
  return { ...item, body: sanitizeContent(item.body) };
}

export async function getVideos(query) {
  return listVideos(query);
}

export async function getVideoById(id) {
  const item = await findVideo(id);
  if (!item) throw new AppError(404, "VIDEO_NOT_FOUND");
  return { ...item, youtube: await getYoutubeDetails(item.video_url) };
}

export async function getPremiere() {
  const found = await findPremiere(await listVideos({ limit: 12 }));
  if (!found) return { premiere: null };
  const { video, info } = found;
  return {
    premiere: {
      id: video.id,
      title: video.title,
      video_url: video.video_url,
      thumbnail: video.thumbnail,
      state: info.state,
      starts_at: info.startsAt,
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
