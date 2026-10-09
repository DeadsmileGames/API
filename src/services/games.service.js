import { AppError } from '../utils/AppError.js';
import { listGames, findGameBySlug, findRelatedGames, findGameContent } from '../repositories/games.repository.js';

import { toClientGame } from '../utils/clientGame.js';

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

export async function getGameDetails(slug) {
  const game = await findGameBySlug(slug);
  if (!game) throw new AppError(404, 'GAME_NOT_FOUND');

  const related = await findRelatedGames(game.id, game.genres, 4);
  const content = await findGameContent(game.id, game.title);

  return {
    ...toClientGame(game),
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
