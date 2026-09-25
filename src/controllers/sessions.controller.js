import { query } from "../config/database.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
    sendSuccess,
    sendError,
} from "../utils/apiResponse.js";

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const listSessions = asyncHandler(
    async (req, res) => {
        res.set("Cache-Control", "private, no-store");

        const { rows } = await query(
            `
            SELECT
                sess->'device'->>'id' AS id,
                sess->'device'->>'client' AS client,
                sess->'device'->>'platform' AS platform,
                sess->'device'->>'createdAt' AS "createdAt",
                expire AS "expiresAt"
            FROM user_sessions
            WHERE sess->>'userId' = $1
              AND expire > NOW()
              AND sess->'device'->>'id' IS NOT NULL
            ORDER BY expire DESC
            LIMIT 50
            `,
            [String(req.session.userId)]
        );

        const currentDeviceId =
            req.session.device?.id || null;

        const sessions = rows.map((row) => ({
            id: row.id,
            client: row.client,
            platform: row.platform,
            createdAt: row.createdAt,
            expiresAt: row.expiresAt,
            isCurrent: row.id === currentDeviceId,
        }));

        return sendSuccess(res, { sessions });
    }
);

export const revokeSession = asyncHandler(
    async (req, res) => {
        res.set("Cache-Control", "private, no-store");

        const deviceId = req.params.deviceId;

        if (!UUID_PATTERN.test(deviceId)) {
            return sendError(
                res,
                400,
                "INVALID_SESSION_ID",
                "Invalid session identifier."
            );
        }

        if (deviceId === req.session.device?.id) {
            return sendError(
                res,
                409,
                "CURRENT_SESSION",
                "Use logout to end your current session."
            );
        }

        const result = await query(
            `
            DELETE FROM user_sessions
            WHERE sess->>'userId' = $1
              AND sess->'device'->>'id' = $2
              AND expire > NOW()
            `,
            [
                String(req.session.userId),
                deviceId,
            ]
        );

        if (result.rowCount === 0) {
            return sendError(
                res,
                404,
                "SESSION_NOT_FOUND",
                "This session is no longer active."
            );
        }

        return sendSuccess(res, {
            revoked: true,
        });
    }
);