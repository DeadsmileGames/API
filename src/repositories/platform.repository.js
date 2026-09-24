import { pool, query } from '../config/database.js';

export async function createSession({ userId, gameId, launcherVersion, gameVersion, platform }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    await client.query(
      `UPDATE game_sessions
       SET ended_at = started_at, duration_ms = 0
       WHERE user_id = $1
         AND ended_at IS NULL
         AND (
           game_id = $2
           OR started_at < now() - interval '24 hours'
         )`,
      [userId, gameId],
    );
    const { rows } = await client.query(
      `INSERT INTO game_sessions (user_id, game_id, launcher_version, game_version, platform)
       SELECT $1, g.id, $3, $4, $5 FROM games g
       WHERE g.id = $2
         AND (
           g.purchase_url IS NULL OR EXISTS (
             SELECT 1 FROM user_game_entitlements e
             WHERE e.user_id = $1 AND e.game_id = g.id AND e.revoked_at IS NULL
           )
         )
       RETURNING id, game_id, started_at`,
      [userId, gameId, launcherVersion || null, gameVersion || null, platform],
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

export async function finishSession({ userId, sessionId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE game_sessions
       SET ended_at = now(),
           duration_ms = LEAST(86400000, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - started_at)) * 1000)::bigint))
       WHERE id = $1 AND user_id = $2 AND ended_at IS NULL
       RETURNING id, game_id, started_at, ended_at, duration_ms`,
      [sessionId, userId]
    );
    const session = result.rows[0];
    if (!session) {
      await client.query('ROLLBACK');
      return null;
    }
    await client.query(
      `INSERT INTO game_activity (
        user_id,
        game_id,
        total_ms,
        sessions,
        last_played_at,
        public
      )
      VALUES (
        $1,
        $2,
        $3,
        1,
        $4,
        COALESCE(
          (
            SELECT share_game_activity
            FROM users
            WHERE id = $1
          ),
          false
        )
      )

      ON CONFLICT (user_id, game_id)
      DO UPDATE SET
        total_ms =
          game_activity.total_ms + EXCLUDED.total_ms,

        sessions =
          game_activity.sessions + 1,

        last_played_at =
          GREATEST(
            game_activity.last_played_at,
            EXCLUDED.last_played_at
          ),

        public = EXCLUDED.public`,
      [
        userId,
        session.game_id,
        session.duration_ms,
        session.ended_at,
      ],
    );
    await client.query('COMMIT');
    return session;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listAchievements(userId, gameId) {
  const { rows } = await query(
    `SELECT a.id, a.key, a.title, a.description, a.icon_url, a.points, a.hidden,
            ua.unlocked_at
     FROM achievements a
     LEFT JOIN user_achievements ua ON ua.achievement_id = a.id AND ua.user_id = $1
     WHERE a.game_id = $2
     ORDER BY a.points, a.title`,
    [userId, gameId]
  );
  return rows;
}

export async function findAchievement(gameId, key) {
  const { rows } = await query(
    `SELECT id, game_id, key, title, description, icon_url, points, hidden
     FROM achievements
     WHERE game_id = $1 AND key = $2`,
    [gameId, key]
  );
  return rows[0] || null;
}

export async function gameAccess(userId, gameId) {
  const { rows } = await query(
    `SELECT g.id, g.cloud_saves_enabled, g.telemetry_enabled,
            CASE
              WHEN g.purchase_url IS NULL THEN true
              ELSE EXISTS (
                SELECT 1
                FROM user_game_entitlements e
                WHERE e.user_id = $1
                  AND e.game_id = g.id
                  AND e.revoked_at IS NULL
              )
            END AS allowed
     FROM games g
     WHERE g.id = $2`,
    [userId, gameId]
  );
  return rows[0] || null;
}

export async function unlockAchievement(userId, achievementId) {
  const { rows } = await query(
    `INSERT INTO user_achievements (user_id, achievement_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, achievement_id)
     DO UPDATE SET unlocked_at = user_achievements.unlocked_at
     RETURNING achievement_id, unlocked_at`,
    [userId, achievementId]
  );
  return rows[0] || null;
}

export async function findCloudSave(userId, gameId, slot) {
  const { rows } = await query(
    `SELECT slot, revision, payload, sha256, updated_at
     FROM cloud_saves WHERE user_id = $1 AND game_id = $2 AND slot = $3`,
    [userId, gameId, slot]
  );
  return rows[0] || null;
}

export async function upsertCloudSave({ userId, gameId, slot, payload, sha256, revision }) {
  if (revision != null) {
    const { rows } = await query(
      `UPDATE cloud_saves SET payload = $4, sha256 = $5,
         revision = revision + 1, updated_at = now()
       WHERE user_id = $1 AND game_id = $2 AND slot = $3 AND revision = $6::bigint
         AND EXISTS (
           SELECT 1 FROM games g WHERE g.id = $2 AND g.cloud_saves_enabled
             AND (g.purchase_url IS NULL OR EXISTS (
               SELECT 1 FROM user_game_entitlements e
               WHERE e.user_id = $1 AND e.game_id = g.id AND e.revoked_at IS NULL
             ))
         )
       RETURNING slot, revision, sha256, updated_at`,
      [userId, gameId, slot, payload, sha256, revision]
    );
    return rows[0] || null;
  }
  const { rows } = await query(
    `INSERT INTO cloud_saves (user_id, game_id, slot, payload, sha256)
     SELECT $1, g.id, $3, $4, $5 FROM games g
     WHERE g.id = $2 AND g.cloud_saves_enabled
       AND (
         g.purchase_url IS NULL OR EXISTS (
           SELECT 1 FROM user_game_entitlements e
           WHERE e.user_id = $1 AND e.game_id = g.id AND e.revoked_at IS NULL
         )
       )
     ON CONFLICT (user_id, game_id, slot) DO NOTHING
     RETURNING slot, revision, sha256, updated_at`,
    [userId, gameId, slot, payload, sha256]
  );
  return rows[0] || null;
}

export async function setTelemetryConsent(userId, enabled) {
  const { rows } = await query(
    `UPDATE users SET telemetry_consent = $2, updated_at = now()
     WHERE id = $1 RETURNING telemetry_consent`,
    [userId, enabled]
  );
  return rows[0] || null;
}

export async function getTelemetryConsent(userId) {
  const { rows } = await query('SELECT telemetry_consent FROM users WHERE id = $1', [userId]);
  return Boolean(rows[0]?.telemetry_consent);
}

export async function telemetryContext(userId, gameId, sessionId) {
  if (sessionId) {
    const { rows } = await query(
      `SELECT game_id FROM game_sessions WHERE id = $1 AND user_id = $2`,
      [sessionId, userId],
    );
    const session = rows[0];
    if (!session) return null;
    if (gameId && String(session.game_id) !== String(gameId)) return null;
    return { gameId: gameId || session.game_id, sessionId };
  }
  if (gameId) {
    const access = await gameAccess(userId, gameId);
    if (!access?.allowed) return null;
    return { gameId, sessionId: null };
  }
  return { gameId: null, sessionId: null };
}

export async function insertTelemetry({ userId, gameId, sessionId, eventType, appVersion, payload }) {
  const { rows } = await query(
    `INSERT INTO telemetry_events (user_id, game_id, session_id, event_type, app_version, payload)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, created_at`,
    [userId, gameId || null, sessionId || null, eventType, appVersion || null, payload],
  );
  if (Math.random() < 0.01) {
    query(`DELETE FROM telemetry_events WHERE created_at < now() - interval '30 days'`).catch(() => {});
  }
  return rows[0];
}

export async function statusSnapshot() {
  const started = Date.now();
  await query('SELECT 1');
  const { rows } = await query(
    `SELECT id, title, body, severity, status, started_at, resolved_at
     FROM service_incidents
     WHERE resolved_at IS NULL OR resolved_at > now() - interval '7 days'
     ORDER BY started_at DESC LIMIT 20`
  );
  return { databaseLatencyMs: Date.now() - started, incidents: rows };
}

export async function publicActivity(userId) {
  const { rows } = await query(
    `SELECT a.total_ms, a.sessions, a.last_played_at,
            g.id, g.title, g.slug, g.cover_image, g.hero_image, g.purchase_url,
            COALESCE(json_agg(json_build_object(
              'url', s.url, 'position', s.position
            ) ORDER BY s.position) FILTER (WHERE s.id IS NOT NULL), '[]') AS screenshots
     FROM game_activity a
     JOIN games g ON g.id = a.game_id
     LEFT JOIN game_screenshots s ON s.game_id = g.id
     WHERE a.user_id = $1
      AND a.public
      AND EXISTS (
        SELECT 1
        FROM users u
        WHERE u.id = $1
          AND u.share_game_activity
      )
     GROUP BY a.user_id, a.total_ms, a.sessions, a.last_played_at,
              g.id, g.title, g.slug, g.cover_image, g.hero_image, g.purchase_url
     ORDER BY a.last_played_at DESC LIMIT 8`,
    [userId]
  );
  return rows;
}

export async function publicAchievements(userId) {
  const { rows } = await query(
    `SELECT a.key, a.title, a.description, a.icon_url, a.points,
            ua.unlocked_at, g.title AS game_title, g.slug AS game_slug
     FROM user_achievements ua
     JOIN achievements a ON a.id = ua.achievement_id
     JOIN games g ON g.id = a.game_id
     WHERE ua.user_id = $1
      AND EXISTS (
        SELECT 1
        FROM users u
        WHERE u.id = $1
          AND u.share_achievements
      )
     ORDER BY ua.unlocked_at DESC LIMIT 12`,
    [userId]
  );
  return rows;
}


export async function listCloudSaves(userId, gameId) {
  const { rows } = await query(
    `SELECT slot, revision, sha256, updated_at
     FROM cloud_saves
     WHERE user_id = $1 AND game_id = $2
     ORDER BY updated_at DESC, slot ASC`,
    [userId, gameId]
  );
  return rows;
}

export async function deleteCloudSave(userId, gameId, slot) {
  const { rows } = await query(
    `DELETE FROM cloud_saves
     WHERE user_id = $1 AND game_id = $2 AND slot = $3
     RETURNING slot, revision, sha256, updated_at`,
    [userId, gameId, slot]
  );
  return rows[0] || null;
}