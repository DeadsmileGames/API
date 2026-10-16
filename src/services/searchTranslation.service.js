const API_URL = "https://api.mymemory.translated.net/get";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 2_000;
const TRANSLATION_TIMEOUT_MS = 1_000;
const SOURCE_LANGUAGES = Object.freeze({
  es: "es",
  "pt-BR": "pt",
});

const cache = new Map();
const inFlight = new Map();

function normalizedCacheKey(query, source) {
  return `${source}:${String(query).trim().toLocaleLowerCase("en")}`;
}

function decodeTranslation(value) {
  return String(value || "")
    .replace(/&amp;/gu, "&")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .trim();
}

function remember(key, value) {
  cache.delete(key);
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  while (cache.size > MAX_CACHE_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }
}

async function requestTranslation(query, source) {
  const params = new URLSearchParams({
    q: query,
    langpair: `${source}|en`,
  });
  const response = await fetch(`${API_URL}?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(TRANSLATION_TIMEOUT_MS),
  });
  if (!response.ok) return null;

  const payload = await response.json();
  if (Number(payload?.responseStatus) !== 200) return null;

  const translated = decodeTranslation(payload?.responseData?.translatedText);
  if (
    !translated ||
    translated.length > 320 ||
    /^(?:PLEASE SELECT|INVALID SOURCE LANGUAGE|INVALID TARGET LANGUAGE|MYMEMORY WARNING)/iu.test(translated)
  ) {
    return null;
  }
  return translated;
}

export async function translateSearchQuery(query, language = "en") {
  const original = String(query || "").trim().slice(0, 80);
  const source = SOURCE_LANGUAGES[language];
  if (!original || !source) {
    return { query: original, translated: false };
  }

  const key = normalizedCacheKey(original, source);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return { query: cached.value, translated: cached.value !== original };
  }
  if (cached) cache.delete(key);

  if (inFlight.has(key)) {
    const value = await inFlight.get(key);
    return { query: value || original, translated: Boolean(value && value !== original) };
  }

  const pending = requestTranslation(original, source)
    .then((value) => {
      if (value) remember(key, value);
      return value;
    })
    .catch(() => null)
    .finally(() => inFlight.delete(key));

  inFlight.set(key, pending);
  const translated = await pending;
  return {
    query: translated || original,
    translated: Boolean(translated && translated !== original),
  };
}

export function clearSearchTranslationCache() {
  cache.clear();
  inFlight.clear();
}
