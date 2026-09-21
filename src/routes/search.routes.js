import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { searchLimiter } from '../middleware/rateLimiters.js';
import { searchSchema } from '../validators/search.validators.js';
import { search } from '../controllers/search.controller.js';

export const searchRouter = Router();

searchRouter.get('/', searchLimiter, validate(searchSchema, 'query'), search);
