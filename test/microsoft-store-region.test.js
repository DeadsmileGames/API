import test from "node:test";
import assert from "node:assert/strict";
import { microsoftStoreRegion } from "../src/utils/microsoftStoreRegion.js";

test("Microsoft Store regions cover all supported website locales", () => {
  assert.deepEqual(microsoftStoreRegion("pt-BR"), { market: "BR", locale: "pt-BR" });
  assert.deepEqual(microsoftStoreRegion("en"), { market: "US", locale: "en-US" });
  assert.deepEqual(microsoftStoreRegion("es"), { market: "ES", locale: "es-ES" });
  assert.deepEqual(microsoftStoreRegion("fr"), { market: "FR", locale: "fr-FR" });
  assert.deepEqual(microsoftStoreRegion("de"), { market: "DE", locale: "de-DE" });
});

test("regional language tags resolve correctly and unknown languages fall back safely", () => {
  assert.deepEqual(microsoftStoreRegion("fr-FR,fr;q=0.9,en;q=0.8"), {
    market: "FR",
    locale: "fr-FR",
  });
  assert.deepEqual(microsoftStoreRegion("de-DE"), { market: "DE", locale: "de-DE" });
  assert.deepEqual(microsoftStoreRegion("unknown-locale"), { market: "US", locale: "en-US" });
});
