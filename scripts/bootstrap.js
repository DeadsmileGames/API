import crypto from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { directPool } from '../src/config/database.js';

const client = await directPool.connect();
let locked = false;
try {
  await client.query('SELECT pg_advisory_lock(hashtext($1))', ['deadsmile_games_migrations_v1']);
  locked = true;
  const { rows } = await client.query("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'");
  if (rows[0].count !== 0) throw new Error('Database is not empty. Use npm run db:migrate for an existing database.');
  await client.query('BEGIN');
  await client.query(await readFile(new URL('../src/database/schema.sql', import.meta.url), 'utf8'));
  const directory = new URL('../src/database/migrations/', import.meta.url);
  for (const name of (await readdir(directory)).filter(value => value.endsWith('.sql')).sort()) {
    const checksum = crypto.createHash('sha256').update(await readFile(new URL(name, directory))).digest('hex');
    await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [name, checksum]);
  }
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  if (locked) await client.query('SELECT pg_advisory_unlock(hashtext($1))', ['deadsmile_games_migrations_v1']);
  client.release();
  await directPool.end();
}
