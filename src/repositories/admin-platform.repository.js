import { pool, query } from '../config/database.js';

export async function overview() {
  const [games, channels, builds, incidents, support, telemetry] = await Promise.all([
    query('SELECT id, title, slug, engine, cloud_saves_enabled FROM games ORDER BY title'),
    query('SELECT * FROM release_channels ORDER BY game_id, name'),
    query(`SELECT b.*, g.title AS game_title, c.name AS channel_name
           FROM game_builds b
           JOIN games g ON g.id = b.game_id
           JOIN release_channels c ON c.id = b.channel_id AND c.game_id = b.game_id
           ORDER BY b.created_at DESC LIMIT 100`),
    query('SELECT * FROM service_incidents ORDER BY started_at DESC LIMIT 30'),
    query('SELECT status, count(*)::int AS count FROM support_tickets GROUP BY status'),
    query(`SELECT event_type, count(*)::int AS count FROM telemetry_events
           WHERE created_at > now() - interval '30 days' GROUP BY event_type`),
  ]);
  return {
    games: games.rows,
    channels: channels.rows,
    builds: builds.rows,
    incidents: incidents.rows,
    support: support.rows,
    telemetry: telemetry.rows,
  };
}

export async function createChannel(item) {
  const { rows } = await query(
    `INSERT INTO release_channels (game_id, name, label, public)
     SELECT g.id, $2, $3, $4 FROM games g WHERE g.id = $1
     ON CONFLICT (game_id, name) DO UPDATE SET label = EXCLUDED.label, public = EXCLUDED.public
     RETURNING *`,
    [item.gameId, item.name, item.label, item.public],
  );
  return rows[0] || null;
}

export async function createBuild(item) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (item.status === 'published') {
      await client.query(
        `UPDATE game_builds
         SET status = 'retired'
         WHERE game_id = $1
           AND channel_id = $2
           AND platform = $3
           AND architecture = $4
           AND status = 'published'`,
        [item.gameId, item.channelId, item.platform, item.architecture],
      );
    }
    const { rows } = await client.query(
      `INSERT INTO game_builds
         (game_id, channel_id, version, platform, architecture, itch_channel, download_url, sha256, size_bytes, notes, status, published_at)
       SELECT $1, c.id, $3, $4, $5, $6, $7, $8, $9, $10, $11,
              CASE WHEN $11 = 'published' THEN now() END
       FROM release_channels c
       WHERE c.id = $2 AND c.game_id = $1
       RETURNING *`,
      [item.gameId, item.channelId, item.version, item.platform, item.architecture, item.itchChannel, item.downloadUrl, item.sha256, item.sizeBytes, item.notes, item.status],
    );
    await client.query('COMMIT');
    return rows[0] || null;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function createAchievement(item) {
  const { rows } = await query(
    `INSERT INTO achievements (game_id, key, title, description, icon_url, points, hidden)
     SELECT g.id, $2, $3, $4, $5, $6, $7 FROM games g WHERE g.id = $1
     ON CONFLICT (game_id, key) DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       icon_url = EXCLUDED.icon_url,
       points = EXCLUDED.points,
       hidden = EXCLUDED.hidden
     RETURNING *`,
    [item.gameId, item.key, item.title, item.description, item.iconUrl, item.points, item.hidden],
  );
  return rows[0] || null;
}

export async function grantBeta(item) {
  const { rows } = await query(
    `INSERT INTO beta_access (user_id, game_id, channel_id, expires_at)
     SELECT u.id, $2, c.id, $4
     FROM users u
     JOIN release_channels c ON c.id = $3 AND c.game_id = $2
     WHERE u.id = $1
     ON CONFLICT (user_id, game_id, channel_id) DO UPDATE SET
       expires_at = EXCLUDED.expires_at,
       granted_at = now()
     RETURNING *`,
    [item.userId, item.gameId, item.channelId, item.expiresAt],
  );
  return rows[0] || null;
}

export async function createIncident(item) {
  const { rows } = await query(
    `INSERT INTO service_incidents (title, body, severity, status, resolved_at)
     VALUES ($1, $2, $3, $4, CASE WHEN $4 = 'resolved' THEN now() END)
     RETURNING *`,
    [item.title, item.body, item.severity, item.status],
  );
  return rows[0];
}
