import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { subscribe } from '../services/newsletter.service.js';

export const create = asyncHandler(async (req, res) => {
  const data = await subscribe(req.body.email);
  sendSuccess(res, data, 201);
});
