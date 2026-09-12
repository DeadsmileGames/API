import { sendError } from '../utils/apiResponse.js';

export function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return sendError(res, 401, 'UNAUTHENTICATED', 'You must be signed in to do that.');
  }
  next();
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.session?.userId) {
      return sendError(res, 401, 'UNAUTHENTICATED', 'You must be signed in to do that.');
    }
    if (req.session.role !== role) {
      return sendError(res, 403, 'FORBIDDEN', 'You do not have permission to do that.');
    }
    next();
  };
}
