import { pool } from '../config/database.js';

export async function createNewsletter({ title, excerpt, body, image }) {
  const slugBase = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 140) || 'newsletter';

  const slug   = `${slugBase}-${Date.now().toString(36)}`;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO news (slug, category, title, excerpt, body, image)
       VALUES ($1, 'Newsletter', $2, $3, $4, $5)
       RETURNING id, slug, category, title, excerpt, body, image, published_at`,
      [slug, title, excerpt || null, body || '', image || null]
    );
    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function createVideo({ title, category, thumbnail, videoUrl, durationSeconds }) {
  const { rows } = await pool.query(
    `INSERT INTO videos (title, category, thumbnail, video_url, duration_seconds)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [title, category, thumbnail || null, videoUrl || null, durationSeconds ?? null]
  );
  return rows[0];
}

export async function createGame({
  title, slug, shortDescription, description,
  status, releaseDate, heroImage, coverImage, purchaseUrl, downloadUrl, itchGameId,
  trailerUrl, featured, genres = [], platforms = [],
}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const gameResult = await client.query(
      `INSERT INTO games
        (title, slug, short_description, description, status,
          release_date, hero_image, cover_image, trailer_url, featured,
          purchase_url, download_url, itch_game_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        title, slug, shortDescription, description || null,
        status || 'announced', releaseDate || null,
        heroImage || null, coverImage || null,
        trailerUrl || null, !!featured,
        purchaseUrl || null, downloadUrl || null, itchGameId || null,
      ]
    );

    const game = gameResult.rows[0];

    for (const name of genres) {
      const g = await client.query(
        `INSERT INTO genres (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [name]
      );
      await client.query(
        `INSERT INTO game_genres (game_id, genre_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [game.id, g.rows[0].id]
      );
    }

    for (const name of platforms) {
      const p = await client.query(
        `INSERT INTO platforms (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [name]
      );
      await client.query(
        `INSERT INTO game_platforms (game_id, platform_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [game.id, p.rows[0].id]
      );
    }

    await client.query('COMMIT');
    return game;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateNews(
    id,
    { title, excerpt, body, image }
) {
    const { rows } = await pool.query(
        `UPDATE news
         SET title = $2,
             excerpt = $3,
             body = $4,
             image = $5
         WHERE id = $1
         RETURNING id, slug, category, title, excerpt,
                   body, image, published_at`,
        [
            id,
            title,
            excerpt || null,
            body,
            image || null,
        ]
    );

    return rows[0] || null;
}

export async function updateVideo(
    id,
    {
        title,
        category,
        thumbnail,
        videoUrl,
        durationSeconds,
    }
) {
    const { rows } = await pool.query(
        `UPDATE videos
         SET title = $2,
             category = $3,
             thumbnail = $4,
             video_url = $5,
             duration_seconds = $6
         WHERE id = $1
         RETURNING *`,
        [
            id,
            title,
            category,
            thumbnail || null,
            videoUrl || null,
            durationSeconds ?? null,
        ]
    );

    return rows[0] || null;
}

export async function updateGame(
    id,
    {
        title,
        slug,
        shortDescription,
        description,
        status,
        releaseDate,
        heroImage,
        coverImage,
        purchaseUrl,
        downloadUrl,
        itchGameId,
        trailerUrl,
        featured,
        genres = [],
        platforms = [],
    }
) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const { rows } = await client.query(
            `UPDATE games
             SET title = $2,
                 slug = $3,
                 short_description = $4,
                 description = $5,
                 status = $6,
                 release_date = $7,
                 hero_image = $8,
                 cover_image = $9,
                 trailer_url = $10,
                 featured = $11,
                 purchase_url = $12,
                 download_url = $13,
                 itch_game_id = $14
             WHERE id = $1
             RETURNING *`,
            [
                id,
                title,
                slug,
                shortDescription,
                description || null,
                status,
                releaseDate || null,
                heroImage || null,
                coverImage || null,
                trailerUrl || null,
                Boolean(featured),
                purchaseUrl || null,
                downloadUrl || null,
                itchGameId || null,
            ]
        );

        if (!rows[0]) {
            await client.query("ROLLBACK");
            return null;
        }

        await client.query(
            "DELETE FROM game_genres WHERE game_id = $1",
            [id]
        );

        await client.query(
            "DELETE FROM game_platforms WHERE game_id = $1",
            [id]
        );

        for (const name of genres) {
            const result = await client.query(
                `INSERT INTO genres (name)
                 VALUES ($1)
                 ON CONFLICT (name)
                 DO UPDATE SET name = EXCLUDED.name
                 RETURNING id`,
                [name]
            );

            await client.query(
                `INSERT INTO game_genres (game_id, genre_id)
                 VALUES ($1, $2)
                 ON CONFLICT DO NOTHING`,
                [id, result.rows[0].id]
            );
        }

        for (const name of platforms) {
            const result = await client.query(
                `INSERT INTO platforms (name)
                 VALUES ($1)
                 ON CONFLICT (name)
                 DO UPDATE SET name = EXCLUDED.name
                 RETURNING id`,
                [name]
            );

            await client.query(
                `INSERT INTO game_platforms (game_id, platform_id)
                 VALUES ($1, $2)
                 ON CONFLICT DO NOTHING`,
                [id, result.rows[0].id]
            );
        }

        await client.query("COMMIT");

        return rows[0];
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

export async function deleteNews(id) {
  const { rowCount } = await pool.query('DELETE FROM news WHERE id = $1', [id]);
  return rowCount > 0;
}

export async function deleteVideo(id) {
  const { rowCount } = await pool.query('DELETE FROM videos WHERE id = $1', [id]);
  return rowCount > 0;
}

export async function deleteGame(id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rowCount } = await client.query('DELETE FROM games WHERE id = $1', [id]);
    await client.query('COMMIT');
    return rowCount > 0;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
