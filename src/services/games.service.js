import { AppError } from '../utils/AppError.js';
import { listGames, findGameBySlug, findRelatedGames, findGameContent } from '../repositories/games.repository.js';

import { toClientGame } from '../utils/clientGame.js';
import { getMicrosoftProduct } from './microsoft-store.service.js';
import { verifyGameOwnership } from './itch-integration.service.js';
import { isHttpsUrl } from '../utils/url.js';

export async function getGamesList({ page, limit, featured, genre, platform, status }) {
  const { items, total } = await listGames({ page, limit, featured, genre, platform, status });
  return {
    items: items.map(toClientGame),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    }
  };
}

export async function getGameDetails(slug, locale = 'en') {
  const game = await findGameBySlug(slug);
  if (!game) throw new AppError(404, 'GAME_NOT_FOUND');

  const [related, content, microsoftStore] = await Promise.all([
    findRelatedGames(game.id, game.genres, 4),
    findGameContent(game.id, game.title),
    game.microsoft_product_id ? getMicrosoftProduct(game.microsoft_product_id, locale, { optional: true }) : null,
  ]);

  return {
    ...toClientGame(game),
    microsoftStore,
    description: game.description,
    screenshots: game.screenshots,
    relatedGames: related.map(toClientGame),
    videos: content.videos.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      thumbnail: item.thumbnail,
      videoUrl: item.video_url,
      durationSeconds: item.duration_seconds,
      publishedAt: item.published_at
    })),
    news: content.news,
    recommendedGame: content.recommended ? toClientGame(content.recommended) : null
  };
}

export async function getGameDownload(slug, userId) {
  const game = await findGameBySlug(slug);
  if (!game) throw new AppError(404, 'GAME_NOT_FOUND');
  if (game.status !== 'released') throw new AppError(409, 'GAME_NOT_RELEASED');
  if (game.access_type !== 'free') {
    if (!userId) throw new AppError(401, 'UNAUTHENTICATED');
    if (!(await verifyGameOwnership(userId, game.id)).owned) throw new AppError(403, 'GAME_NOT_OWNED');
  }
  if (!isHttpsUrl(game.download_url)) throw new AppError(409, 'GAME_RELEASE_NOT_CONFIGURED');
  return { downloadUrl: game.download_url };
}
