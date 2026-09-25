import { AppError } from '../utils/AppError.js';
import {
  createNewsletter,
  createVideo,
  createGame,
  deleteNews,
  deleteVideo,
  deleteGame,
  updateNews,
  updateVideo,
  updateGame,
} from '../repositories/admin.repository.js';
import { findGameBySlug } from '../repositories/games.repository.js';
import { publishContentEvent } from './notification.service.js';

export async function publishNewsletter(payload) {
  const item = await createNewsletter(payload);
  await publishContentEvent('news', item);
  return item;
}

export async function publishVideo(payload) {
  const item = await createVideo(payload);
  await publishContentEvent('video', item);
  return item;
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
  const item = await createGame(payload);
  await publishContentEvent('game', item);
  return item;
}

async function updateOr404(fn, id, payload, label) {
    const item = await fn(id, payload);

    if (!item) {
        throw new AppError(
            404,
            `${label.toUpperCase()}_NOT_FOUND`,
            `${label} was not found.`
        );
    }

    return item;
}

export const editNewsletter = (id, payload) =>
    updateOr404(
        updateNews,
        id,
        payload,
        "newsletter"
    );

export const editVideo = (id, payload) =>
    updateOr404(
        updateVideo,
        id,
        payload,
        "video"
    );

export async function editGame(id, payload) {
    const existing = await findGameBySlug(payload.slug);

    if (existing && existing.id !== id) {
        throw new AppError(
            409,
            "GAME_SLUG_TAKEN",
            "That game slug is already in use."
        );
    }

    return updateOr404(
        updateGame,
        id,
        payload,
        "game"
    );
}

async function remove(fn, id, label) {
  const removed = await fn(id);
  if (!removed) throw new AppError(404, `${label.toUpperCase()}_NOT_FOUND`, `${label} was not found.`);
  return { deleted: true, id };
}

export const removeNewsletter = (id) => remove(deleteNews,   id, 'newsletter');
export const removeVideo      = (id) => remove(deleteVideo,  id, 'video');
export const removeGame       = (id) => remove(deleteGame,   id, 'game');
