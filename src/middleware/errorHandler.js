import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { sendError } from '../utils/apiResponse.js';

export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return sendError(res, err.status, err.code, err.message);
  }

  if (err?.type === 'entity.too.large') {
    return sendError(res, 413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.');
  }

  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError && err?.status === 400) {
    return sendError(res, 400, 'INVALID_JSON', 'The request body is not valid JSON.');
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

  if (err?.code === '23503' || err?.code === '23514' || err?.code === '22P02') {
    return sendError(res, 400, 'INVALID_REQUEST', 'The request contains an invalid or inconsistent value.');
  }

  if (['57014', '57P01', '57P02', '57P03', '08000', '08003', '08006', '08001'].includes(err?.code)) {
    return sendError(res, 503, 'SERVICE_UNAVAILABLE', 'The service is temporarily unavailable. Please try again.');
  }

  if (!env.isProduction) {
    console.error(err);
  } else {
    console.error('Unhandled API error', {
      code: err?.code || null,
      path: req.originalUrl,
      method: req.method,
    });
  }
  return sendError(res, 500, 'INTERNAL_ERROR', 'Something went wrong on our end.');
}

export function notFoundHandler(_req, res) {
  return sendError(res, 404, 'NOT_FOUND', 'This endpoint does not exist.');
}
