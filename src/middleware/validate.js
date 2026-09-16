import { sendError } from '../utils/apiResponse.js';

export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const message = result.error.issues[0]?.message || 'Invalid request.';
      return sendError(res, 400, 'VALIDATION_ERROR', message);
    }
    req[source] = result.data;
    next();
  };
}
