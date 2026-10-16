import { query } from "../config/database.js";

const ACCENT_CHARS = "áàâãäéèêëíìîïóòôõöúùûüçñýÿ";
const NORMALIZED_CHARS = "aaaaaeeeeiiiiooooouuuucnyy";
const FUZZY_THRESHOLD = 0.45;

function normalizeSearchText(value) {
  return String(value || "")
    .toLocaleLowerCase("pt-BR")
    .replace(/['’]s\b/gu, " ")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export async function searchSite({ q, page, limit }) {
  const normalizedQuery = normalizeSearchText(q);
  const terms = [...new Set(normalizedQuery.split(" ").filter(Boolean))];

  if (!terms.length) {
    return { items: [], total: 0 };
  }

  const offset = (page - 1) * limit;
  const candidates = `
    WITH candidates_raw AS (
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
        concat_ws(
          ' ',
          g.title,
          g.short_description,
          g.description,
          (
            SELECT string_agg(gn.name, ' ')
            FROM game_genres gg
            JOIN genres gn ON gn.id = gg.genre_id
            WHERE gg.game_id = g.id
          ),
          (
            SELECT string_agg(pl.name, ' ')
            FROM game_platforms gp
            JOIN platforms pl ON pl.id = gp.platform_id
            WHERE gp.game_id = g.id
          )
        ) AS search_document
      FROM games g

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
        concat_ws(' ', n.title, n.excerpt, n.body, n.category) AS search_document
      FROM news n

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
        concat_ws(' ', v.title, v.category) AS search_document
      FROM videos v
    ),
    candidates AS (
      SELECT
        candidates_raw.*,
        translate(lower(search_document), $4, $5) AS normalized_search_document,
        translate(lower(title), $4, $5) AS normalized_title
      FROM candidates_raw
    ),
    scored AS (
      SELECT
        candidates.*,
        CASE
          WHEN normalized_title = $1 THEN 0
          WHEN strpos(normalized_title, $1) = 1 THEN 1
          WHEN strpos(normalized_title, $1) > 0 THEN 2
          ELSE 3
        END::int AS phrase_relevance,
        CASE
          WHEN type = 'video' AND EXISTS (
            SELECT 1 FROM unnest($2::text[]) AS token(term)
            WHERE term IN ('trailer', 'trailers', 'video', 'videos')
          ) THEN 0
          WHEN type = 'game' AND EXISTS (
            SELECT 1 FROM unnest($2::text[]) AS token(term)
            WHERE term IN ('game', 'games')
          ) THEN 0
          WHEN type = 'news' AND EXISTS (
            SELECT 1 FROM unnest($2::text[]) AS token(term)
            WHERE term IN ('news', 'article', 'articles')
          ) THEN 0
          ELSE 1
        END::int AS intent_relevance,
        (
          SELECT COUNT(*)::int
          FROM unnest($2::text[]) AS token(term)
          WHERE strpos(normalized_search_document, term) > 0
             OR (
               char_length(term) >= 4
               AND word_similarity(term, normalized_search_document) >= $3
             )
             OR (
               type = 'video'
               AND term IN ('trailer', 'trailers', 'video', 'videos')
             )
             OR (type = 'game' AND term IN ('game', 'games'))
             OR (type = 'news' AND term IN ('news', 'article', 'articles'))
        ) AS matched_term_count,
        (
          SELECT COUNT(*)::int
          FROM unnest($2::text[]) AS token(term)
          WHERE strpos(normalized_title, term) > 0
             OR (
               char_length(term) >= 4
               AND word_similarity(term, normalized_title) >= $3
             )
        ) AS title_term_count
      FROM candidates
    )
  `;

  const params = [
    normalizedQuery,
    terms,
    FUZZY_THRESHOLD,
    ACCENT_CHARS,
    NORMALIZED_CHARS,
  ];

  const countResult = await query(
    `${candidates}
     SELECT COUNT(*)::int AS total
     FROM scored
     WHERE matched_term_count = cardinality($2::text[])`,
    params,
  );
  const total = countResult.rows[0]?.total ?? 0;

  const dataResult = await query(
    `${candidates}
     SELECT
       type, id, title, slug, description, image, status, published_at,
       thumbnail, thumbnail_en, thumbnail_pt_br, thumbnail_es
     FROM scored
     WHERE matched_term_count = cardinality($2::text[])
     ORDER BY
       title_term_count DESC,
       intent_relevance ASC,
       phrase_relevance ASC,
       published_at DESC NULLS LAST,
       title ASC,
       type ASC
     LIMIT $6 OFFSET $7`,
    [...params, limit, offset],
  );

  return { items: dataResult.rows, total };
}
