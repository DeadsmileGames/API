import { sendError } from '../utils/apiResponse.js';

export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Check the fields and try again.');
    }
    req[source] = result.data;
    next();
  };
}
