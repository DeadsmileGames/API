import { query } from '../config/database.js';
import { toClientGame } from '../utils/clientGame.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as service from '../services/admin.service.js';

export const newsletter = asyncHandler(async (req, res) => {
  const result = await service.publishNewsletter(req.body);
  sendSuccess(res, result, 201);
});

export const video = asyncHandler(async (req, res) => {
  const result = await service.publishVideo(req.body);
  sendSuccess(res, result, 201);
});

export const game = asyncHandler(async (req, res) => {
  const result = await service.publishGame(req.body);
  sendSuccess(res, result, 201);
});

export const updateNewsletter = asyncHandler(
    async (req, res) => {
        sendSuccess(
            res,
            await service.editNewsletter(
                req.params.id,
                req.body
            )
        );
    }
);

export const updateVideo = asyncHandler(
    async (req, res) => {
        sendSuccess(
            res,
            await service.editVideo(
                req.params.id,
                req.body
            )
        );
    }
);

export const updateGame = asyncHandler(
    async (req, res) => {
        sendSuccess(
            res,
            await service.editGame(
                req.params.id,
                req.body
            )
        );
    }
);

export const deleteNewsletter = asyncHandler(async (req, res) => {
  const result = await service.removeNewsletter(req.params.id);
  sendSuccess(res, result);
});

export const deleteVideo = asyncHandler(async (req, res) => {
  const result = await service.removeVideo(req.params.id);
  sendSuccess(res, result);
});

export const deleteGame = asyncHandler(async (req, res) => {
  const result = await service.removeGame(req.params.id);
  sendSuccess(res, result);
});

export const gameDetails = asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM games WHERE id = $1', [req.params.id]);
  if (!rows[0]) throw new AppError(404, 'GAME_NOT_FOUND');
  const game = toClientGame(rows[0], { includeDownload: true });
  const [genres, platforms] = await Promise.all([
    query('SELECT n.name FROM genres n JOIN game_genres j ON j.genre_id = n.id WHERE j.game_id = $1', [req.params.id]),
    query('SELECT n.name FROM platforms n JOIN game_platforms j ON j.platform_id = n.id WHERE j.game_id = $1', [req.params.id]),
  ]);
  const badge = game.microsoftStoreBadge;
  sendSuccess(res, { ...game, description: rows[0].description, genres: genres.rows.map((row) => row.name), platforms: platforms.rows.map((row) => row.name),
    microsoftStoreBadgeHtml: badge ? `<a href="${badge.href}" target="_self" aria-label="Get it from Microsoft Store"><img src="${badge.imageUrl}" width="200" alt="Get it from Microsoft Store" loading="lazy"></a>` : '' });
});
