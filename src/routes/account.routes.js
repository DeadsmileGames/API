import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { updateAccountSchema, deleteAccountSchema, publicProfileSchema } from '../validators/account.validators.js';
import { show, update, remove, publicProfile } from '../controllers/account.controller.js';
import * as totpController from '../controllers/totp.controller.js';
import { totpTokenSchema } from '../validators/totp.validators.js';
import { env } from '../config/env.js';
import { sendError } from '../utils/apiResponse.js';
import { twoFactorLimiter } from '../middleware/rateLimiters.js';

function trustedFrontendOrigin(req, res, next) {
  const origin = req.get('origin');
  const referer = req.get('referer');
  let refererOrigin = null;
  if (referer) {
    try {
      refererOrigin = new URL(referer).origin;
    } catch {
      refererOrigin = null;
    }
  }
  if (origin === env.frontendUrl || refererOrigin === env.frontendUrl) return next();
  return sendError(res, 403, 'TRUSTED_ORIGIN_REQUIRED', 'Use the authenticated application to perform this action.');
}

export const accountRouter = Router();

accountRouter.get('/profile/:username', validate(publicProfileSchema, 'params'), publicProfile);
accountRouter.get('/',                  requireAuth,                           show);
accountRouter.patch('/',                requireAuth, validate(updateAccountSchema), update);
accountRouter.delete('/',               requireAuth, validate(deleteAccountSchema), remove);
accountRouter.get('/totp/status', requireAuth, totpController.status);
accountRouter.get('/totp/setup', requireAuth, trustedFrontendOrigin, totpController.setup);
accountRouter.post('/totp/setup', requireAuth, twoFactorLimiter, totpController.setup);
accountRouter.post('/totp/enable', requireAuth, twoFactorLimiter, validate(totpTokenSchema), totpController.enable);
accountRouter.delete('/totp/disable', requireAuth, twoFactorLimiter, validate(totpTokenSchema), totpController.disable);
