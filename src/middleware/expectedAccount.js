import { sendError } from '../utils/apiResponse.js';

// The optional owner ID protects work originating from an earlier game session
// when the desktop launcher has since switched to another authenticated user.
// Other clients that do not send this field keep the existing API contract.
export function expectedAccount(req, res, next) {
  const expected = req.body?.expectedUserId;
  if (expected != null && expected !== req.auth?.userId) {
    return sendError(res, 409, 'ACCOUNT_CHANGED', 'The authenticated account changed. Sign in to the original account to synchronize.');
  }
  return next();
}
