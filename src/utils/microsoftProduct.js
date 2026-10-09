import sanitizeHtml from 'sanitize-html';

const list = (value) => Array.isArray(value) ? value.slice(0, 100) : [];
const text = (value, max = 16000) => typeof value === 'string' ? sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).trim().slice(0, max) : '';
const strings = (value) => [...new Set(list(value).map((item) => text(item, 1000)).filter(Boolean))];
const number = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const date = (value) => typeof value === 'string' && /^20\d{2}-/.test(value) && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;

function purchaseAvailable(item) {
  if (!list(item.Actions).includes('Purchase')) return false;
  const start = item.Conditions?.StartDate || item.StartDate;
  const end = item.Conditions?.EndDate || item.AvailabilityEndDate || item.EndDate;
  const now = Date.now();
  return (!start || (Number.isFinite(Date.parse(start)) && Date.parse(start) <= now)) && (!end || (Number.isFinite(Date.parse(end)) && Date.parse(end) > now));
}

export function storeUrl(value, image = false) {
  if (typeof value !== 'string' || value.length > 4096 || /[\u0000-\u0020\\]/.test(value)) return null;
  try {
    const url = new URL(value.startsWith('//') ? `https:${value}` : value);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
    if (image && !['store-images.s-microsoft.com', 'store-images.microsoft.com'].includes(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}

export function packageVersion(value) {
  if (typeof value === 'string' && /^\d{1,5}(\.\d{1,5}){3}$/.test(value)) return value;
  if (typeof value !== 'string' || !/^\d{1,20}$/.test(value)) return null;
  const packed = BigInt(value);
  if (packed <= 0n || packed > 18446744073709551615n) return null;
  return [48n, 32n, 16n, 0n].map((shift) => String((packed >> shift) & 65535n)).join('.');
}

export function normalizeMicrosoftProduct(productId, edge, catalog, { market, locale }) {
  const payload = edge?.Payload;
  const product = catalog?.Product;
  const validEdge = payload?.ProductId === productId && text(payload.Title);
  const validCatalog = product?.ProductId === productId && list(product.LocalizedProperties).some((item) => text(item.ProductTitle));
  if (!validEdge && !validCatalog) return null;
  const source = validEdge ? payload : {};
  const base = validCatalog ? product : {};
  const localized = list(base.LocalizedProperties).find((item) => item.Language?.toLowerCase() === locale.toLowerCase()) || list(base.LocalizedProperties)[0] || {};
  const marketData = list(base.MarketProperties).find((item) => list(item.Markets).includes(market)) || list(base.MarketProperties)[0] || {};
  const sku = list(base.DisplaySkuAvailabilities).find((item) => item.Sku?.Properties?.SkuType === 'full') || list(base.DisplaySkuAvailabilities)[0] || {};
  const skuText = list(sku.Sku?.LocalizedProperties)[0] || {};
  const packages = list(sku.Sku?.Properties?.Packages).map((item) => ({
    version: packageVersion(item.Version) || packageVersion(String(item.PackageFullName || '').split('_')[1]),
    architectures: strings(item.Architectures), languages: strings(item.Languages),
    downloadSizeBytes: number(item.MaxDownloadSizeInBytes), installSizeBytes: number(item.MaxInstallSizeInBytes),
    format: text(item.PackageFormat, 80),
  }));
  const images = list(source.Images?.length ? source.Images : localized.Images).map((item) => ({
    url: storeUrl(item.Url || item.Uri, true), purpose: text(item.ImageType || item.ImagePurpose, 100),
    caption: text(item.Caption, 1000), width: number(item.Width), height: number(item.Height),
  })).filter((item) => item.url);
  const localRatings = list(source.ProductRatings).map((item) => ({
    system: text(item.RatingSystemShortName || item.RatingSystemId || item.RatingSystem, 100),
    id: text(item.RatingId, 100), label: text(item.RatingValue || item.LongName, 300),
    description: text(item.Description, 1000), age: number(item.RatingAge), imageUrl: storeUrl(item.RatingValueLogoUrl, true),
    systemUrl: storeUrl(item.RatingSystemUrl), descriptorImages: list(item.RatingDescriptorLogoUrls).map((url) => storeUrl(url, true)).filter(Boolean),
    descriptors: strings(item.RatingDescriptors), disclaimers: strings(item.RatingDisclaimers), interactiveElements: strings(item.InteractiveElements),
  })).filter((item) => item.id && item.label);
  const otherRatings = list(marketData.ContentRatings).filter((item) => !localRatings.some((rating) => rating.id === item.RatingId)).map((item) => ({
    system: text(item.RatingSystem, 100), id: text(item.RatingId, 100), label: text(item.RatingId, 100),
    description: '', age: null, imageUrl: null, systemUrl: null, descriptorImages: [],
    descriptors: strings(item.RatingDescriptors), disclaimers: strings(item.RatingDisclaimers), interactiveElements: strings(item.InteractiveElements),
  })).filter((item) => item.id);
  const fullSku = list(source.Skus).find((item) => item.SkuType === 'full');
  const purchase = list(fullSku?.Availabilities).find(purchaseAvailable);
  const availability = list(sku.Availabilities).find((item) => purchaseAvailable(item) && (!item.Markets?.length || item.Markets.includes(market)));
  const price = source.IsPurchaseEnabled === false ? null : number(purchase?.Price ?? availability?.OrderManagementData?.Price?.ListPrice);
  const currency = text(fullSku?.CurrencyCode || availability?.OrderManagementData?.Price?.CurrencyCode, 10);
  const usage = list(marketData.UsageData).find((item) => item.AggregateTimeSpan === 'AllTime') || {};
  const requirements = ['Minimum', 'Recommended'].map((key) => ({
    title: text(source.SystemRequirements?.[key]?.Title, 300),
    items: list(source.SystemRequirements?.[key]?.Items).map((item) => ({ name: text(item.Name, 300), value: text(item.Description, 2000) })).filter((item) => item.name && item.value),
  })).filter((item) => item.items.length);
  const legal = skuText.LegalText || {};
  return {
    productId, market, locale, source: 'microsoft-store',
    storeUrl: `https://apps.microsoft.com/detail/${productId}?hl=${encodeURIComponent(locale)}&gl=${market}`,
    title: text(source.Title || localized.ProductTitle, 500), description: text(source.Description || localized.ProductDescription),
    developer: text(source.DeveloperName || localized.DeveloperName, 500), publisher: text(source.PublisherName || localized.PublisherName, 500),
    category: text(typeof source.Categories?.[0] === 'string' ? source.Categories[0] : source.Categories?.[0]?.Name || source.CategoryId || base.Properties?.Category, 300),
    categories: strings(source.Categories?.map((item) => typeof item === 'string' ? item : item.Name)),
    images, screenshots: images.filter((item) => /screenshot/i.test(item.purpose)),
    trailers: list(source.Trailers?.length ? source.Trailers : localized.Videos).map((item) => ({ title: text(item.Title, 500), url: storeUrl(item.Url || item.Uri), thumbnail: storeUrl(item.Image?.Url || item.PreviewImageUri, true), purpose: text(item.VideoPurpose, 100) })).filter((item) => item.url),
    ratings: [...localRatings, ...otherRatings], primaryRating: [...localRatings, ...otherRatings].find((item) => item.system === ({ BR: 'DJCTQ', US: 'ESRB', ES: 'PEGI' })[market] || item.id.startsWith(`${({ BR: 'DJCTQ', US: 'ESRB', ES: 'PEGI' })[market]}:`)) || null,
    price, currency, displayPrice: text(source.DisplayPrice, 100), isFree: price === null ? null : price === 0,
    releaseDate: date(source.ReleaseDateUtc || marketData.OriginalReleaseDate),
    updatedAt: date(source.LastUpdateDateUtc || sku.Sku?.Properties?.LastUpdateDate), listingModifiedAt: date(base.LastModifiedDate),
    version: packageVersion(source.Version) || packages.find((item) => item.version)?.version || null,
    packages, downloadSizeBytes: number(source.ApproximateSizeInBytes) ?? packages[0]?.downloadSizeBytes ?? null,
    installSizeBytes: number(source.MaxInstallSizeInBytes) ?? packages[0]?.installSizeBytes ?? null,
    languages: strings(source.SupportedLanguages?.length ? source.SupportedLanguages : sku.Sku?.MarketProperties?.[0]?.SupportedLanguages),
    platforms: strings(source.AllowedPlatforms),
    architectures: strings(source.Platforms), features: strings(source.Features), releaseNotes: strings(source.Notes?.length ? source.Notes : [skuText.ReleaseNotes]),
    requirements, permissions: strings(source.PermissionsRequired), capabilities: strings(source.PackageAndDeviceCapabilities),
    hasInAppPurchases: typeof source.HasThirdPartyIAPs === 'boolean' ? source.HasThirdPartyIAPs : null,
    averageRating: number(source.AverageRating ?? usage.AverageRating), ratingCount: number(source.RatingCount ?? usage.RatingCount),
    downloadCount: null, copyright: text(source.PublisherCopyrightInformation || legal.Copyright, 3000),
    licenseTerms: text(source.AdditionalLicenseTerms || legal.AdditionalLicenseTerms), installationTerms: text(source.InstallationTerms, 5000),
    privacyUrl: storeUrl(source.PrivacyUrl || legal.PrivacyPolicyUri), publisherUrl: storeUrl(localized.PublisherWebsiteUri),
    supportUrl: storeUrl(source.SupportUris?.find((item) => item.Uri)?.Uri || localized.SupportUri),
  };
}
