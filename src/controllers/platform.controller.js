import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as service from '../services/platform.service.js';

export const status = asyncHandler(async (_req, res) => sendSuccess(res, await service.status()));
export const startSession = asyncHandler(async (req, res) => sendSuccess(res, await service.startSession(req.session.userId, req.body), 201));
export const endSession = asyncHandler(async (req, res) => sendSuccess(res, await service.endSession(req.session.userId, req.params.sessionId)));
export const achievements = asyncHandler(async (req, res) => sendSuccess(res, await service.achievements(req.session.userId, req.params.gameId)));
export const unlock = asyncHandler(async (req, res) => sendSuccess(res, await service.unlock(req.session.userId, req.params.gameId, req.params.key)));
export const downloadSave = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  sendSuccess(res, await service.downloadSave(req.session.userId, req.params.gameId, req.params.slot));
});
export const uploadSave = asyncHandler(async (req, res) => sendSuccess(res, await service.uploadSave(req.session.userId, req.params.gameId, req.params.slot, req.body)));
export const consent = asyncHandler(async (req, res) => sendSuccess(res, await service.setConsent(req.session.userId, req.body.enabled)));
export const telemetry = asyncHandler(async (req, res) => sendSuccess(res, await service.telemetry(req.session.userId, req.body), 202));
export const events = asyncHandler(async (req, res) => sendSuccess(res, await service.events(req.session?.userId || null, req.query)));
export const liveTicket = asyncHandler(async (req, res) => sendSuccess(res, await service.liveTicket(req.session.userId)));
export const pushSubscription = asyncHandler(async (req, res) => sendSuccess(res, await service.savePushSubscription(req.session.userId, req.body), 201));
export const removePushSubscription = asyncHandler(async (req, res) => sendSuccess(res, await service.removePushSubscription(req.session.userId, req.body.token)));
export const saves = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  sendSuccess(res, await service.saves(req.session.userId, req.params.gameId));
});

export const deleteSave = asyncHandler(async (req, res) =>
  sendSuccess(res, await service.deleteSave(req.session.userId, req.params.gameId, req.params.slot))
);