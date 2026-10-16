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
  listSoundtrackGames,
} from "../repositories/content.repository.js";
import { findPremiere, getYoutubeDetails, getYoutubeDetailsForVideos, getYoutubeLiveChat, searchSoundtrackVideos } from "./youtube.service.js";

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

export async function getVideoLiveChat(id, language = "en") {
  const item = await findVideo(id);
  if (!item) throw new AppError(404, "VIDEO_NOT_FOUND");
  return getYoutubeLiveChat(item.video_url, language);
}

export async function getPremiere(language = "en") {
  const found = await findPremiere(await listVideos({ limit: 50 }), language);
  if (!found) return { premiere: null };
  const { video, info } = found;
  const localizedThumbnail =
    language === "pt-BR"
      ? video.thumbnail_pt_br
      : language === "es"
        ? video.thumbnail_es
        : video.thumbnail_en;
  return {
    premiere: {
      id: video.id,
      title: info.title || video.title,
      category: video.category,
      video_url: video.video_url,
      thumbnail: localizedThumbnail || info.thumbnail || video.thumbnail,
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


function normalizeSoundtrackMatch(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function soundtrackMentionsGame(video, game) {
  const gameTitle = normalizeSoundtrackMatch(game.title);
  if (!gameTitle) return false;
  return [video.title, video.description].some((value) => {
    const text = ` ${normalizeSoundtrackMatch(value)} `;
    return text.includes(` ${gameTitle} `);
  });
}

export async function getSoundtracks(language = "en") {
  // First search for official-channel soundtrack videos, then associate them with catalog games.
  const videos = await searchSoundtrackVideos(language);
  if (!videos.length) return { groups: [], total: 0 };

  const games = await listSoundtrackGames();
  const groups = new Map();

  for (const video of videos) {
    if (!/\bsoundtracks?\b/i.test(video.title || "")) continue;
    const game = games.find((candidate) => soundtrackMentionsGame(video, candidate));
    if (!game) continue;

    if (!groups.has(String(game.id))) {
      groups.set(String(game.id), {
        gameId: game.id,
        title: game.title,
        slug: game.slug,
        coverImage: game.cover_image || game.hero_image || null,
        videos: [],
      });
    }
    groups.get(String(game.id)).videos.push(video);
  }

  const items = [...groups.values()]
    .map((group) => ({
      ...group,
      videos: group.videos.sort(
        (a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0),
      ),
    }))
    .sort((a, b) => b.videos.length - a.videos.length || a.title.localeCompare(b.title));

  return {
    groups: items,
    total: items.reduce((count, group) => count + group.videos.length, 0),
  };
}
