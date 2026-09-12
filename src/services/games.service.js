import { AppError } from '../utils/AppError.js';
import { listGames, findGameBySlug, findRelatedGames } from '../repositories/games.repository.js';

function toClientGame(row) {
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
    downloadUrl:      row.download_url || null,
    commerceEnabled:  Boolean(row.purchase_url && row.itch_game_id),
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

  return {
    ...toClientGame(game),
    description:  game.description,
    screenshots:  game.screenshots,
    relatedGames: related.map(toClientGame),
  };
}
