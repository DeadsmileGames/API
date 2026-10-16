import test from "node:test";
import assert from "node:assert/strict";
import { microsoftStoreRegion } from "../src/utils/microsoftStoreRegion.js";

test("Microsoft Store regions cover only the supported website locales", () => {
  assert.deepEqual(microsoftStoreRegion("pt-BR"), { market: "BR", locale: "pt-BR" });
  assert.deepEqual(microsoftStoreRegion("en"), { market: "US", locale: "en-US" });
  assert.deepEqual(microsoftStoreRegion("es"), { market: "ES", locale: "es-ES" });
});

test("regional language tags resolve correctly and unsupported locales safely fall back to English", () => {
  assert.deepEqual(microsoftStoreRegion("pt"), { market: "BR", locale: "pt-BR" });
  assert.deepEqual(microsoftStoreRegion("es-MX"), { market: "ES", locale: "es-ES" });
  assert.deepEqual(microsoftStoreRegion("fr-FR"), { market: "US", locale: "en-US" });
  assert.deepEqual(microsoftStoreRegion("de-DE"), { market: "US", locale: "en-US" });
  assert.deepEqual(microsoftStoreRegion("unknown-locale"), { market: "US", locale: "en-US" });
});
