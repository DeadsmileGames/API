import test from "node:test";
import assert from "node:assert/strict";
import {
  mergeMicrosoftProductFallback,
  needsMicrosoftProductFallback,
} from "../src/utils/microsoftProductFallback.js";

test("missing localized Store fields are filled from English without replacing localized prices or ratings", () => {
  const localized = {
    productId: "9P6P8284V337",
    market: "DE",
    locale: "de-DE",
    storeUrl: "https://apps.microsoft.com/detail/9P6P8284V337?hl=de-DE&gl=DE",
    title: "Deutscher Titel",
    description: "",
    developer: "Lokaler Entwickler",
    publisher: "Lokaler Herausgeber",
    images: [],
    screenshots: [],
    version: null,
    requirements: [],
    releaseNotes: [],
    price: 12.99,
    currency: "EUR",
    isFree: false,
    primaryRating: { system: "USK", id: "USK:12", age: 12 },
  };
  const english = {
    productId: "9P6P8284V337",
    market: "US",
    locale: "en-US",
    storeUrl: "https://apps.microsoft.com/detail/9P6P8284V337?hl=en-US&gl=US",
    title: "English title",
    description: "English Store description",
    developer: "English developer",
    publisher: "English publisher",
    images: [{ url: "https://store-images.s-microsoft.com/cover.png" }],
    screenshots: [{ url: "https://store-images.s-microsoft.com/screen.png" }],
    version: "1.2.3.4",
    requirements: [{ title: "Minimum", items: [{ name: "OS", value: "Windows" }] }],
    releaseNotes: ["Bug fixes"],
    price: 9.99,
    currency: "USD",
    isFree: false,
    primaryRating: { system: "ESRB", id: "ESRB:E", age: 0 },
  };

  assert.equal(needsMicrosoftProductFallback(localized), true);
  const merged = mergeMicrosoftProductFallback(localized, english);
  assert.equal(merged.description, "English Store description");
  assert.equal(merged.title, "Deutscher Titel");
  assert.equal(merged.developer, "Lokaler Entwickler");
  assert.equal(merged.market, "DE");
  assert.equal(merged.locale, "de-DE");
  assert.equal(merged.price, 12.99);
  assert.equal(merged.currency, "EUR");
  assert.equal(merged.primaryRating.system, "USK");
  assert.equal(merged.version, "1.2.3.4");
  assert.equal(merged.fallbackLocale, "en-US");
});

test("English Store result is used as-is when no localized result exists", () => {
  const english = {
    productId: "9P6P8284V337",
    market: "US",
    locale: "en-US",
    title: "English title",
    description: "English description",
  };
  assert.deepEqual(mergeMicrosoftProductFallback(null, english), {
    ...english,
    fallbackLocale: "en-US",
  });
});

test("complete localized metadata does not require English enrichment", () => {
  assert.equal(
    needsMicrosoftProductFallback({
      title: "Localized title",
      description: "Description",
      developer: "Developer",
      publisher: "Publisher",
      images: [{ url: "image" }],
      screenshots: [{ url: "screen" }],
      version: "1.0.0.0",
      requirements: [{ title: "Minimum", items: [{ name: "OS", value: "Windows" }] }],
      releaseNotes: ["Changes"],
    }),
    false,
  );
});
