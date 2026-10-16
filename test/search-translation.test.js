import assert from "node:assert/strict";
import test from "node:test";
import {
  clearSearchTranslationCache,
  translateSearchQuery,
} from "../src/services/searchTranslation.service.js";

test("translates Brazilian Portuguese query to canonical English", async () => {
  clearSearchTranslationCache();
  const originalFetch = globalThis.fetch;
  let requestUrl = "";

  globalThis.fetch = async (url) => {
    requestUrl = String(url);
    return Response.json({
      responseStatus: 200,
      responseData: { translatedText: "October 16", match: 1 },
    });
  };

  try {
    const result = await translateSearchQuery("16 de outubro", "pt-BR");
    assert.deepEqual(result, { query: "October 16", translated: true });
    assert.match(requestUrl, /langpair=pt%7Cen/u);
    assert.match(requestUrl, /q=16+de+outubro/u);
  } finally {
    globalThis.fetch = originalFetch;
    clearSearchTranslationCache();
  }
});

test("translates Spanish query to canonical English", async () => {
  clearSearchTranslationCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      responseStatus: 200,
      responseData: { translatedText: "shooting", match: 1 },
    });

  try {
    assert.deepEqual(await translateSearchQuery("disparo", "es"), {
      query: "shooting",
      translated: true,
    });
  } finally {
    globalThis.fetch = originalFetch;
    clearSearchTranslationCache();
  }
});

test("caches translation results", async () => {
  clearSearchTranslationCache();
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return Response.json({
      responseStatus: 200,
      responseData: { translatedText: "shot", match: 1 },
    });
  };

  try {
    await translateSearchQuery("tiro cache test", "pt-BR");
    await translateSearchQuery("tiro cache test", "pt-BR");
    assert.equal(requests, 1);
  } finally {
    globalThis.fetch = originalFetch;
    clearSearchTranslationCache();
  }
});

test("falls back to the original query if translation is unavailable", async () => {
  clearSearchTranslationCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("translation provider unavailable");
  };

  try {
    assert.deepEqual(await translateSearchQuery("palavra incomum", "pt-BR"), {
      query: "palavra incomum",
      translated: false,
    });
  } finally {
    globalThis.fetch = originalFetch;
    clearSearchTranslationCache();
  }
});

test("does not translate English input", async () => {
  clearSearchTranslationCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("English input should not require translation");
  };

  try {
    assert.deepEqual(await translateSearchQuery("October 16th", "en"), {
      query: "October 16th",
      translated: false,
    });
  } finally {
    globalThis.fetch = originalFetch;
    clearSearchTranslationCache();
  }
});
