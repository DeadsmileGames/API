import { AppError } from '../utils/AppError.js';
import { sendError } from '../utils/apiResponse.js';

export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return sendError(res, err.status, err.code, err.message);
  }

  if (err?.code === '23505') {
    const constraint = String(err.constraint || '');
    if (constraint.includes('username')) {
      return sendError(res, 409, 'USERNAME_TAKEN', 'That username is already taken.');
    }
    if (constraint.includes('email')) {
      return sendError(res, 409, 'EMAIL_TAKEN', 'That email is already registered.');
    }
    return sendError(res, 409, 'CONFLICT', 'That value is already in use.');
  }

  return sendError(res, 500, 'INTERNAL_ERROR', 'Something went wrong on our end.');
}

export function notFoundHandler(_req, res) {
  return sendError(res, 404, 'NOT_FOUND', 'This endpoint does not exist.');
}
