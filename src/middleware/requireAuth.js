import { query } from '../config/database.js';
import { sendError } from '../utils/apiResponse.js';

export async function requireAuth(req, res, next) {
  res.set('Cache-Control', 'private, no-store');
  const userId = req.session?.userId;
  if (!userId) {
    return sendError(res, 401, 'UNAUTHENTICATED', 'You must be signed in to do that.');
  }

  try {
    const { rows } = await query(
      `SELECT id, role, email_verified_at
      FROM users
      WHERE id = $1`,
      [userId],
    );
    const user = rows[0];
    if (!user) {
      req.session.destroy(() => {});
      return sendError(res, 401, 'UNAUTHENTICATED', 'You must be signed in to do that.');
    }
    if (!user.email_verified_at) {
      req.session.destroy(() => {});

      return sendError(
        res,
        403,
        'EMAIL_NOT_VERIFIED',
        'Confirm your email before accessing your account.',
      );
    }
    req.auth = { userId: user.id, role: user.role };
    if (req.session.role && req.session.role !== user.role) {
      await new Promise((resolve, reject) => {
        req.session.regenerate((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      req.session.userId = user.id;
      req.session.role = user.role;
    } else if (req.session.role !== user.role) {
      req.session.role = user.role;
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.auth?.userId) {
      return sendError(res, 401, 'UNAUTHENTICATED', 'You must be signed in to do that.');
    }
    if (req.auth.role !== role) {
      return sendError(res, 403, 'FORBIDDEN', 'You do not have permission to do that.');
    }
    return next();
  };
}
