import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { listGamesSchema, gameSlugSchema } from '../validators/games.validators.js';
import { list, details } from '../controllers/games.controller.js';

export const gamesRouter = Router();

gamesRouter.get('/',      validate(listGamesSchema, 'query'),  list);
gamesRouter.get('/:slug', validate(gameSlugSchema,  'params'), details);
