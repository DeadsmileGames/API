import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { youtubeVideoId } from "../utils/youtube.js";

const CACHE_MS = 15_000;
const LIVE_CHAT_MAX_MESSAGES = 80;
const LIVE_CHAT_MIN_POLL_MS = 5_000;
const LIVE_CHAT_DEFAULT_POLL_MS = 15_000;
const liveChatCache = new Map();
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
    channelId: snippet.channelId || null,
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
    activeLiveChatId: live.activeLiveChatId || null,
  };
}

function normalizeLanguage(language) {
  return ["pt-BR", "es", "en"].includes(language) ? language : "en";
}

async function fetchDetails(ids, language = "en", { force = false } = {}) {
  const locale = normalizeLanguage(language);
  const uniqueIds = [...new Set(ids.filter(Boolean))].slice(0, 50);
  if (!env.youtubeApiKey || !uniqueIds.length) return new Map();
  const cacheKey = (id) => `${locale}:${id}`;
  const now = Date.now();
  const missing = uniqueIds.filter((id) => force || !(cache.get(cacheKey(id))?.expires > now));
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

function chatPayload(entry) {
  return {
    state: entry.state || "none",
    available: Boolean(entry.available),
    messages: Array.isArray(entry.messages) ? entry.messages : [],
    pollingIntervalMillis: entry.pollingIntervalMillis || LIVE_CHAT_DEFAULT_POLL_MS,
    updatedAt: entry.updatedAt || null,
    messageCode: entry.messageCode || null,
  };
}

function normalizeLiveChatMessage(item) {
  const snippet = item?.snippet || {};
  const author = item?.authorDetails || {};
  const rawMessage =
    snippet.displayMessage ||
    snippet.textMessageDetails?.messageText ||
    snippet.superChatDetails?.userComment ||
    "";
  const message = String(rawMessage).slice(0, 800).trim();
  if (!message) return null;
  const rawPhoto = typeof author.profileImageUrl === "string" ? author.profileImageUrl : "";
  const authorPhoto =
    /^https:\/\/(?:yt3[.]ggpht[.]com|lh3[.]googleusercontent[.]com)\//i.test(rawPhoto)
      ? rawPhoto
      : null;
  return {
    id: String(item?.id || ""),
    authorName: String(author.displayName || "YouTube user").slice(0, 100),
    authorPhoto,
    message,
    publishedAt: snippet.publishedAt || null,
    type: String(snippet.type || "textMessageEvent").slice(0, 50),
  };
}

function storeLiveChatCache(videoId, entry) {
  if (liveChatCache.size >= 128 && !liveChatCache.has(videoId)) {
    liveChatCache.delete(liveChatCache.keys().next().value);
  }
  liveChatCache.set(videoId, entry);
}

export async function getYoutubeLiveChat(videoUrl, language = "en") {
  const videoId = youtubeVideoId(videoUrl);
  if (!videoId) {
    return { state: "none", available: false, messages: [], pollingIntervalMillis: 30_000 };
  }
  if (!env.youtubeApiKey) {
    return {
      state: "unavailable",
      available: false,
      messages: [],
      pollingIntervalMillis: 30_000,
      messageCode: "YOUTUBE_API_UNAVAILABLE",
    };
  }

  const now = Date.now();
  let entry = liveChatCache.get(videoId);
  if (entry && entry.nextPollAt > now) return chatPayload(entry);

  if (!entry?.liveChatId || entry.state !== "live") {
    const details = (await fetchDetails([videoId], language, { force: true })).get(videoId);
    const state = details?.state || "none";
    const liveChatId = details?.activeLiveChatId || null;
    if (state !== "live" || !liveChatId) {
      const delay = state === "upcoming" ? LIVE_CHAT_DEFAULT_POLL_MS : 30_000;
      entry = {
        state,
        liveChatId: null,
        available: false,
        messages: entry?.messages || [],
        pollingIntervalMillis: delay,
        nextPollAt: Date.now() + delay,
        updatedAt: new Date().toISOString(),
      };
      storeLiveChatCache(videoId, entry);
      return chatPayload(entry);
    }
    if (entry?.liveChatId !== liveChatId) {
      entry = { messages: [], nextPageToken: null };
    }
    entry = {
      ...entry,
      state: "live",
      liveChatId,
      available: false,
      pollingIntervalMillis: LIVE_CHAT_DEFAULT_POLL_MS,
      nextPollAt: 0,
    };
  }

  try {
    const params = new URLSearchParams({
      liveChatId: entry.liveChatId,
      part: "snippet,authorDetails",
      maxResults: "200",
      key: env.youtubeApiKey,
    });
    if (entry.nextPageToken) params.set("pageToken", entry.nextPageToken);
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/liveChat/messages?${params}`,
      { signal: AbortSignal.timeout(8_000) },
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(data?.error?.errors?.[0]?.reason || "YOUTUBE_CHAT_UNAVAILABLE"));

    const incoming = (Array.isArray(data.items) ? data.items : [])
      .map(normalizeLiveChatMessage)
      .filter(Boolean);
    const combined = new Map((entry.messages || []).map((message) => [message.id, message]));
    incoming.forEach((message) => combined.set(message.id, message));
    const messages = [...combined.values()].slice(-LIVE_CHAT_MAX_MESSAGES);
    const requestedDelay = Number(data.pollingIntervalMillis);
    const delay = Math.min(
      30_000,
      Math.max(LIVE_CHAT_MIN_POLL_MS, Number.isFinite(requestedDelay) ? requestedDelay : LIVE_CHAT_DEFAULT_POLL_MS),
    );
    entry = {
      ...entry,
      state: data.offlineAt ? "completed" : "live",
      available: !data.offlineAt,
      messages,
      nextPageToken: data.nextPageToken || entry.nextPageToken || null,
      pollingIntervalMillis: delay,
      nextPollAt: Date.now() + delay,
      updatedAt: new Date().toISOString(),
      messageCode: data.offlineAt ? "YOUTUBE_CHAT_ENDED" : null,
    };
  } catch {
    const delay = 15_000;
    entry = {
      ...entry,
      state: entry.state || "live",
      available: Boolean(entry.messages?.length),
      pollingIntervalMillis: delay,
      nextPollAt: Date.now() + delay,
      updatedAt: new Date().toISOString(),
      messageCode: "YOUTUBE_CHAT_UNAVAILABLE",
    };
  }

  storeLiveChatCache(videoId, entry);
  return chatPayload(entry);
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
const OFFICIAL_SOUNDTRACK_HANDLE = "@DeadsmileGames";
const OFFICIAL_CHANNEL_CACHE_MS = 6 * 60 * 60 * 1000;
let officialChannelCache = { id: null, expires: 0 };
let officialChannelRequest = null;

async function getOfficialSoundtrackChannelId() {
  if (officialChannelCache.expires > Date.now()) return officialChannelCache.id;
  if (officialChannelRequest) return officialChannelRequest;

  officialChannelRequest = (async () => {
    const params = new URLSearchParams({
      part: "snippet",
      forHandle: OFFICIAL_SOUNDTRACK_HANDLE,
      key: env.youtubeApiKey,
    });
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?${params}`,
      { signal: AbortSignal.timeout(8_000) },
    );
    if (!response.ok) throw new AppError(503, "YOUTUBE_UNAVAILABLE");

    const data = await response.json();
    const id = data?.items?.[0]?.id || null;
    officialChannelCache = {
      id,
      expires: Date.now() + (id ? OFFICIAL_CHANNEL_CACHE_MS : 5 * 60 * 1000),
    };
    return id;
  })();

  try {
    return await officialChannelRequest;
  } finally {
    officialChannelRequest = null;
  }
}

export async function searchSoundtrackVideos(language = "en") {
  const locale = normalizeLanguage(language);
  const cached = soundtrackCache.get(locale);
  if (cached && cached.expires > Date.now()) {
    const details = await fetchDetails(cached.items.map((item) => item.id), locale);
    return cached.items.map((item) => {
      const detail = details.get(item.id);
      if (!detail) return item;
      return {
        ...item,
        state: detail.state || "none",
        startsAt: detail.startsAt || null,
        actualStartedAt: detail.actualStartedAt || null,
      };
    });
  }

  if (!env.youtubeApiKey) {
    soundtrackCache.set(locale, { expires: Date.now() + SOUNDTRACK_CACHE_MS, items: [] });
    return [];
  }

  const channelId = await getOfficialSoundtrackChannelId();
  if (!channelId) {
    soundtrackCache.set(locale, { expires: Date.now() + SOUNDTRACK_CACHE_MS, items: [] });
    return [];
  }

  const params = new URLSearchParams({
    part: "snippet",
    q: "soundtrack",
    type: "video",
    channelId,
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
        channelId: typeof snippet.channelId === "string" ? snippet.channelId : "",
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
    .filter((item) => item.id && item.watchUrl && item.channelId === channelId && /\bsoundtracks?\b/i.test(item.title));

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
        state: details?.state || "none",
        startsAt: details?.startsAt || null,
        actualStartedAt: details?.actualStartedAt || null,
      };
    })
    .filter((item) => /\bsoundtracks?\b/i.test(item.title));

  soundtrackCache.set(locale, {
    expires: Date.now() + SOUNDTRACK_CACHE_MS,
    items,
  });
  return items;
}
