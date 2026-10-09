import { publicErrorMessage } from './publicErrors.js';

export function sendSuccess(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function sendError(res, status, code, fields) {
  return res.status(status).json({
    success: false,
    error: {
      code,
      locale: res.locals?.locale || 'en',
      message: publicErrorMessage(code, status, res.locals?.locale),
      ...(fields?.length ? { fields } : {}),
    },
  });
}
