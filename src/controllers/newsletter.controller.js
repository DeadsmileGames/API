import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { confirm, subscribe, unsubscribe } from '../services/newsletter.service.js';

export const create = asyncHandler(async (req, res) => {
  const data = await subscribe(req.body.email);
  sendSuccess(res, data, 201);
});

export const confirmSubscription = asyncHandler(async (req, res) => {
  sendSuccess(res, await confirm(req.body.token));
});

export const unsubscribeSubscription = asyncHandler(async (req, res) => {
  sendSuccess(res, await unsubscribe(req.body.token));
});
