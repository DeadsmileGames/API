import test from "node:test";
import assert from "node:assert/strict";
import catalog from "../src/utils/errorCatalog.json" with { type: "json" };
import { errorCatalog, publicErrorMessage, resolveLocale } from "../src/utils/publicErrors.js";

const locales = ["en", "pt-BR", "es"];

test("every API error code has a non-empty translation in every supported locale", () => {
  const expectedCodes = Object.keys(catalog.en).sort();

  for (const locale of locales) {
    assert.deepEqual(Object.keys(catalog[locale]).sort(), expectedCodes, `Error codes differ for ${locale}`);

    for (const code of expectedCodes) {
      assert.equal(typeof catalog[locale][code], "string", `${locale}.${code} must be a string`);
      assert.ok(catalog[locale][code].trim(), `${locale}.${code} must not be empty`);
    }
  }
});

test("error translations preserve interpolation placeholders", () => {
  const placeholders = (value) => [...value.matchAll(/\{([\w]+)\}/g)].map((match) => match[1]).sort();

  for (const code of Object.keys(catalog.en)) {
    for (const locale of ["pt-BR", "es"]) {
      assert.deepEqual(
        placeholders(catalog[locale][code]),
        placeholders(catalog.en[code]),
        `Placeholder mismatch for ${locale}.${code}`,
      );
    }
  }
});

test("Accept-Language resolves supported locales by preference and quality", () => {
  assert.equal(resolveLocale("pt-BR,es;q=0.9"), "pt-BR");
  assert.equal(resolveLocale("fr;q=1, es;q=0.8, en;q=0.5"), "es");
  assert.equal(resolveLocale("es;q=0, en;q=0.4"), "en");
  assert.equal(resolveLocale("fr,de;q=0.9"), "en");
  assert.deepEqual(errorCatalog("es"), catalog.es);
});

test("unknown error codes use the localized status fallback", () => {
  for (const locale of locales) {
    assert.equal(
      publicErrorMessage("UNKNOWN_CODE", 500, locale),
      catalog[locale].INTERNAL_ERROR,
    );
  }
});
