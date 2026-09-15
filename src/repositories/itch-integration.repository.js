import { pool, query } from '../config/database.js';

export async function createOAuthState({ stateHash, userId, client, locale, returnPath, expiresAt }) {
  await query('DELETE FROM itch_oauth_states WHERE expires_at < now() OR consumed_at IS NOT NULL');
  await query(
    `INSERT INTO itch_oauth_states (state_hash, user_id, client, locale, return_path, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [stateHash, userId, client, locale, returnPath, expiresAt]
  );
}

export async function consumeOAuthState(stateHash) {
  const { rows } = await query(
    `UPDATE itch_oauth_states
     SET consumed_at = now()
     WHERE state_hash = $1 AND consumed_at IS NULL AND expires_at > now()
     RETURNING user_id, client, locale, return_path`,
    [stateHash]
  );
  return rows[0] || null;
}

export async function upsertItchAccount({ userId, itchUserId, username, profileUrl, encryptedToken }) {
  const { rows } = await query(
    `INSERT INTO user_itch_accounts
       (user_id, itch_user_id, itch_username, itch_profile_url, access_token_encrypted)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE SET
       itch_user_id = EXCLUDED.itch_user_id,
       itch_username = EXCLUDED.itch_username,
       itch_profile_url = EXCLUDED.itch_profile_url,
       access_token_encrypted = EXCLUDED.access_token_encrypted,
       connected_at = now(),
       verified_at = now()
     RETURNING *`,
    [userId, itchUserId, username, profileUrl, encryptedToken]
  );
  return rows[0];
}

export async function findItchAccount(userId) {
  const { rows } = await query('SELECT * FROM user_itch_accounts WHERE user_id = $1', [userId]);
  return rows[0] || null;
}

export async function touchItchAccount(userId) {
  await query('UPDATE user_itch_accounts SET verified_at = now() WHERE user_id = $1', [userId]);
}

export async function markItchAccountSynced(userId) {
  await query('UPDATE user_itch_accounts SET last_sync_at = now() WHERE user_id = $1', [userId]);
}

export async function removeItchAccount(userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("UPDATE user_game_entitlements SET revoked_at = now(), last_verified_at = now() WHERE user_id = $1 AND source = 'itch'", [userId]);
    const result = await client.query('DELETE FROM user_itch_accounts WHERE user_id = $1', [userId]);
    await client.query('COMMIT');
    return result.rowCount > 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listItchGames() {
  const { rows } = await query(
    `SELECT id, title, slug, purchase_url, download_url, itch_game_id
     FROM games
     WHERE itch_game_id IS NOT NULL AND purchase_url IS NOT NULL
     ORDER BY created_at ASC`
  );
  return rows;
}

export async function findItchGame(gameId) {
  const { rows } = await query(
    `SELECT id, title, slug, purchase_url, download_url, itch_game_id
     FROM games
     WHERE id = $1`,
    [gameId]
  );
  return rows[0] || null;
}

export async function findPreferredItchChannel(userId, gameId) {
  const { rows } = await query(
    `SELECT b.itch_channel
     FROM game_builds b
     JOIN release_channels c ON c.id = b.channel_id
     LEFT JOIN beta_access ba
       ON ba.user_id = $1 AND ba.game_id = b.game_id AND ba.channel_id = c.id
       AND (ba.expires_at IS NULL OR ba.expires_at > now())
     WHERE b.game_id = $2 AND b.platform = 'windows' AND b.status = 'published'
       AND b.itch_channel IS NOT NULL
       AND ((c.name = 'stable' AND c.public) OR ba.user_id IS NOT NULL)
     ORDER BY (ba.user_id IS NOT NULL) DESC, b.published_at DESC NULLS LAST, b.created_at DESC
     LIMIT 1`,
    [userId, gameId]
  );
  return rows[0]?.itch_channel || null;
}

export async function grantEntitlement({ userId, gameId, externalReference, acquiredAt }) {
  await query(
    `INSERT INTO user_game_entitlements
       (user_id, game_id, source, external_reference, acquired_at, last_verified_at, revoked_at)
     VALUES ($1, $2, 'itch', $3, COALESCE($4, now()), now(), NULL)
     ON CONFLICT (user_id, game_id) DO UPDATE SET
       external_reference = EXCLUDED.external_reference,
       acquired_at = LEAST(user_game_entitlements.acquired_at, EXCLUDED.acquired_at),
       last_verified_at = now(),
       revoked_at = NULL`,
    [userId, gameId, externalReference, acquiredAt]
  );
}

export async function revokeEntitlement(userId, gameId) {
  await query(
    `UPDATE user_game_entitlements
     SET revoked_at = now(), last_verified_at = now()
     WHERE user_id = $1 AND game_id = $2 AND source = 'itch'`,
    [userId, gameId]
  );
}

export async function listEntitlements(userId) {
  const { rows } = await query(
    `SELECT
       e.acquired_at, e.last_verified_at,
       g.id, g.title, g.slug, g.short_description, g.status, g.release_date,
       g.hero_image, g.cover_image, g.trailer_url, g.purchase_url, g.download_url,
       g.engine, g.save_path_template, g.cloud_saves_enabled, g.telemetry_enabled, g.itch_game_id,
       COALESCE(genre_agg.genres, '{}') AS genres,
       COALESCE(platform_agg.platforms, '{}') AS platforms
     FROM user_game_entitlements e
     JOIN games g ON g.id = e.game_id
     LEFT JOIN (
       SELECT gg.game_id, array_agg(gn.name ORDER BY gn.name) AS genres
       FROM game_genres gg JOIN genres gn ON gn.id = gg.genre_id GROUP BY gg.game_id
     ) genre_agg ON genre_agg.game_id = g.id
     LEFT JOIN (
       SELECT gp.game_id, array_agg(pl.name ORDER BY pl.name) AS platforms
       FROM game_platforms gp JOIN platforms pl ON pl.id = gp.platform_id GROUP BY gp.game_id
     ) platform_agg ON platform_agg.game_id = g.id
     WHERE e.user_id = $1 AND e.revoked_at IS NULL
     ORDER BY e.acquired_at DESC`,
    [userId]
  );
  return rows;
}
