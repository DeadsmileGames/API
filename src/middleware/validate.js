import { sendError } from '../utils/apiResponse.js';

export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return sendError(res, 400, 'VALIDATION_ERROR');
    }
    req[source] = result.data;
    next();
  };
}
