export function sendSuccess(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function sendError(res, status, code, message) {
  return res.status(status).json({ success: false, error: { code, message } });
}
