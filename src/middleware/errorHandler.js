import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { sendError } from '../utils/apiResponse.js';

export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return sendError(res, err.status, err.code);
  }

  if (err?.type === 'entity.too.large') {
    return sendError(res, 413, 'PAYLOAD_TOO_LARGE');
  }

  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError && err?.status === 400) {
    return sendError(res, 400, 'INVALID_JSON');
  }

  if (err?.code === '23505') {
    const constraint = String(err.constraint || '');
    if (constraint.includes('username')) {
      return sendError(res, 409, 'USERNAME_TAKEN');
    }
    if (constraint.includes('email')) {
      return sendError(res, 409, 'EMAIL_TAKEN');
    }
    return sendError(res, 409, 'CONFLICT');
  }

  if (err?.code === '23503' || err?.code === '23514' || err?.code === '22P02') {
    return sendError(res, 400, 'INVALID_REQUEST');
  }

  if (['57014', '57P01', '57P02', '57P03', '08000', '08003', '08006', '08001'].includes(err?.code)) {
    return sendError(res, 503, 'SERVICE_UNAVAILABLE');
  }

  if (!env.isProduction) {
    console.error(err);
  } else {
    console.error('Unhandled API error', {
      code: err?.code || null,
      name: err?.name || null,
      path: req.path,
      method: req.method
    });
  }
  return sendError(res, 500, 'INTERNAL_ERROR');
}

export function notFoundHandler(_req, res) {
  return sendError(res, 404, 'NOT_FOUND');
}
