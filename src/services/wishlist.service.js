import { AppError } from '../utils/AppError.js';
import * as repo from '../repositories/wishlist.repository.js';

export async function addWishlist(userId, gameId) {
  const result = await repo.addWishlist(userId, gameId);
  if (!result) throw new AppError(409, 'ALREADY_IN_WISHLIST', 'Game is already in your wishlist.');
  return result;
}

export async function removeWishlist(userId, gameId) {
  const removed = await repo.removeWishlist(userId, gameId);
  if (!removed) throw new AppError(404, 'NOT_IN_WISHLIST', 'Game not found in your wishlist.');
  return { deleted: true };
}

export async function listWishlist(userId) {
  return repo.listWishlist(userId);
}

export async function checkWishlist(userId, gameId) {
  return repo.checkWishlist(userId, gameId);
}