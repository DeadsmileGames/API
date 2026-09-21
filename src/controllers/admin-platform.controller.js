import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import * as repository from '../repositories/admin-platform.repository.js';

function requiredResult(value, code, message) {
  if (!value) throw new AppError(400, code, message);
  return value;
}

export const overview = asyncHandler(async (_req, res) => sendSuccess(res, await repository.overview()));

export const channel = asyncHandler(async (req, res) => {
  const value = requiredResult(await repository.createChannel(req.body), 'GAME_NOT_FOUND', 'The selected game does not exist.');
  sendSuccess(res, value, 201);
});

export const build = asyncHandler(async (req, res) => {
  const value = requiredResult(await repository.createBuild(req.body), 'CHANNEL_GAME_MISMATCH', 'The selected release channel does not belong to this game.');
  sendSuccess(res, value, 201);
});

export const achievement = asyncHandler(async (req, res) => {
  const value = requiredResult(await repository.createAchievement(req.body), 'GAME_NOT_FOUND', 'The selected game does not exist.');
  sendSuccess(res, value, 201);
});

export const beta = asyncHandler(async (req, res) => {
  const value = requiredResult(await repository.grantBeta(req.body), 'BETA_TARGET_INVALID', 'The user, game, or release channel is invalid.');
  sendSuccess(res, value, 201);
});

export const incident = asyncHandler(async (req, res) => sendSuccess(res, await repository.createIncident(req.body), 201));
