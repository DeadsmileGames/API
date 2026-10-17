import { query } from "../config/database.js";
import { toClientGame } from "../utils/clientGame.js";

export async function getPreorderedLibraryItems(userId) {
  const { rows } = await query(
    `SELECT g.*,
       COALESCE((SELECT array_agg(gn.name ORDER BY gn.name)
         FROM game_genres gg JOIN genres gn ON gn.id = gg.genre_id
         WHERE gg.game_id = g.id), '{}') AS genres,
       COALESCE((SELECT array_agg(pl.name ORDER BY pl.name)
         FROM game_platforms gp JOIN platforms pl ON pl.id = gp.platform_id
         WHERE gp.game_id = g.id), '{}') AS platforms,
       p.created_at AS preorder_registered_at
     FROM game_preorders p
     JOIN games g ON g.id = p.game_id
     JOIN users u ON lower(u.email) = lower(p.email)
     WHERE u.id = $1 AND p.confirmed_at IS NOT NULL AND g.access_type = 'free'
     ORDER BY p.created_at DESC`,
    [userId],
  );
  return rows.map((row) => {
    const game = toClientGame(row);
    const locked = Boolean(row.preorder_ends_at && Date.now() < new Date(row.preorder_ends_at).getTime());
    return {
      ...game,
      owned: false,
      inLibrary: true,
      preorderRegistered: true,
      preorderRegisteredAt: row.preorder_registered_at,
      preorderEndsAt: row.preorder_ends_at,
      preorderLocked: locked,
      downloadAvailable: !locked && game.downloadAvailable,
      launcherAvailable: !locked && game.launcherAvailable,
      downloadUrl: locked ? null : game.downloadUrl,
    };
  });
}

export async function hasPreorderForUser(userId, gameId) {
  const { rows } = await query(
    `SELECT 1
     FROM game_preorders p
     JOIN users u ON lower(u.email) = lower(p.email)
     JOIN games g ON g.id = p.game_id
     WHERE u.id = $1 AND p.game_id = $2 AND p.confirmed_at IS NOT NULL AND g.access_type = 'free'
     LIMIT 1`,
    [userId, gameId],
  );
  return rows.length > 0;
}
