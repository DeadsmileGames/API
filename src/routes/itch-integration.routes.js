import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { integrationLimiter } from '../middleware/rateLimiters.js';
import { validate } from '../middleware/validate.js';
import {
  completeItchSchema,
  connectItchSchema,
} from '../validators/itch-integration.validators.js';
import * as controller from '../controllers/itch-integration.controller.js';

export const itchIntegrationRouter = Router();

itchIntegrationRouter.get('/callback', controller.callback);
itchIntegrationRouter.post('/complete', integrationLimiter, validate(completeItchSchema), controller.complete);
itchIntegrationRouter.get('/', requireAuth, controller.status);
itchIntegrationRouter.post('/connect', requireAuth, integrationLimiter, validate(connectItchSchema), controller.connect);
itchIntegrationRouter.delete('/', requireAuth, integrationLimiter, controller.disconnect);
