import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { supportSchema } from '../validators/support.validators.js';
import { publicWriteLimiter } from '../middleware/rateLimiters.js';
import { create } from '../controllers/support.controller.js';

export const supportRouter = Router();

supportRouter.post('/', publicWriteLimiter, validate(supportSchema), create);
