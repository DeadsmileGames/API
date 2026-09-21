import { query } from '../config/database.js';

export async function addWishlist(userId, gameId) {
  const { rows } = await query(
    `INSERT INTO wishlists (user_id, game_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, game_id) DO NOTHING
     RETURNING *`,
    [userId, gameId]
  );
  return rows[0] || null;
}

export async function removeWishlist(userId, gameId) {
  const { rowCount } = await query(
    'DELETE FROM wishlists WHERE user_id = $1 AND game_id = $2',
    [userId, gameId]
  );
  return rowCount > 0;
}

export async function listWishlist(userId) {
  const { rows } = await query(
    `SELECT g.id, g.title, g.slug, g.cover_image, g.short_description, g.status
     FROM wishlists w
     JOIN games g ON g.id = w.game_id
     WHERE w.user_id = $1
     ORDER BY w.created_at DESC`,
    [userId]
  );
  return rows;
}

export async function checkWishlist(userId, gameId) {
  const { rows } = await query(
    'SELECT 1 FROM wishlists WHERE user_id = $1 AND game_id = $2 LIMIT 1',
    [userId, gameId]
  );
  return rows.length > 0;
}