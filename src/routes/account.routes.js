import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { updateAccountSchema, deleteAccountSchema } from '../validators/account.validators.js';
import { show, update, remove, publicProfile } from '../controllers/account.controller.js';
import * as totpController from '../controllers/totp.controller.js';
import { totpTokenSchema } from '../validators/totp.validators.js';


export const accountRouter = Router();

accountRouter.get('/profile/:username', publicProfile);
accountRouter.get('/',                  requireAuth,                           show);
accountRouter.patch('/',                requireAuth, validate(updateAccountSchema), update);
accountRouter.delete('/',               requireAuth, validate(deleteAccountSchema), remove);
accountRouter.get('/totp/status', requireAuth, totpController.status);
accountRouter.get('/totp/setup', requireAuth, totpController.setup);
accountRouter.post('/totp/enable', requireAuth, validate(totpTokenSchema), totpController.enable);
accountRouter.delete('/totp/disable', requireAuth, validate(totpTokenSchema), totpController.disable);
