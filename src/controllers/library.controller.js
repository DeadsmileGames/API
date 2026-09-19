import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import {
  getInstallMetadata,
  getLibrary,
  syncItchLibrary,
  verifyGameOwnership,
} from '../services/itch-integration.service.js';

export const list = asyncHandler(async (req, res) => {
  sendSuccess(res, await getLibrary(req.session.userId));
});

export const sync = asyncHandler(async (req, res) => {
  sendSuccess(res, await syncItchLibrary(req.session.userId));
});

export const verify = asyncHandler(async (req, res) => {
  sendSuccess(res, await verifyGameOwnership(req.session.userId, req.params.gameId));
});

export const installMetadata = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  sendSuccess(res, await getInstallMetadata(req.session.userId, req.params.gameId));
});
