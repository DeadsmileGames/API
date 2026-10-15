import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { youtubeVideoId } from "../utils/youtube.js";

const CACHE_MS = 60_000;
const PREMIERE_WINDOW_MS = 24 * 60 * 60 * 1000;
const PREMIERE_START_GRACE_MS = 10 * 60 * 1000;
const cache = new Map();

function toDetails(item) {
  const snippet = item.snippet || {};
  const localized = snippet.localized || {};
  const live = item.liveStreamingDetails || {};
  const thumbnails = snippet.thumbnails || {};
  return {
    title: localized.title || snippet.title || "",
    description: localized.description ?? snippet.description ?? "",
    defaultLanguage: snippet.defaultLanguage || null,
    defaultAudioLanguage: snippet.defaultAudioLanguage || null,
    publishedAt: snippet.publishedAt || null,
    thumbnail:
      thumbnails.maxres?.url ||
      thumbnails.standard?.url ||
      thumbnails.high?.url ||
      thumbnails.medium?.url ||
      thumbnails.default?.url ||
      null,
    state: snippet.liveBroadcastContent || "none",
    startsAt: live.scheduledStartTime || live.actualStartTime || null,
    actualStartedAt: live.actualStartTime || null,
  };
}

function normalizeLanguage(language) {
  return ["pt-BR", "es", "en"].includes(language) ? language : "en";
}

async function fetchDetails(ids, language = "en") {
  const locale = normalizeLanguage(language);
  const uniqueIds = [...new Set(ids.filter(Boolean))].slice(0, 50);
  if (!env.youtubeApiKey || !uniqueIds.length) return new Map();
  const cacheKey = (id) => `${locale}:${id}`;
  const now = Date.now();
  const missing = uniqueIds.filter((id) => !(cache.get(cacheKey(id))?.expires > now));
  if (missing.length) {
    const entries = new Map(missing.map((id) => [id, null]));
    try {
      const params = new URLSearchParams({
        part: "snippet,liveStreamingDetails",
        id: missing.join(","),
        hl: locale,
        key: env.youtubeApiKey,
      });
      const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`, {
        signal: AbortSignal.timeout(8_000),
      });
      if (response.ok) {
        for (const item of (await response.json()).items || []) {
          entries.set(item.id, toDetails(item));
        }
      }
    } catch {}
    const expires = Date.now() + CACHE_MS;
    for (const [id, value] of entries) cache.set(cacheKey(id), { expires, value });
  }
  return new Map(uniqueIds.map((id) => [id, cache.get(cacheKey(id))?.value ?? null]));
}

export async function getYoutubeDetails(videoUrl, language = "en") {
  const id = youtubeVideoId(videoUrl);
  return id ? (await fetchDetails([id], language)).get(id) ?? null : null;
}

export async function getYoutubeDetailsForVideos(videos, language = "en") {
  const ids = videos.map((video) => youtubeVideoId(video.video_url));
  const details = await fetchDetails(ids, language);
  return videos.map((video, index) => ({
    ...video,
    youtube: ids[index] ? details.get(ids[index]) ?? null : null,
  }));
}

export async function findPremiere(videos, language = "en") {
  const ids = videos.map((video) => youtubeVideoId(video.video_url));
  const details = await fetchDetails(ids, language);
  const now = Date.now();
  return (
    videos
      .map((video, index) => ({ video, info: details.get(ids[index]) }))
      .filter(({ info }) => {
        if (!info?.startsAt || !Number.isFinite(Date.parse(info.startsAt))) return false;
        const scheduled = Date.parse(info.startsAt);
        if (info.state === "upcoming") {
          const difference = scheduled - now;
          return difference <= PREMIERE_WINDOW_MS && difference >= -PREMIERE_START_GRACE_MS;
        }
        if (info.state === "live") {
          const started = Date.parse(info.actualStartedAt || info.startsAt);
          return Number.isFinite(started) && now >= started && now - started <= PREMIERE_WINDOW_MS;
        }
        return false;
      })
      .sort((a, b) => Date.parse(a.info.startsAt) - Date.parse(b.info.startsAt))[0] || null
  );
}


const SOUNDTRACK_CACHE_MS = 20 * 60 * 1000;
const soundtrackCache = new Map();

export async function searchSoundtrackVideos(language = "en") {
  const locale = normalizeLanguage(language);
  const cached = soundtrackCache.get(locale);
  if (cached && cached.expires > Date.now()) return cached.items;

  if (!env.youtubeApiKey) {
    soundtrackCache.set(locale, { expires: Date.now() + SOUNDTRACK_CACHE_MS, items: [] });
    return [];
  }

  const params = new URLSearchParams({
    part: "snippet",
    q: "soundtrack",
    type: "video",
    maxResults: "50",
    order: "relevance",
    hl: locale,
    relevanceLanguage: locale === "pt-BR" ? "pt" : locale,
    key: env.youtubeApiKey,
  });

  let data;
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params}`,
      { signal: AbortSignal.timeout(8_000) },
    );
    if (!response.ok) throw new AppError(503, "YOUTUBE_UNAVAILABLE");
    data = await response.json();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(503, "YOUTUBE_UNAVAILABLE");
  }

  const searchItems = (Array.isArray(data?.items) ? data.items : [])
    .map((item) => {
      const snippet = item?.snippet || {};
      const id = item?.id?.videoId;
      const thumbnails = snippet.thumbnails || {};
      return {
        id: typeof id === "string" ? id : "",
        title: typeof snippet.title === "string" ? snippet.title : "",
        description: typeof snippet.description === "string" ? snippet.description : "",
        channelTitle: typeof snippet.channelTitle === "string" ? snippet.channelTitle : "",
        publishedAt: snippet.publishedAt || null,
        thumbnail:
          thumbnails.maxres?.url ||
          thumbnails.standard?.url ||
          thumbnails.high?.url ||
          thumbnails.medium?.url ||
          thumbnails.default?.url ||
          null,
        watchUrl: typeof id === "string"
          ? `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`
          : null,
      };
    })
    .filter((item) => item.id && item.watchUrl);

  // Search results truncate descriptions; fetch the full snippets before matching games.
  const fullDetails = await fetchDetails(searchItems.map((item) => item.id), locale);
  const items = searchItems
    .map((item) => {
      const details = fullDetails.get(item.id);
      return {
        ...item,
        description: details?.description || item.description,
        thumbnail: details?.thumbnail || item.thumbnail,
        publishedAt: details?.publishedAt || item.publishedAt,
      };
    })
    .filter((item) => /\bsoundtracks?\b/i.test(item.title));

  soundtrackCache.set(locale, {
    expires: Date.now() + SOUNDTRACK_CACHE_MS,
    items,
  });
  return items;
}
