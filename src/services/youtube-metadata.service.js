import { env } from "../config/env.js";

const CACHE_TTL_MS = 5 * 60 * 1000;
const metadataCache = new Map();

export function getYoutubeVideoId(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    let id = null;
    if (host === "youtu.be") {
      id = url.pathname.split("/").filter(Boolean)[0] || null;
    } else if (["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"].includes(host)) {
      if (url.pathname === "/watch") id = url.searchParams.get("v");
      else id = url.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]+)$/)?.[1] || null;
    }
    return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export async function getYoutubeMetadata(values) {
  const ids = [...new Set(values.map(getYoutubeVideoId).filter(Boolean))].slice(0, 50);
  const now = Date.now();
  const missing = ids.filter((id) => {
    const entry = metadataCache.get(id);
    return !entry || entry.expiresAt <= now;
  });

  if (env.youtubeApiKey && missing.length) {
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet,liveStreamingDetails");
    url.searchParams.set("id", missing.join(","));
    url.searchParams.set("key", env.youtubeApiKey);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (response.ok) {
        const data = await response.json();
        for (const item of data.items || []) {
          const snippet = item.snippet || {};
          const live = item.liveStreamingDetails || {};
          const scheduledTime = live.scheduledStartTime || null;
          const actualStartTime = live.actualStartTime || null;
          const broadcastStatus = snippet.liveBroadcastContent || "none";
          const premiereTime = scheduledTime && (broadcastStatus === "upcoming" || broadcastStatus === "live" || actualStartTime)
            ? scheduledTime
            : null;
          const thumbnails = snippet.thumbnails || {};
          const thumbnail = thumbnails.maxres?.url || thumbnails.standard?.url || thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url || null;
          metadataCache.set(item.id, {
            title: typeof snippet.title === "string" ? snippet.title : null,
            description: typeof snippet.description === "string" ? snippet.description : null,
            publishedAt: typeof snippet.publishedAt === "string" ? snippet.publishedAt : null,
            thumbnail,
            premiereAt: premiereTime,
            isPremiere: Boolean(premiereTime),
            broadcastStatus,
            expiresAt: now + CACHE_TTL_MS,
          });
        }
        for (const id of missing) {
          if (!metadataCache.has(id) || metadataCache.get(id).expiresAt <= now) {
            metadataCache.set(id, { expiresAt: now + CACHE_TTL_MS });
          }
        }
      }
    } catch {
      return new Map(ids.map((id) => [id, metadataCache.get(id) || {}]));
    }
  }

  return new Map(ids.map((id) => {
    const entry = metadataCache.get(id);
    return [id, entry && entry.expiresAt > now ? entry : {}];
  }));
}
