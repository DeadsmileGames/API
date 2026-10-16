import { query } from "../config/database.js";

export async function searchSite({ q, page, limit }) {
  const normalizedQuery = String(q || "").trim();
  const escapedQuery = normalizedQuery.replace(/[\\%_]/g, "\\$&");
  const startsWithTerm = `${escapedQuery}%`;
  const containsTerm = `%${escapedQuery}%`;
  const offset = (page - 1) * limit;
  const candidates = `
    WITH candidates AS (
      SELECT
        'game'::text AS type,
        g.id::text AS id,
        g.title,
        g.slug,
        COALESCE(g.short_description, '') AS description,
        g.cover_image AS image,
        g.status::text AS status,
        NULL::timestamptz AS published_at,
        NULL::text AS thumbnail,
        NULL::text AS thumbnail_en,
        NULL::text AS thumbnail_pt_br,
        NULL::text AS thumbnail_es,
        CASE
          WHEN g.title ILIKE $1 ESCAPE '\\' THEN 0
          WHEN g.title ILIKE $2 ESCAPE '\\' THEN 1
          WHEN g.title ILIKE $3 ESCAPE '\\' THEN 2
          ELSE 3
        END::int AS relevance
      FROM games g
      WHERE g.title ILIKE $3 ESCAPE '\\'
         OR COALESCE(g.short_description, '') ILIKE $3 ESCAPE '\\'
         OR COALESCE(g.description, '') ILIKE $3 ESCAPE '\\'
         OR EXISTS (
           SELECT 1
           FROM game_genres gg
           JOIN genres gn ON gn.id = gg.genre_id
           WHERE gg.game_id = g.id
             AND gn.name ILIKE $3 ESCAPE '\\'
         )
         OR EXISTS (
           SELECT 1
           FROM game_platforms gp
           JOIN platforms pl ON pl.id = gp.platform_id
           WHERE gp.game_id = g.id
             AND pl.name ILIKE $3 ESCAPE '\\'
         )

      UNION ALL

      SELECT
        'news'::text AS type,
        n.id::text AS id,
        n.title,
        n.slug,
        COALESCE(n.excerpt, '') AS description,
        n.image AS image,
        NULL::text AS status,
        n.published_at::timestamptz AS published_at,
        NULL::text AS thumbnail,
        NULL::text AS thumbnail_en,
        NULL::text AS thumbnail_pt_br,
        NULL::text AS thumbnail_es,
        CASE
          WHEN n.title ILIKE $1 ESCAPE '\\' THEN 0
          WHEN n.title ILIKE $2 ESCAPE '\\' THEN 1
          WHEN n.title ILIKE $3 ESCAPE '\\' THEN 2
          ELSE 3
        END::int AS relevance
      FROM news n
      WHERE n.title ILIKE $3 ESCAPE '\\'
         OR COALESCE(n.excerpt, '') ILIKE $3 ESCAPE '\\'
         OR COALESCE(n.body, '') ILIKE $3 ESCAPE '\\'
         OR COALESCE(n.category, '') ILIKE $3 ESCAPE '\\'

      UNION ALL

      SELECT
        'video'::text AS type,
        v.id::text AS id,
        v.title,
        NULL::text AS slug,
        ''::text AS description,
        COALESCE(v.thumbnail_pt_br, v.thumbnail_en, v.thumbnail_es, v.thumbnail) AS image,
        NULL::text AS status,
        v.published_at::timestamptz AS published_at,
        v.thumbnail::text AS thumbnail,
        v.thumbnail_en::text AS thumbnail_en,
        v.thumbnail_pt_br::text AS thumbnail_pt_br,
        v.thumbnail_es::text AS thumbnail_es,
        CASE
          WHEN v.title ILIKE $1 ESCAPE '\\' THEN 0
          WHEN v.title ILIKE $2 ESCAPE '\\' THEN 1
          WHEN v.title ILIKE $3 ESCAPE '\\' THEN 2
          ELSE 3
        END::int AS relevance
      FROM videos v
      WHERE v.title ILIKE $3 ESCAPE '\\'
         OR COALESCE(v.description, '') ILIKE $3 ESCAPE '\\'
         OR COALESCE(v.category, '') ILIKE $3 ESCAPE '\\'
    )
  `;

  const params = [escapedQuery, startsWithTerm, containsTerm];
  const countResult = await query(
    `${candidates} SELECT COUNT(*)::int AS total FROM candidates`,
    params,
  );
  const total = countResult.rows[0]?.total ?? 0;

  const dataResult = await query(
    `${candidates}
     SELECT *
     FROM candidates
     ORDER BY relevance ASC, published_at DESC NULLS LAST, title ASC, type ASC
     LIMIT $4 OFFSET $5`,
    [...params, limit, offset],
  );

  return { items: dataResult.rows, total };
}
