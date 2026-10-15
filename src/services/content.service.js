import { sanitizeContent } from "../utils/contentHtml.js";
import { AppError } from "../utils/AppError.js";
import { findGameBySlug } from "../repositories/games.repository.js";
import { getYoutubeVideoId, getYoutubeMetadata } from "./youtube-metadata.service.js";
import {
  listNews,
  listLatestNewsByGameSlug,
  findNews,
  listVideos,
  findVideo,
  listDownloads,
  listProducts,
} from "../repositories/content.repository.js";

export async function getNews(query) {
  return listNews(query);
}

export async function getLatestNewsByGameSlug(slug) {
  const game = await findGameBySlug(slug);
  if (!game) throw new AppError(404, "GAME_NOT_FOUND");
  return listLatestNewsByGameSlug(slug);
}

export async function getNewsBySlug(slug) {
  const item = await findNews(slug);
  if (!item) throw new AppError(404, "NEWS_NOT_FOUND");
  return { ...item, body: sanitizeContent(item.body) };
}

async function enrichVideos(items) {
  const metadata = await getYoutubeMetadata(items.map((item) => item.video_url));
  return items.map((item) => {
    const youtubeId = getYoutubeVideoId(item.video_url);
    const video = youtubeId ? metadata.get(youtubeId) || {} : {};
    return {
      ...item,
      youtube_id: youtubeId,
      youtube_title: video.title || null,
      youtube_description: video.description || null,
      youtube_published_at: video.publishedAt || null,
      youtube_thumbnail: video.thumbnail || null,
      premiere_at: video.premiereAt || null,
      actual_start_time: video.actualStartTime || null,
      is_premiere: Boolean(video.isPremiere),
      broadcast_status: video.broadcastStatus || "none",
    };
  });
}

export async function getVideos(query) {
  return enrichVideos(await listVideos(query));
}

export async function getVideoById(id) {
  const item = await findVideo(id);
  if (!item) throw new AppError(404, "VIDEO_NOT_FOUND");
  return (await enrichVideos([item]))[0];
}

export async function getDownloads() {
  return listDownloads();
}

export async function getProducts() {
  return listProducts();
}
