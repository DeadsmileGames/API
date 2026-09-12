import { AppError } from '../utils/AppError.js';
import {
  createNewsletter,
  createVideo,
  createGame,
  deleteNews,
  deleteVideo,
  deleteGame,
} from '../repositories/admin.repository.js';
import { findGameBySlug } from '../repositories/games.repository.js';

export async function publishNewsletter(payload) {
  return createNewsletter(payload);
}

export async function publishVideo(payload) {
  return createVideo(payload);
}

export async function publishGame(payload) {
  const existing = await findGameBySlug(payload.slug);

  if (existing) {
    throw new AppError(
      409,
      'GAME_SLUG_TAKEN',
      'That game slug is already in use.'
    );
  }
  return createGame(payload);
}

async function remove(fn, id, label) {
  const removed = await fn(id);
  if (!removed) throw new AppError(404, `${label.toUpperCase()}_NOT_FOUND`, `${label} was not found.`);
  return { deleted: true, id };
}

export const removeNewsletter = (id) => remove(deleteNews,   id, 'newsletter');
export const removeVideo      = (id) => remove(deleteVideo,  id, 'video');
export const removeGame       = (id) => remove(deleteGame,   id, 'game');
