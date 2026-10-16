const API_URL = "https://api.mymemory.translated.net/get";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FAILURE_CACHE_TTL_MS = 30 * 1000;
const MAX_CACHE_ENTRIES = 2_000;
const TRANSLATION_TIMEOUT_MS = 800;
const SOURCE_LANGUAGES = Object.freeze([
  { locale: "pt-BR", source: "pt" },
  { locale: "es", source: "es" },
]);

const PORTUGUESE_MARKERS = /[ãõç]|\b(?:outubro|janeiro|fevereiro|março|maio|junho|julho|setembro|dezembro|jogo|jogos|lançamento|jogabilidade|trilha|edição|promoção|notícia|notícias)\b/iu;
const SPANISH_MARKERS = /[ñ¿¡]|\b(?:octubre|enero|febrero|marzo|mayo|junio|julio|septiembre|diciembre|juego|juegos|lanzamiento|jugabilidad|disparo|artículo|artículos|año|niño)\b/iu;

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

function remember(key, value, ttl = CACHE_TTL_MS) {
  cache.delete(key);
  cache.set(key, { value, expiresAt: Date.now() + ttl });
  while (cache.size > MAX_CACHE_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }
}

function detectQueryLanguage(query, fallbackLanguage) {
  const text = String(query || "").toLocaleLowerCase("pt-BR");
  const portugueseMatches = (text.match(new RegExp(PORTUGUESE_MARKERS.source, "giu")) || []).length;
  const spanishMatches = (text.match(new RegExp(SPANISH_MARKERS.source, "giu")) || []).length;

  if (portugueseMatches > spanishMatches) return "pt-BR";
  if (spanishMatches > portugueseMatches) return "es";
  return fallbackLanguage === "pt-BR" || fallbackLanguage === "es"
    ? fallbackLanguage
    : "pt-BR";
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
  const confidence = Number(payload?.responseData?.match);
  if (
    !translated ||
    !Number.isFinite(confidence) ||
    confidence < 0.5 ||
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

  if (inFlight.has(key)) return inFlight.get(key);

  const pending = requestTranslation(query, source)
    .then((value) => {
      if (value) {
        remember(key, value);
      } else {
        remember(key, null, FAILURE_CACHE_TTL_MS);
      }
      return value;
    })
    .catch(() => {
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
  const hasPortugueseMarker = PORTUGUESE_MARKERS.test(original);
  const hasSpanishMarker = SPANISH_MARKERS.test(original);
  if (language === "en" && !hasPortugueseMarker && !hasSpanishMarker)
    return [{ query: original, language: "en" }];

  const detectedLanguage = detectQueryLanguage(original, language);
  const primarySource = SOURCE_LANGUAGES.find(
    ({ locale }) => locale === detectedLanguage,
  ) || SOURCE_LANGUAGES[0];
  const fallbackSource = SOURCE_LANGUAGES.find(
    ({ locale }) => locale !== primarySource.locale,
  );

  const primaryTranslation = await translateCached(original, primarySource.source);
  const fallbackTranslation = primaryTranslation
    ? null
    : await translateCached(original, fallbackSource.source);
  const translations = [primaryTranslation, fallbackTranslation];

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
    if (translated) {
      add(translated, "en");
      break;
    }
  }

  const hasEnglishEquivalent = translations.some(
    (translated) =>
      translated &&
      translated.toLocaleLowerCase("en") === original.toLocaleLowerCase("en"),
  );
  if (!translations[0] || hasEnglishEquivalent) add(original, language);
  return variants;
}

export function clearSearchTranslationCache() {
  cache.clear();
  inFlight.clear();
}
