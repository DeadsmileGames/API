import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { contentListSchema, contentSlugSchema } from '../validators/content.validators.js';
import * as controller from '../controllers/content.controller.js';

export const newsRouter = Router();
newsRouter.get('/',      validate(contentListSchema, 'query'), controller.news);
newsRouter.get('/:slug', validate(contentSlugSchema, 'params'), controller.newsDetails);

export const videosRouter = Router();
videosRouter.get('/',     validate(contentListSchema, 'query'), controller.videos);
videosRouter.get('/:id',                                        controller.videoDetails);

export const downloadsRouter = Router();
downloadsRouter.get('/', controller.downloads);

export const productsRouter = Router();
productsRouter.get('/', controller.products);
