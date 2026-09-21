import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import {
  newsletterSchema,
  newsletterConfirmationTokenSchema,
  newsletterUnsubscribeTokenSchema,
} from '../validators/newsletter.validators.js';
import { publicWriteLimiter } from '../middleware/rateLimiters.js';
import { confirmSubscription, create, unsubscribeSubscription } from '../controllers/newsletter.controller.js';

export const newsletterRouter = Router();

newsletterRouter.post('/', publicWriteLimiter, validate(newsletterSchema), create);
newsletterRouter.post('/confirm', publicWriteLimiter, validate(newsletterConfirmationTokenSchema), confirmSubscription);
newsletterRouter.post('/unsubscribe', publicWriteLimiter, validate(newsletterUnsubscribeTokenSchema), unsubscribeSubscription);
