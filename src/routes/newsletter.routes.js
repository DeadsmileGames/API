import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { newsletterSchema } from '../validators/newsletter.validators.js';
import { publicWriteLimiter } from '../middleware/rateLimiters.js';
import { create } from '../controllers/newsletter.controller.js';

export const newsletterRouter = Router();

newsletterRouter.post('/', publicWriteLimiter, validate(newsletterSchema), create);
