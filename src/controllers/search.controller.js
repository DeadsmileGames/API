import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { performSearch } from '../services/search.service.js';

export const search = asyncHandler(async (req, res) => {
  const data = await performSearch(req.query);
  sendSuccess(res, data);
});
