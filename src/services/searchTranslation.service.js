const API_URL = "https://api.mymemory.translated.net/get";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FAILURE_CACHE_TTL_MS = 30 * 1000;
const MAX_CACHE_ENTRIES = 2_000;
const TRANSLATION_TIMEOUT_MS = 800;
const SOURCE_LANGUAGES = Object.freeze([
  { locale: "pt-BR", source: "pt" },
  { locale: "es", source: "es" },
]);

const PORTUGUESE_MARKERS = /[ãõç]|\b(?:janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jogo|jogos|cachorro|cachorros|cão|cães|gato|gatos|carro|casa|lançamento|jogabilidade|trilha|edição|promoção|notícia|notícias|noticia|noticias|suporte|ajuda|pesquisa|busca|hoje|amanhã|ontem|filme|data|tiro|computador|tela|biblioteca|novidades|você|vocês)\b/iu;
const SPANISH_MARKERS = /[ñ¿¡]|\b(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|juego|juegos|perro|perros|gato|gatos|carro|casa|lanzamiento|jugabilidad|disparo|artículo|artículos|noticia|noticias|fecha|ayuda|soporte|búsqueda|busqueda|hoy|mañana|ayer|película|peliculas|estreno|ordenador|pantalla|novedades|computadora|tiro)\b/iu;


const CANONICAL_WATCH_QUERIES = new Set([
  "watch",
  "watches",
  "watched",
  "watching",
  "watch video",
  "watch videos",
  "watch the video",
  "watch the videos",
  "watch now",
  "view",
  "views",
  "viewing",
  "see",
  "seeing",
  "assista",
  "assiste",
  "assistem",
  "assistam",
  "assisti",
  "assistiu",
  "assistir",
  "assistindo",
  "assista a",
  "assista ao",
  "assista aos",
  "assista as",
  "assista às",
  "assista os",
  "assista os videos",
  "assista aos videos",
  "assista aos vídeos",
  "assista videos",
  "assista vídeos",
  "assista video",
  "assista vídeo",
  "assistir a",
  "assistir ao",
  "assistir aos",
  "assistir videos",
  "assistir vídeos",
  "assistir video",
  "assistir vídeo",
  "assista agora",
  "assista aqui",
  "veja",
  "veja o video",
  "veja os videos",
  "veja vídeos",
  "veja os vídeos",
  "ver",
  "ver video",
  "ver videos",
  "ver vídeo",
  "ver vídeos",
  "olhar",
  "olhe",
  "mirar",
  "mira",
  "mire",
  "miren",
  "mirando",
  "vea",
  "vean",
  "viendo",
  "ver el video",
  "ver los videos",
  "ver los vídeos",
  "ver video",
  "ver videos",
  "mirar videos",
  "mirar vídeos",
  "mira el video",
  "mira los videos",
  "mira los vídeos",
].map(normalizeCanonicalQuery));

function normalizeCanonicalQuery(value) {
  return String(value || "")
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function canonicalSearchQuery(value) {
  return CANONICAL_WATCH_QUERIES.has(normalizeCanonicalQuery(value))
    ? "watch"
    : null;
}

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
  const unchangedLowConfidence =
    translated.toLocaleLowerCase("en") === String(query).toLocaleLowerCase("en") &&
    (!Number.isFinite(confidence) || confidence < 0.5);
  if (
    !translated ||
    unchangedLowConfidence ||
    translated.length > 320 ||
    /^(?:PLEASE SELECT|INVALID SOURCE LANGUAGE|INVALID TARGET LANGUAGE|MYMEMORY WARNING)/iu.test(translated)
  ) {
    return null;
  }

  return {
    text: translated,
    confidence: Number.isFinite(confidence) ? confidence : 0,
  };
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

  const canonicalQuery = canonicalSearchQuery(original);
  if (canonicalQuery) return [{ query: canonicalQuery, language: "en" }];

  const hasPortugueseMarker = PORTUGUESE_MARKERS.test(original);
  const hasSpanishMarker = SPANISH_MARKERS.test(original);
  let translations;

  if (language === "en" && ((!hasPortugueseMarker && !hasSpanishMarker) || (hasPortugueseMarker && hasSpanishMarker))) {
    const candidates = await Promise.all(
      SOURCE_LANGUAGES.map(({ source }) => translateCached(original, source)),
    );
    const translatedCandidates = candidates.filter(Boolean);
    const changedCandidates = translatedCandidates.filter(
      ({ text }) => text.toLocaleLowerCase("en") !== original.toLocaleLowerCase("en"),
    );
    const rankedCandidates = changedCandidates.length
      ? changedCandidates
      : translatedCandidates;
    rankedCandidates.sort((a, b) => b.confidence - a.confidence);
    translations = [rankedCandidates[0] || null, null];
  } else {
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
    translations = [primaryTranslation, fallbackTranslation];
  }

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

  const translated = translations.find(Boolean);
  if (translated) add(translated.text, "en");

  const hasEnglishEquivalent = translations.some(
    (candidate) =>
      candidate &&
      candidate.text.toLocaleLowerCase("en") === original.toLocaleLowerCase("en"),
  );
  if (!translations[0] || hasEnglishEquivalent) add(original, language);
  return variants;
}

export function clearSearchTranslationCache() {
  cache.clear();
  inFlight.clear();
}
