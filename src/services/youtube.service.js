import { env } from "../config/env.js";
import { youtubeVideoId } from "../utils/youtube.js";

const CACHE_MS = 60_000;
const PREMIERE_WINDOW_MS = 24 * 60 * 60 * 1000;
const cache = new Map();

function toDetails(item) {
  const snippet = item.snippet || {};
  const live = item.liveStreamingDetails || {};
  const thumbnails = snippet.thumbnails || {};
  return {
    title: snippet.title || "",
    description: snippet.description || "",
    publishedAt: snippet.publishedAt || null,
    thumbnail:
      thumbnails.maxres?.url ||
      thumbnails.standard?.url ||
      thumbnails.high?.url ||
      thumbnails.medium?.url ||
      thumbnails.default?.url ||
      null,
    state: snippet.liveBroadcastContent || "none",
    startsAt: live.scheduledStartTime || null,
    actualStartedAt: live.actualStartTime || null,
  };
}

async function fetchDetails(ids) {
  const uniqueIds = [...new Set(ids.filter(Boolean))].slice(0, 50);
  if (!env.youtubeApiKey || !uniqueIds.length) return new Map();
  const now = Date.now();
  const missing = uniqueIds.filter((id) => !(cache.get(id)?.expires > now));
  if (missing.length) {
    const entries = new Map(missing.map((id) => [id, null]));
    try {
      const params = new URLSearchParams({
        part: "snippet,liveStreamingDetails",
        id: missing.join(","),
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
    for (const [id, value] of entries) cache.set(id, { expires, value });
  }
  return new Map(uniqueIds.map((id) => [id, cache.get(id)?.value ?? null]));
}

export async function getYoutubeDetails(videoUrl) {
  const id = youtubeVideoId(videoUrl);
  return id ? (await fetchDetails([id])).get(id) ?? null : null;
}

export async function getYoutubeDetailsForVideos(videos) {
  const ids = videos.map((video) => youtubeVideoId(video.video_url));
  const details = await fetchDetails(ids);
  return videos.map((video, index) => ({
    ...video,
    youtube: ids[index] ? details.get(ids[index]) ?? null : null,
  }));
}

export async function findPremiere(videos) {
  const ids = videos.map((video) => youtubeVideoId(video.video_url));
  const details = await fetchDetails(ids);
  const now = Date.now();
  return (
    videos
      .map((video, index) => ({ video, info: details.get(ids[index]) }))
      .filter(({ info }) => {
        if (!info?.startsAt || !Number.isFinite(Date.parse(info.startsAt))) return false;
        const scheduled = Date.parse(info.startsAt);
        if (info.state === "upcoming") {
          const difference = scheduled - now;
          return difference <= PREMIERE_WINDOW_MS && difference > -PREMIERE_WINDOW_MS;
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
