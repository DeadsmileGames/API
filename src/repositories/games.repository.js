import { query } from '../config/database.js';

const GAME_SUMMARY_SELECT = `
  SELECT
    g.id, g.title, g.slug, g.short_description,
    g.status, g.release_date, g.hero_image, g.cover_image,
    g.trailer_url, g.featured, g.purchase_url, g.download_url, g.itch_game_id,
    COALESCE(genre_agg.genres,    '{}') AS genres,
    COALESCE(platform_agg.platforms, '{}') AS platforms
  FROM games g
  LEFT JOIN (
    SELECT gg.game_id, array_agg(gn.name ORDER BY gn.name) AS genres
    FROM game_genres gg
    JOIN genres gn ON gn.id = gg.genre_id
    GROUP BY gg.game_id
  ) genre_agg ON genre_agg.game_id = g.id
  LEFT JOIN (
    SELECT gp.game_id, array_agg(pl.name ORDER BY pl.name) AS platforms
    FROM game_platforms gp
    JOIN platforms pl ON pl.id = gp.platform_id
    GROUP BY gp.game_id
  ) platform_agg ON platform_agg.game_id = g.id
`;

export async function listGames({ page, limit, featured, genre, platform, status }) {
  const conditions = [];
  const params     = [];

  if (featured !== undefined) {
    params.push(featured);
    conditions.push(`g.featured = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`g.status = $${params.length}`);
  }

  if (genre) {
    params.push(genre);
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM game_genres gg2
        JOIN genres gn2 ON gn2.id = gg2.genre_id
        WHERE gg2.game_id = g.id AND gn2.name ILIKE $${params.length}
      )
    `);
  }

  if (platform) {
    params.push(platform);
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM game_platforms gp2
        JOIN platforms pl2 ON pl2.id = gp2.platform_id
        WHERE gp2.game_id = g.id AND pl2.name ILIKE $${params.length}
      )
    `);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset      = (page - 1) * limit;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM games g ${whereClause}`,
    params
  );
  const total = countResult.rows[0].total;

  params.push(limit);
  params.push(offset);

  const dataResult = await query(
    `${GAME_SUMMARY_SELECT}
     ${whereClause}
     ORDER BY g.featured DESC, g.release_date DESC NULLS LAST, g.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { items: dataResult.rows, total };
}

export async function findGameBySlug(slug) {
  const { rows } = await query(`${GAME_SUMMARY_SELECT} WHERE g.slug = $1`, [slug]);
  const game = rows[0];
  if (!game) return null;

  const [screenshots, fullDesc] = await Promise.all([
    query(
      'SELECT url FROM game_screenshots WHERE game_id = $1 ORDER BY position ASC',
      [game.id]
    ),
    query('SELECT description FROM games WHERE id = $1', [game.id]),
  ]);

  return {
    ...game,
    description: fullDesc.rows[0]?.description || null,
    screenshots: screenshots.rows.map((r) => r.url),
  };
}

export async function findRelatedGames(gameId, genreNames, limit = 4) {
  if (!genreNames?.length) return [];

  const { rows } = await query(
    `${GAME_SUMMARY_SELECT}
     WHERE g.id != $1
       AND EXISTS (
         SELECT 1
         FROM game_genres gg
         JOIN genres gn ON gn.id = gg.genre_id
         WHERE gg.game_id = g.id AND gn.name = ANY($2)
       )
     ORDER BY g.featured DESC, g.release_date DESC NULLS LAST
     LIMIT $3`,
    [gameId, genreNames, limit]
  );

  return rows;
}
