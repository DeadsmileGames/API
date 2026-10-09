import { storeBadgeFromRow } from './storeBadge.js';
import { isHttpsUrl } from './url.js';

export function toClientGame(row, { includeDownload = false } = {}) {
  const free = row.access_type === 'free';
  const downloadable = row.status === 'released' && isHttpsUrl(row.download_url);
  return {
    id: row.id, title: row.title, slug: row.slug,
    shortDescription: row.short_description, status: row.status,
    releaseDate: row.release_date, heroImage: row.hero_image,
    coverImage: row.cover_image, trailerUrl: row.trailer_url,
    featured: row.featured, genres: row.genres || [], platforms: row.platforms || [],
    accessType: row.access_type, isFree: free,
    purchaseUrl: row.purchase_url || null,
    downloadUrl: includeDownload ? row.download_url || null : null,
    downloadAvailable: downloadable,
    commerceEnabled: !free,
    launcherAvailable: downloadable,
    itchGameId: row.itch_game_id ? Number(row.itch_game_id) : null,
    itchUrl: row.itch_url || null, microsoftStoreBadge: storeBadgeFromRow(row),
    engine: row.engine || 'native', savePathTemplate: row.save_path_template || null,
    cloudSavesEnabled: Boolean(row.cloud_saves_enabled), telemetryEnabled: row.telemetry_enabled !== false,
  };
}
