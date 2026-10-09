import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { listGamesSchema, gameSlugSchema } from '../validators/games.validators.js';
import { list, details, download } from '../controllers/games.controller.js';
import { downloadLimiter } from '../middleware/rateLimiters.js';

export const gamesRouter = Router();

gamesRouter.get('/',      validate(listGamesSchema, 'query'),  list);
gamesRouter.get('/:slug/download', downloadLimiter, validate(gameSlugSchema, 'params'), download);
gamesRouter.get('/:slug', validate(gameSlugSchema,  'params'), details);
