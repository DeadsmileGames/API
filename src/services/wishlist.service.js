import { AppError } from '../utils/AppError.js';
import * as repo from '../repositories/wishlist.repository.js';
import { publishWishlistEvent } from './notification.service.js';

export async function addWishlist(userId, gameId) {
  const result = await repo.addWishlist(userId, gameId);
  if (!result) throw new AppError(409, 'ALREADY_IN_WISHLIST', 'Game is already in your wishlist.');
  await publishWishlistEvent(userId, gameId, true);
  return result;
}

export async function removeWishlist(userId, gameId) {
  const removed = await repo.removeWishlist(userId, gameId);
  if (!removed) throw new AppError(404, 'NOT_IN_WISHLIST', 'Game not found in your wishlist.');
  await publishWishlistEvent(userId, gameId, false);
  return { deleted: true };
}

export async function listWishlist(userId) {
  return repo.listWishlist(userId);
}

export async function checkWishlist(userId, gameId) {
  return repo.checkWishlist(userId, gameId);
}
