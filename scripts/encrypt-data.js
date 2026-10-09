import { directPool } from '../src/config/database.js';
import { encryptSecret } from '../src/utils/secretCipher.js';

export async function encryptStoredData(client) {
  let cursor = null;
  for (;;) {
    const { rows } = await client.query(`SELECT user_id, game_id, slot, payload FROM cloud_saves
      WHERE payload NOT LIKE 'enc.v1.%' AND payload NOT LIKE 'enc.v2.%'
      AND ($1::text IS NULL OR user_id::text || ':' || game_id::text || ':' || slot > $1)
      ORDER BY user_id::text || ':' || game_id::text || ':' || slot LIMIT 100`, [cursor]);
    if (!rows.length) break;
    for (const row of rows) {
      await client.query('UPDATE cloud_saves SET payload = $4 WHERE user_id = $1 AND game_id = $2 AND slot = $3 AND payload = $5',
        [row.user_id, row.game_id, row.slot, encryptSecret(row.payload, `save:${row.user_id}:${row.game_id}:${row.slot}`), row.payload]);
      cursor = `${row.user_id}:${row.game_id}:${row.slot}`;
    }
  }
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const client = await directPool.connect();
  try { await encryptStoredData(client); } finally { client.release(); await directPool.end(); }
}
