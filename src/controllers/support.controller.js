import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { createTicket } from '../services/support.service.js';

export const create = asyncHandler(async (req, res) => {
  const data = await createTicket(req.body);
  sendSuccess(res, data, 201);
});
