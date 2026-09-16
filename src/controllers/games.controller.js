import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getGamesList, getGameDetails } from '../services/games.service.js';

export const list = asyncHandler(async (req, res) => {
  const data = await getGamesList(req.query);
  sendSuccess(res, data);
});

export const details = asyncHandler(async (req, res) => {
  const data = await getGameDetails(req.params.slug);
  sendSuccess(res, data);
});
