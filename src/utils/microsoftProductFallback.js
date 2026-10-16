const FALLBACK_FIELDS = [
  "title",
  "description",
  "developer",
  "publisher",
  "category",
  "categories",
  "images",
  "screenshots",
  "trailers",
  "version",
  "packages",
  "downloadSizeBytes",
  "installSizeBytes",
  "languages",
  "platforms",
  "architectures",
  "features",
  "releaseNotes",
  "requirements",
  "permissions",
  "capabilities",
  "hasInAppPurchases",
  "averageRating",
  "ratingCount",
  "copyright",
  "licenseTerms",
  "installationTerms",
  "privacyUrl",
  "publisherUrl",
  "supportUrl",
  "releaseDate",
  "updatedAt",
  "listingModifiedAt",
];

function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function needsMicrosoftProductFallback(product) {
  if (!product) return true;
  return [
    "title",
    "description",
    "developer",
    "publisher",
    "images",
    "screenshots",
    "version",
    "requirements",
    "releaseNotes",
  ].some((key) => !hasValue(product[key]));
}

export function mergeMicrosoftProductFallback(primary, englishFallback) {
  if (!primary) {
    return englishFallback
      ? { ...englishFallback, fallbackLocale: "en-US" }
      : null;
  }
  if (!englishFallback) return primary;

  const merged = { ...primary };
  for (const key of FALLBACK_FIELDS) {
    if (!hasValue(merged[key]) && hasValue(englishFallback[key])) {
      merged[key] = englishFallback[key];
    }
  }
  return { ...merged, fallbackLocale: "en-US" };
}
