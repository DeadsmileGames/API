import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSearchQuery } from "../src/utils/searchNormalization.js";

test("equates English ordinal dates with Brazilian Portuguese dates", () => {
  const english = normalizeSearchQuery("October 16th", "en");
  const portuguese = normalizeSearchQuery("16 de outubro", "pt-BR");

  assert.deepEqual(portuguese, english);
  assert.deepEqual(english, {
    normalizedQuery: "october 16",
    terms: ["october", "16"],
  });
});

test("normalizes Spanish and French month names", () => {
  assert.deepEqual(
    normalizeSearchQuery("16 de octubre", "es"),
    normalizeSearchQuery("October 16th", "en"),
  );
  assert.deepEqual(
    normalizeSearchQuery("16 octobre", "fr"),
    normalizeSearchQuery("October 16th", "en"),
  );
});

test("normalizes English ordinal suffixes for numeric dates", () => {
  assert.deepEqual(
    normalizeSearchQuery("October 2nd", "en"),
    normalizeSearchQuery("2 de outubro", "pt-BR"),
  );
});

test("preserves ordinary non-date search terms", () => {
  assert.deepEqual(normalizeSearchQuery("game trailer", "en"), {
    normalizedQuery: "game trailer",
    terms: ["game", "trailer"],
  });
});
