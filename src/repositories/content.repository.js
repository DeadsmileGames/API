import { query } from '../config/database.js';

export async function listNews({ limit = 12, offset = 0 } = {}) {
  const { rows } = await query(
    `SELECT id, slug, category, title, excerpt, image, published_at
     FROM news
     ORDER BY published_at DESC
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
    `SELECT * FROM videos ORDER BY published_at DESC LIMIT $1`,
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
