import { query } from "../config/database.js";
import { env } from "../config/env.js";
import { sendError } from "../utils/apiResponse.js";
import { isMobileTokenSessionCompatible, verifyMobileAccessToken } from "../utils/mobile-access-token.js";

export async function requireAuth(req, res, next) {
  res.set("Cache-Control", "private, no-store");
  let userId = req.session?.userId;
  let tokenClaims = null;
  const authorization = req.get("authorization");

  if (authorization) {
    const match = /^Bearer ([A-Za-z0-9._~-]+)$/i.exec(authorization);
    if (!match) return sendError(res, 401, "INVALID_ACCESS_TOKEN");
    try {
      tokenClaims = verifyMobileAccessToken(match[1], { sessionSecret: env.sessionSecret });
      if (!isMobileTokenSessionCompatible(tokenClaims, req.session, req.sessionID)) {
        return sendError(res, 401, "SESSION_IDENTITY_MISMATCH");
      }
      userId = tokenClaims.sub;
    } catch (error) {
      return sendError(res, 401, error?.code || "INVALID_ACCESS_TOKEN");
    }
  }

  if (!userId) return sendError(res, 401, "UNAUTHENTICATED");

  try {
    if (tokenClaims) {
      const { rows: sessions } = await query(
        "SELECT sid FROM user_sessions WHERE sid = $1 AND expire > now() AND sess->>'userId' = $2 AND sess->>'client' = 'mobile'",
        [tokenClaims.sid, tokenClaims.sub],
      );
      if (!sessions.length) return sendError(res, 401, "SESSION_EXPIRED");
    }

    const { rows } = await query(
      `SELECT id, role, email_verified_at
      FROM users
      WHERE id = $1`,
      [userId],
    );
    const user = rows[0];
    if (!user) {
      if (!tokenClaims) req.session.destroy(() => {});
      return sendError(res, 401, "UNAUTHENTICATED");
    }
    if (!user.email_verified_at) {
      if (!tokenClaims) req.session.destroy(() => {});
      return sendError(res, 403, "EMAIL_NOT_VERIFIED");
    }
    req.auth = { userId: user.id, role: user.role, sessionId: tokenClaims?.sid || req.sessionID };

    if (req.session?.userId === user.id) {
      if (req.session.role && req.session.role !== user.role) {
        const previousDevice = req.session.device;
        await new Promise((resolve, reject) => {
          req.session.regenerate((error) => {
            if (error) reject(error);
            else resolve();
          });
        });
        req.session.userId = user.id;
        req.session.role = user.role;
        if (previousDevice) req.session.device = previousDevice;
      } else if (req.session.role !== user.role) {
        req.session.role = user.role;
      }
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.auth?.userId) return sendError(res, 401, "UNAUTHENTICATED");
    if (req.auth.role !== role) return sendError(res, 403, "FORBIDDEN");
    return next();
  };
}
