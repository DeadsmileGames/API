import { pool, query } from '../src/config/database.js';

const expected = new Set([
  'finish_story',
  'first_checkpoint',
  'first_coin',
  'all_coins',
  'no_death_finish',
]);

try {
  const { rows: games } = await query(
    `SELECT id, title, slug, engine, save_path_template, cloud_saves_enabled
     FROM games
     WHERE slug IN ('abbyrestlessheart', 'abbys-restless-heart')
     ORDER BY created_at ASC`,
  );

  if (games.length !== 1) {
    throw new Error(`Expected exactly one Abby game row, found ${games.length}.`);
  }

  const game = games[0];
  const { rows: achievements } = await query(
    `SELECT key, title, hidden
     FROM achievements
     WHERE game_id = $1
     ORDER BY key`,
    [game.id],
  );

  const keys = new Set(achievements.map((item) => item.key));
  const missing = [...expected].filter((key) => !keys.has(key));

  console.log(JSON.stringify({
    game,
    achievementCount: achievements.length,
    achievements,
    missing,
    ok:
      game.engine === 'pico8' &&
      game.cloud_saves_enabled === true &&
      /deadsmile_abbys_restless_heart\.p8d\.txt$/i.test(game.save_path_template || '') &&
      missing.length === 0,
  }, null, 2));

  if (missing.length) process.exitCode = 1;
} finally {
  await pool.end();
}
