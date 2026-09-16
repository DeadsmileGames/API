import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { integrationLimiter } from '../middleware/rateLimiters.js';
import { validate } from '../middleware/validate.js';
import { libraryGameSchema } from '../validators/itch-integration.validators.js';
import * as controller from '../controllers/library.controller.js';

export const libraryRouter = Router();

libraryRouter.use(requireAuth);
libraryRouter.get('/', controller.list);
libraryRouter.post('/sync', integrationLimiter, controller.sync);
libraryRouter.post('/:gameId/verify', integrationLimiter, validate(libraryGameSchema, 'params'), controller.verify);
libraryRouter.post('/:gameId/download-authorization', integrationLimiter, validate(libraryGameSchema, 'params'), controller.downloadAuthorization);
