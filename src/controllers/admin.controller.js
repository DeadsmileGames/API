import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as service from '../services/admin.service.js';

export const newsletter = asyncHandler(async (req, res) => {
  const result = await service.publishNewsletter(req.body);
  sendSuccess(res, result, 201);
});

export const video = asyncHandler(async (req, res) => {
  const result = await service.publishVideo(req.body);
  sendSuccess(res, result, 201);
});

export const game = asyncHandler(async (req, res) => {
  const result = await service.publishGame(req.body);
  sendSuccess(res, result, 201);
});

export const deleteNewsletter = asyncHandler(async (req, res) => {
  const result = await service.removeNewsletter(req.params.id);
  sendSuccess(res, result);
});

export const deleteVideo = asyncHandler(async (req, res) => {
  const result = await service.removeVideo(req.params.id);
  sendSuccess(res, result);
});

export const deleteGame = asyncHandler(async (req, res) => {
  const result = await service.removeGame(req.params.id);
  sendSuccess(res, result);
});
