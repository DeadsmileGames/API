import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as service from '../services/wishlist.service.js';

export const add = asyncHandler(async (req, res) => {
  const { gameId } = req.body;
  const result = await service.addWishlist(req.session.userId, gameId);
  sendSuccess(res, result, 201);
});

export const remove = asyncHandler(async (req, res) => {
  const { gameId } = req.params;
  const result = await service.removeWishlist(req.session.userId, gameId);
  sendSuccess(res, result);
});

export const list = asyncHandler(async (req, res) => {
  const result = await service.listWishlist(req.session.userId);
  sendSuccess(res, result);
});

export const check = asyncHandler(async (req, res) => {
  const { gameId } = req.params;
  const result = await service.checkWishlist(req.session.userId, gameId);
  sendSuccess(res, { inWishlist: result });
});