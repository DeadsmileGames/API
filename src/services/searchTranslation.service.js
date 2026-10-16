const API_URL = "https://api.mymemory.translated.net/get";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FAILURE_CACHE_TTL_MS = 30 * 1000;
const MAX_CACHE_ENTRIES = 2_000;
const TRANSLATION_TIMEOUT_MS = 800;
const SOURCE_LANGUAGES = Object.freeze([
  { locale: "pt-BR", source: "pt" },
  { locale: "es", source: "es" },
]);

const cache = new Map();
const inFlight = new Map();
let providerUnavailableUntil = 0;

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

function remember(key, value, ttl = CACHE_TTL_MS) {
  cache.delete(key);
  cache.set(key, { value, expiresAt: Date.now() + ttl });
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

async function translateCached(query, source) {
  const key = normalizedCacheKey(query, source);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) cache.delete(key);

  if (providerUnavailableUntil > Date.now()) return null;
  if (inFlight.has(key)) return inFlight.get(key);

  const pending = requestTranslation(query, source)
    .then((value) => {
      if (value) {
        remember(key, value);
      } else {
        providerUnavailableUntil = Date.now() + FAILURE_CACHE_TTL_MS;
        remember(key, null, FAILURE_CACHE_TTL_MS);
      }
      return value;
    })
    .catch(() => {
      providerUnavailableUntil = Date.now() + FAILURE_CACHE_TTL_MS;
      remember(key, null, FAILURE_CACHE_TTL_MS);
      return null;
    })
    .finally(() => inFlight.delete(key));

  inFlight.set(key, pending);
  return pending;
}

export async function expandSearchQueries(query, language = "en") {
  const original = String(query || "").trim().slice(0, 80);
  if (!original) return [];

  const orderedSources = [...SOURCE_LANGUAGES].sort((a, b) => {
    const priority = (entry) => entry.locale === language ? 0 : 1;
    return priority(a) - priority(b);
  });
  const translations = await Promise.all(
    orderedSources.map(({ source }) => translateCached(original, source)),
  );

  const variants = [];
  const seen = new Set();
  const add = (value, queryLanguage) => {
    const text = String(value || "").trim().slice(0, 80);
    if (!text) return;
    const key = `${queryLanguage}:${text.toLocaleLowerCase("en")}`;
    if (seen.has(key)) return;
    seen.add(key);
    variants.push({ query: text, language: queryLanguage });
  };

  for (const translated of translations) {
    if (translated) add(translated, "en");
  }

  const hasEnglishEquivalent = translations.some(
    (translated) =>
      translated &&
      translated.toLocaleLowerCase("en") === original.toLocaleLowerCase("en"),
  );
  if (language === "en" || !translations[0] || hasEnglishEquivalent) add(original, language);
  return variants;
}

export function clearSearchTranslationCache() {
  cache.clear();
  inFlight.clear();
  providerUnavailableUntil = 0;
}
