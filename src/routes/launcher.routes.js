import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getMicrosoftProduct, LAUNCHER_PRODUCT_ID } from '../services/microsoft-store.service.js';

export const launcherRouter = Router();
launcherRouter.get('/', asyncHandler(async (_req, res) => {
  sendSuccess(res, await getMicrosoftProduct(LAUNCHER_PRODUCT_ID, res.locals.locale));
}));
