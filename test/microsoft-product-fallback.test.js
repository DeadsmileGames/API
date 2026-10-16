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
  const completeProduct = {
    title: "Localized title",
    description: "Description",
    developer: "Developer",
    publisher: "Publisher",
    category: "Games",
    categories: ["Games"],
    images: [{ url: "image" }],
    screenshots: [{ url: "screen" }],
    trailers: [{ url: "trailer" }],
    version: "1.0.0.0",
    packages: [{ version: "1.0.0.0" }],
    downloadSizeBytes: 100,
    installSizeBytes: 200,
    languages: ["English"],
    platforms: ["PC"],
    architectures: ["x64"],
    features: ["Single player"],
    releaseNotes: ["Changes"],
    requirements: [{ title: "Minimum", items: [{ name: "OS", value: "Windows" }] }],
    permissions: ["Internet"],
    capabilities: ["Gamepad"],
    hasInAppPurchases: false,
    averageRating: 4.5,
    ratingCount: 100,
    copyright: "Copyright",
    licenseTerms: "Terms",
    installationTerms: "Installation terms",
    privacyUrl: "https://example.com/privacy",
    publisherUrl: "https://example.com",
    supportUrl: "https://example.com/support",
    releaseDate: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-02-01T00:00:00.000Z",
    listingModifiedAt: "2025-02-02T00:00:00.000Z",
  };
  assert.equal(needsMicrosoftProductFallback(completeProduct), false);
});
