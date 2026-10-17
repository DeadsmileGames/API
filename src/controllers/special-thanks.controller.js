import { query } from "../config/database.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";

export const list = asyncHandler(async (_req, res) => {
  const { rows } = await query(
    `SELECT id, name, created_at
       FROM special_thanks
      ORDER BY created_at ASC, id ASC`,
  );
  sendSuccess(res, rows);
});

export const create = asyncHandler(async (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) throw new AppError(400, "VALIDATION_ERROR");

  try {
    const { rows } = await query(
      `INSERT INTO special_thanks (name, created_by)
       VALUES ($1, $2)
       RETURNING id, name, created_at`,
      [name, req.user?.id || null],
    );
    sendSuccess(res, rows[0], 201);
  } catch (error) {
    if (error?.code === "23505") throw new AppError(409, "CONFLICT");
    throw error;
  }
});

export const remove = asyncHandler(async (req, res) => {
  const { rows } = await query(
    "DELETE FROM special_thanks WHERE id = $1 RETURNING id",
    [req.params.id],
  );
  if (!rows[0]) throw new AppError(404, "NOT_FOUND");
  sendSuccess(res, { deleted: true, id: rows[0].id });
});
