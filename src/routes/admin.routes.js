import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { newsletterPostSchema, videoPostSchema, gamePostSchema } from '../validators/admin.validators.js';
import * as controller from '../controllers/admin.controller.js';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole('admin'));

adminRouter.post('/newsletter',        validate(newsletterPostSchema), controller.newsletter);
adminRouter.post('/video',             validate(videoPostSchema),      controller.video);
adminRouter.post('/game',              validate(gamePostSchema),       controller.game);
adminRouter.delete('/newsletter/:id',                                  controller.deleteNewsletter);
adminRouter.delete('/video/:id',                                       controller.deleteVideo);
adminRouter.delete('/game/:id',                                        controller.deleteGame);
