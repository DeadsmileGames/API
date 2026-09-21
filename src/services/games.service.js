import { AppError } from '../utils/AppError.js';
import { listGames, findGameBySlug, findRelatedGames, findGameContent } from '../repositories/games.repository.js';

function toClientGame(row) {
  const isFree = !row.purchase_url;
  return {
    id:               row.id,
    title:            row.title,
    slug:             row.slug,
    shortDescription: row.short_description,
    status:           row.status,
    releaseDate:      row.release_date,
    heroImage:        row.hero_image,
    coverImage:       row.cover_image,
    trailerUrl:       row.trailer_url,
    featured:         row.featured,
    genres:           row.genres    || [],
    platforms:        row.platforms || [],
    purchaseUrl:      row.purchase_url || null,
    downloadUrl:      isFree ? row.download_url || null : null,
    commerceEnabled:  Boolean(row.purchase_url && row.itch_game_id),
    itchGameId:        row.itch_game_id ? Number(row.itch_game_id) : null,
    engine:            row.engine || 'native',
    savePathTemplate:  row.save_path_template || null,
    cloudSavesEnabled: Boolean(row.cloud_saves_enabled),
    telemetryEnabled:  row.telemetry_enabled !== false,
  };
}

export async function getGamesList({ page, limit, featured, genre, platform, status }) {
  const { items, total } = await listGames({ page, limit, featured, genre, platform, status });
  return {
    items: items.map(toClientGame),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function getGameDetails(slug) {
  const game = await findGameBySlug(slug);
  if (!game) throw new AppError(404, 'GAME_NOT_FOUND', 'That game could not be found.');

  const related = await findRelatedGames(game.id, game.genres, 4);
  const content = await findGameContent(game.id, game.title);

  return {
    ...toClientGame(game),
    description:  game.description,
    screenshots:  game.screenshots,
    relatedGames: related.map(toClientGame),
    videos: content.videos.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      thumbnail: item.thumbnail,
      videoUrl: item.video_url,
      durationSeconds: item.duration_seconds,
      publishedAt: item.published_at,
    })),
    news: content.news,
    recommendedGame: content.recommended ? toClientGame(content.recommended) : null,
  };
}
