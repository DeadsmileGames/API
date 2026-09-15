import { query } from '../config/database.js';

export async function listNews({ limit = 12, offset = 0 } = {}) {
  const { rows } = await query(
    `SELECT n.id, n.slug, n.category, n.title, n.excerpt, n.image, n.published_at,
            linked.id AS game_id, linked.title AS game_title, linked.slug AS game_slug
     FROM news n
     LEFT JOIN LATERAL (
       SELECT g.id, g.title, g.slug FROM games g
       WHERE g.id = n.game_id OR (n.game_id IS NULL AND lower(n.title) LIKE '%' || lower(g.title) || '%')
       ORDER BY (g.id = n.game_id) DESC, length(g.title) DESC LIMIT 1
     ) linked ON true
     ORDER BY n.published_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

export async function findNews(slug) {
  const { rows } = await query('SELECT * FROM news WHERE slug = $1 LIMIT 1', [slug]);
  return rows[0] || null;
}

export async function listVideos({ limit = 12 } = {}) {
  const { rows } = await query(
    `SELECT v.*, linked.id AS game_id, linked.title AS game_title, linked.slug AS game_slug
     FROM videos v
     LEFT JOIN LATERAL (
       SELECT g.id, g.title, g.slug FROM games g
       WHERE g.id = v.game_id OR (v.game_id IS NULL AND lower(v.title) LIKE '%' || lower(g.title) || '%')
       ORDER BY (g.id = v.game_id) DESC, length(g.title) DESC LIMIT 1
     ) linked ON true
     ORDER BY v.published_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function findVideo(id) {
  const { rows } = await query('SELECT * FROM videos WHERE id = $1 LIMIT 1', [id]);
  return rows[0] || null;
}

export async function listDownloads() {
  const { rows } = await query('SELECT * FROM downloads ORDER BY created_at DESC');
  return rows;
}

export async function listProducts() {
  const { rows } = await query(
    'SELECT * FROM products WHERE available = true ORDER BY created_at DESC'
  );
  return rows;
}
