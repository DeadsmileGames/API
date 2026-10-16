import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSearchQuery } from "../src/utils/searchNormalization.js";
import {
  clearSearchTranslationCache,
  expandSearchQueries,
} from "../src/services/searchTranslation.service.js";

function mockTranslationApi(translations, onRequest = () => {}) {
  return async (input) => {
    const url = new URL(String(input));
    const langpair = url.searchParams.get("langpair");
    const query = url.searchParams.get("q");
    onRequest({ langpair, query });
    const translatedText = translations[langpair]?.[query];
    if (!translatedText) {
      return Response.json({
        responseStatus: 200,
        responseData: { translatedText: query, match: 0.1 },
      });
    }
    return Response.json({
      responseStatus: 200,
      responseData: { translatedText, match: 1 },
    });
  };
}

test("adds canonical English translations for Portuguese and Spanish queries", async () => {
  clearSearchTranslationCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockTranslationApi({
    "pt|en": { "16 de outubro": "October 16" },
    "es|en": { "16 de outubro": "October 16" },
  });

  try {
    const variants = await expandSearchQueries("16 de outubro", "pt-BR");
    assert.deepEqual(variants, [{ query: "October 16", language: "en" }]);
  } finally {
    globalThis.fetch = originalFetch;
    clearSearchTranslationCache();
  }
});

test("uses the shared English term for a translated word", async () => {
  clearSearchTranslationCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockTranslationApi({
    "pt|en": { tiro: "shot" },
    "es|en": { tiro: "shot" },
  });

  try {
    assert.deepEqual(await expandSearchQueries("tiro", "pt-BR"), [
      { query: "shot", language: "en" },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    clearSearchTranslationCache();
  }
});

test("caches translations for repeated search requests", async () => {
  clearSearchTranslationCache();
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = mockTranslationApi(
    {
      "pt|en": { "palavra cache": "cached word" },
      "es|en": { "palavra cache": "cached word" },
    },
    () => requests++,
  );

  try {
    await expandSearchQueries("palavra cache", "pt-BR");
    await expandSearchQueries("palavra cache", "pt-BR");
    assert.equal(requests, 2);
  } finally {
    globalThis.fetch = originalFetch;
    clearSearchTranslationCache();
  }
});

test("keeps search usable when translation is unavailable", async () => {
  clearSearchTranslationCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("translation provider unavailable");
  };

  try {
    assert.deepEqual(await expandSearchQueries("palavra incomum", "pt-BR"), [
      { query: "palavra incomum", language: "pt-BR" },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    clearSearchTranslationCache();
  }
});

test("English, Portuguese and Spanish equivalents share an English query variant", async () => {
  clearSearchTranslationCache();
  const originalFetch = globalThis.fetch;
  const translations = {
    "pt|en": {
      "October 16th": "October 16",
      "16 de outubro": "October 16",
      "16 de octubre": "October 16",
      shot: "shot",
      tiro: "shot",
      disparo: "shot",
    },
    "es|en": {
      "October 16th": "October 16",
      "16 de outubro": "October 16",
      "16 de octubre": "October 16",
      shot: "shot",
      tiro: "shot",
      disparo: "shot",
    },
  };
  globalThis.fetch = mockTranslationApi(translations);

  try {
    const dateQueries = await Promise.all([
      expandSearchQueries("October 16th", "en"),
      expandSearchQueries("16 de outubro", "pt-BR"),
      expandSearchQueries("16 de octubre", "es"),
    ]);
    assert.ok(
      dateQueries.every(
        (variants) =>
          normalizeSearchQuery(variants[0]?.query, variants[0]?.language).normalizedQuery ===
          "october 16",
      ),
    );

    const wordQueries = await Promise.all([
      expandSearchQueries("shot", "en"),
      expandSearchQueries("tiro", "pt-BR"),
      expandSearchQueries("disparo", "es"),
    ]);
    assert.ok(wordQueries.every((variants) => variants[0]?.query === "shot"));
  } finally {
    globalThis.fetch = originalFetch;
    clearSearchTranslationCache();
  }
});

test("preserves the source query if its preferred translation fails", async () => {
  clearSearchTranslationCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.searchParams.get("langpair") === "pt|en") {
      return Response.json({ responseStatus: 403 }, { status: 403 });
    }
    return Response.json({
      responseStatus: 200,
      responseData: { translatedText: "shot", match: 1 },
    });
  };

  try {
    assert.deepEqual(await expandSearchQueries("tiro", "pt-BR"), [
      { query: "shot", language: "en" },
      { query: "tiro", language: "pt-BR" },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    clearSearchTranslationCache();
  }
});
