import { env } from "../config/env.js";
import { youtubeVideoId } from "../utils/youtube.js";

const CACHE_MS = 60_000;
const PREMIERE_WINDOW_MS = 24 * 60 * 60 * 1000;
const cache = new Map();

function toDetails(item) {
  return {
    description: item.snippet?.description || "",
    publishedAt: item.snippet?.publishedAt || null,
    state: item.snippet?.liveBroadcastContent || "none",
    startsAt: item.liveStreamingDetails?.scheduledStartTime || null,
  };
}

async function fetchDetails(ids) {
  if (!env.youtubeApiKey || !ids.length) return new Map();
  const missing = [...new Set(ids)].filter((id) => !(cache.get(id)?.expires > Date.now()));
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
      if (response.ok)
        for (const item of (await response.json()).items || [])
          entries.set(item.id, toDetails(item));
    } catch {}
    const expires = Date.now() + CACHE_MS;
    for (const [id, value] of entries) cache.set(id, { expires, value });
  }
  return new Map(ids.map((id) => [id, cache.get(id)?.value ?? null]));
}

export async function getYoutubeDetails(videoUrl) {
  const id = youtubeVideoId(videoUrl);
  return id ? (await fetchDetails([id])).get(id) : null;
}

export async function findPremiere(videos) {
  const ids = videos.map((video) => youtubeVideoId(video.video_url));
  const details = await fetchDetails(ids.filter(Boolean));
  const now = Date.now();
  return (
    videos
      .map((video, index) => ({ video, info: details.get(ids[index]) }))
      .filter(
        ({ info }) =>
          info?.startsAt &&
          (info.state === "live" ||
            (info.state === "upcoming" &&
              Date.parse(info.startsAt) - now <= PREMIERE_WINDOW_MS)),
      )
      .sort((a, b) => Date.parse(a.info.startsAt) - Date.parse(b.info.startsAt))[0] || null
  );
}
