import { query } from "../config/database.js";
import { normalizeSearchQuery, SEARCH_MONTHS } from "../utils/searchNormalization.js";

const ACCENT_CHARS = "áàâãäéèêëíìîïóòôõöúùûüçñýÿ";
const NORMALIZED_CHARS = "aaaaaeeeeiiiiooooouuuucnyy";
const FUZZY_THRESHOLD = 0.45;

function normalizedDocumentSql(expression, normalizeMonths) {
  let normalized = `translate(lower(${expression}), $3, $4)`;
  if (!normalizeMonths) return normalized;
  for (const { canonical, names } of SEARCH_MONTHS) {
    const pattern = String.raw`\m(${names.join("|")})\M`;
    normalized = `regexp_replace(${normalized}, '${pattern}', '${canonical}', 'g')`;
  }
  const ordinalPattern = String.raw`\m([0-9]{1,2})(st|nd|rd|th)\M`;
  return `regexp_replace(${normalized}, '${ordinalPattern}', '\\1', 'gi')`;
}

export async function searchSite({ q, page, limit, language = "en", queryVariants = [] }) {
  const inputs = queryVariants.length ? queryVariants : [{ query: q, language }];
  const variants = [];
  const seenVariants = new Set();

  for (const input of inputs) {
    const normalized = normalizeSearchQuery(input.query, input.language || language);
    if (!normalized.terms.length) continue;
    const key = JSON.stringify([normalized.normalizedQuery, normalized.terms]);
    if (seenVariants.has(key)) continue;
    seenVariants.add(key);
    variants.push({
      normalizedQuery: normalized.normalizedQuery,
      terms: normalized.terms,
      priority: variants.length,
    });
  }

  if (!variants.length) return { items: [], total: 0 };

  const normalizeMonths = variants.some(({ terms }) =>
    SEARCH_MONTHS.some(({ canonical }) => terms.includes(canonical)),
  );

  const offset = (page - 1) * limit;
  const candidates = `
    WITH query_variants AS (
      SELECT
        variant->>'normalizedQuery' AS normalized_query,
        ARRAY(SELECT jsonb_array_elements_text(variant->'terms')) AS terms,
        (variant->>'priority')::int AS priority
      FROM jsonb_array_elements($1::jsonb) AS variant
    ),
    candidates_raw AS (
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
        ${normalizedDocumentSql("search_document", normalizeMonths)} AS normalized_search_document,
        ${normalizedDocumentSql("title", normalizeMonths)} AS normalized_title
      FROM candidates_raw
    ),
    scored AS (
      SELECT
        candidates.*,
        matched.priority AS matched_query_priority,
        matched.phrase_relevance,
        matched.intent_relevance,
        matched.title_term_count
      FROM candidates
      CROSS JOIN LATERAL (
        SELECT
          query_variants.priority,
          CASE
            WHEN normalized_title = query_variants.normalized_query THEN 0
            WHEN strpos(normalized_title, query_variants.normalized_query) = 1 THEN 1
            WHEN strpos(normalized_title, query_variants.normalized_query) > 0 THEN 2
            ELSE 3
          END::int AS phrase_relevance,
          CASE
            WHEN type = 'video' AND EXISTS (
              SELECT 1 FROM unnest(query_variants.terms) AS token(term)
              WHERE term IN ('trailer', 'trailers', 'video', 'videos', 'watch', 'watching', 'view', 'viewing')
            ) THEN 0
            WHEN type = 'game' AND EXISTS (
              SELECT 1 FROM unnest(query_variants.terms) AS token(term)
              WHERE term IN ('game', 'games')
            ) THEN 0
            WHEN type = 'news' AND EXISTS (
              SELECT 1 FROM unnest(query_variants.terms) AS token(term)
              WHERE term IN ('news', 'article', 'articles')
            ) THEN 0
            ELSE 1
          END::int AS intent_relevance,
          (
            SELECT COUNT(*)::int
            FROM unnest(query_variants.terms) AS token(term)
            WHERE strpos(normalized_title, term) > 0
               OR (
                 char_length(term) >= 4
                 AND word_similarity(term, normalized_title) >= $2
               )
          ) AS title_term_count
        FROM query_variants
        WHERE (
          SELECT COUNT(*)::int
          FROM unnest(query_variants.terms) AS token(term)
          WHERE strpos(normalized_search_document, term) > 0
             OR (
               char_length(term) >= 4
               AND word_similarity(term, normalized_search_document) >= $2
             )
             OR (
               type = 'video'
               AND term IN ('trailer', 'trailers', 'video', 'videos', 'watch', 'watching', 'view', 'viewing')
             )
             OR (type = 'game' AND term IN ('game', 'games'))
             OR (type = 'news' AND term IN ('news', 'article', 'articles'))
        ) = cardinality(query_variants.terms)
        ORDER BY
          query_variants.priority ASC,
          title_term_count DESC,
          intent_relevance ASC,
          phrase_relevance ASC
        LIMIT 1
      ) AS matched
    )
  `;

  const params = [
    JSON.stringify(variants),
    FUZZY_THRESHOLD,
    ACCENT_CHARS,
    NORMALIZED_CHARS,
  ];

  const countResult = await query(
    `${candidates}
     SELECT COUNT(*)::int AS total
     FROM scored
     `,
    params,
  );
  const total = countResult.rows[0]?.total ?? 0;

  const dataResult = await query(
    `${candidates}
     SELECT
       type, id, title, slug, description, image, status, published_at,
       thumbnail, thumbnail_en, thumbnail_pt_br, thumbnail_es
     FROM scored
     
     ORDER BY
       matched_query_priority ASC,
       title_term_count DESC,
       intent_relevance ASC,
       phrase_relevance ASC,
       published_at DESC NULLS LAST,
       title ASC,
       type ASC
     LIMIT $5 OFFSET $6`,
    [...params, limit, offset],
  );

  return { items: dataResult.rows, total };
}
