import { sendError } from '../utils/apiResponse.js';
export function expectedAccount(req, res, next) {
  const expected = req.body?.expectedUserId;
  if (expected != null && expected !== req.auth?.userId) {
    return sendError(res, 409, 'ACCOUNT_CHANGED');
  }
  return next();
}
