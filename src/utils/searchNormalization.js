const MONTH_GROUPS = [
  { canonical: "january", names: ["january", "janeiro", "enero", "janvier", "gennaio", "januar", "januari"] },
  { canonical: "february", names: ["february", "fevereiro", "febrero", "fevrier", "febbraio", "februar", "februari"] },
  { canonical: "march", names: ["march", "marco", "marzo", "mars", "marz", "maart"] },
  { canonical: "april", names: ["april", "abril", "avril", "aprile"] },
  { canonical: "may", names: ["may", "maio", "mayo", "mai", "maggio", "mei"] },
  { canonical: "june", names: ["june", "junho", "junio", "juin", "juni", "giugno"] },
  { canonical: "july", names: ["july", "julho", "julio", "juillet", "juli", "luglio"] },
  { canonical: "august", names: ["august", "agosto", "aout", "agustus", "augustus"] },
  { canonical: "september", names: ["september", "setembro", "septiembre", "septembre"] },
  { canonical: "october", names: ["october", "outubro", "octubre", "octobre", "oktober", "ottobre"] },
  { canonical: "november", names: ["november", "novembro", "noviembre", "novembre"] },
  { canonical: "december", names: ["december", "dezembro", "diciembre", "decembre", "dezember"] },
];

const MONTH_LOOKUP = new Map(
  MONTH_GROUPS.flatMap(({ canonical, names }) =>
    names.map((name) => [name, canonical]),
  ),
);

const DATE_CONNECTORS = new Set([
  "a", "a las", "da", "das", "de", "del", "den", "der", "des", "do", "dos",
  "du", "el", "en", "la", "las", "le", "les", "of", "on", "the", "to", "y",
]);

const SEARCH_SYNONYMS = {
  es: {
    juego: "game", juegos: "games", video: "videos", videos: "videos",
    noticia: "news", noticias: "news", articulo: "article", articulos: "articles",
    avance: "trailer", avances: "trailers", musica: "soundtrack", bandas: "soundtracks",
  },
  "pt-BR": {
    jogo: "game", jogos: "games", video: "videos", videos: "videos",
    noticia: "news", noticias: "news", artigo: "article", artigos: "articles",
    trailer: "trailer", trailers: "trailers", musica: "soundtrack", trilha: "soundtrack", sonoras: "soundtracks",
  },
};

export const SEARCH_MONTHS = MONTH_GROUPS.map(({ canonical, names }) => ({
  canonical,
  names: [...new Set(names.map(normalizeSearchText))],
}));

export function normalizeSearchText(value) {
  return String(value || "")
    .toLocaleLowerCase("pt-BR")
    .replace(/['’]s\b/gu, " ")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeSearchQuery(value, language = "en") {
  const normalized = normalizeSearchText(value);
  const rawTokens = normalized.split(" ").filter(Boolean);
  const hasMonth = rawTokens.some((token) => MONTH_LOOKUP.has(token));
  const hasDay = rawTokens.some((token) => /^\d{1,2}(?:st|nd|rd|th)?$/iu.test(token));
  const isDateQuery = hasMonth && hasDay;
  const synonyms = SEARCH_SYNONYMS[language] || {};

  const tokens = rawTokens
    .filter((token) => !isDateQuery || !DATE_CONNECTORS.has(token))
    .map((token) => {
      const withoutOrdinal = token.replace(/^(\d{1,2})(?:st|nd|rd|th)$/iu, "$1");
      if (isDateQuery) return MONTH_LOOKUP.get(withoutOrdinal) || withoutOrdinal;
      return MONTH_LOOKUP.get(withoutOrdinal) || synonyms[withoutOrdinal] || withoutOrdinal;
    });

  const uniqueTokens = [...new Set(tokens)];
  if (!isDateQuery) {
    return { normalizedQuery: normalized, terms: uniqueTokens };
  }

  const monthTokens = uniqueTokens.filter((token) =>
    MONTH_GROUPS.some((month) => month.canonical === token),
  );
  const otherTokens = uniqueTokens.filter((token) => !monthTokens.includes(token));
  return {
    normalizedQuery: [...monthTokens, ...otherTokens].join(" "),
    terms: [...monthTokens, ...otherTokens],
  };
}
