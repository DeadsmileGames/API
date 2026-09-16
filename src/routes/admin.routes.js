import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { newsletterPostSchema, videoPostSchema, gamePostSchema, adminIdSchema } from '../validators/admin.validators.js';
import * as controller from '../controllers/admin.controller.js';
import * as platformController from '../controllers/admin-platform.controller.js';
import { achievementAdminSchema, betaSchema, buildSchema, channelSchema, incidentSchema } from '../validators/admin-platform.validators.js';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole('admin'));

adminRouter.post('/newsletter',        validate(newsletterPostSchema), controller.newsletter);
adminRouter.post('/video',             validate(videoPostSchema),      controller.video);
adminRouter.post('/game',              validate(gamePostSchema),       controller.game);
adminRouter.delete('/newsletter/:id', validate(adminIdSchema, 'params'), controller.deleteNewsletter);
adminRouter.delete('/video/:id', validate(adminIdSchema, 'params'), controller.deleteVideo);
adminRouter.delete('/game/:id', validate(adminIdSchema, 'params'), controller.deleteGame);
adminRouter.get('/platform', platformController.overview);
adminRouter.post('/platform/channels', validate(channelSchema), platformController.channel);
adminRouter.post('/platform/builds', validate(buildSchema), platformController.build);
adminRouter.post('/platform/achievements', validate(achievementAdminSchema), platformController.achievement);
adminRouter.post('/platform/beta', validate(betaSchema), platformController.beta);
adminRouter.post('/platform/incidents', validate(incidentSchema), platformController.incident);
