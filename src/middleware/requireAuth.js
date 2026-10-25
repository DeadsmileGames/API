import { getLatestLegalAcceptance, isCurrentLegalAcceptance } from "../repositories/users.repository.js";
import { query } from "../config/database.js";
import { sendError } from "../utils/apiResponse.js";

export async function requireAuth(req, res, next) {
  res.set("Cache-Control", "private, no-store");
  const userId = req.session?.userId;
  if (!userId) return sendError(res, 401, "UNAUTHENTICATED");

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
      return sendError(res, 401, "UNAUTHENTICATED");
    }
    if (!user.email_verified_at) {
      req.session.destroy(() => {});
      return sendError(res, 403, "EMAIL_NOT_VERIFIED");
    }

    const latestAcceptance = await getLatestLegalAcceptance(user.id);
    const legalAcceptanceRequired = !isCurrentLegalAcceptance(latestAcceptance);
    req.auth = {
      userId: user.id,
      role: user.role,
      sessionId: req.sessionID,
      legalAcceptanceRequired,
    };

    const route = (req.baseUrl + req.path).replace(/\\/+$/, "") || "/";
    const legalAcceptanceExempt =
      (req.method === "GET" && route === "/api/auth/me") ||
      (req.method === "POST" && route === "/api/auth/accept-legal-documents") ||
      (req.method === "POST" && route === "/api/auth/logout") ||
      (req.method === "DELETE" && route === "/api/account") ||
      route === "/api/account/privacy";
    const browserSession = req.session?.device?.client !== "launcher";

    if (legalAcceptanceRequired && browserSession && !legalAcceptanceExempt) {
      return sendError(res, 403, "LEGAL_ACCEPTANCE_REQUIRED");
    }

    if (req.session?.userId === user.id) {
      if (req.session.role && req.session.role !== user.role) {
        const previousDevice = req.session.device;
        const previousClient = req.session.client;
        const previousCsrfToken = req.session.csrfToken;
        await new Promise((resolve, reject) => {
          req.session.regenerate((error) => {
            if (error) reject(error);
            else resolve();
          });
        });
        req.session.userId = user.id;
        req.session.role = user.role;
        if (previousCsrfToken) req.session.csrfToken = previousCsrfToken;
        if (previousDevice) req.session.device = previousDevice;
        if (previousClient) req.session.client = previousClient;
        req.auth.sessionId = req.sessionID;
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
