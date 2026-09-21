import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';
import * as controller from '../controllers/wishlist.controller.js';

const gameBodySchema = z.object({
  gameId: z.string().uuid({ message: 'gameId must be a valid UUID' }),
}).strict();

const gameParamsSchema = z.object({
  gameId: z.string().uuid({ message: 'gameId must be a valid UUID' }),
}).strict();

export const wishlistRouter = Router();
wishlistRouter.use(requireAuth);
wishlistRouter.get('/', controller.list);
wishlistRouter.post('/', validate(gameBodySchema), controller.add);
wishlistRouter.delete('/:gameId', validate(gameParamsSchema, 'params'), controller.remove);
wishlistRouter.get('/:gameId/check', validate(gameParamsSchema, 'params'), controller.check);
