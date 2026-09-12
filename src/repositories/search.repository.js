import { query } from '../config/database.js';

export async function searchGames({ q, page, limit }) {
  const likeTerm = `%${q}%`;
  const offset   = (page - 1) * limit;

  const countResult = await query(
    `SELECT COUNT(DISTINCT g.id)::int AS total
     FROM games g
     LEFT JOIN game_genres gg ON gg.game_id = g.id
     LEFT JOIN genres gn      ON gn.id      = gg.genre_id
     WHERE g.title            ILIKE $1
        OR g.short_description ILIKE $1
        OR g.description      ILIKE $1
        OR gn.name            ILIKE $1`,
    [likeTerm]
  );

  const total = countResult.rows[0].total;

  const dataResult = await query(
    `SELECT DISTINCT g.id, g.title, g.slug, g.short_description, g.cover_image, g.status
     FROM games g
     LEFT JOIN game_genres gg ON gg.game_id = g.id
     LEFT JOIN genres gn      ON gn.id      = gg.genre_id
     WHERE g.title            ILIKE $1
        OR g.short_description ILIKE $1
        OR g.description      ILIKE $1
        OR gn.name            ILIKE $1
     ORDER BY g.title ASC
     LIMIT $2 OFFSET $3`,
    [likeTerm, limit, offset]
  );

  return { items: dataResult.rows, total };
}
