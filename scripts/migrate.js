import crypto from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { directPool } from '../src/config/database.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const directory = path.join(root, '..', 'src', 'database', 'migrations');
const lockName = 'deadsmile_games_migrations_v1';

async function tableExists(client, name) {
  const { rows } = await client.query('SELECT to_regclass($1) IS NOT NULL AS present', [`public.${name}`]);
  return rows[0]?.present === true;
}

async function columnExists(client, table, column) {
  const { rows } = await client.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
     ) AS present`,
    [table, column]
  );
  return rows[0]?.present === true;
}

async function legacyMigrationAlreadyApplied(client, name) {
  if (name === '001_itch_integration.sql') {
    return (await tableExists(client, 'user_itch_accounts'))
      && (await tableExists(client, 'itch_oauth_states'))
      && (await tableExists(client, 'user_game_entitlements'))
      && (await columnExists(client, 'games', 'itch_game_id'));
  }
  if (name === '002_platform_ecosystem.sql') {
    return (await tableExists(client, 'release_channels'))
      && (await tableExists(client, 'game_builds'))
      && (await tableExists(client, 'cloud_saves'))
      && (await tableExists(client, 'telemetry_events'))
      && (await columnExists(client, 'games', 'cloud_saves_enabled'));
  }
  if (name === '003_engagement_realtime.sql') {
    return (await tableExists(client, 'content_events'))
      && (await tableExists(client, 'push_subscriptions'))
      && (await columnExists(client, 'newsletter_subscribers', 'confirmed_at'))
      && (await columnExists(client, 'newsletter_subscribers', 'unsubscribe_token_hash'));
  }
  return false;
}

const client = await directPool.connect();
let locked = false;

try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    checksum text NOT NULL,
    applied_at timestamp with time zone NOT NULL DEFAULT now()
  )`);
  await client.query('SELECT pg_advisory_lock(hashtext($1))', [lockName]);
  locked = true;
  const files = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = await readFile(path.join(directory, file), 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');
    const existing = await client.query('SELECT checksum FROM schema_migrations WHERE name = $1', [file]);
    if (existing.rows[0]) {
      if (existing.rows[0].checksum !== checksum) throw new Error(`Migration checksum mismatch: ${file}`);
      continue;
    }
    if (await legacyMigrationAlreadyApplied(client, file)) {
      await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [file, checksum]);
      continue;
    }
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [file, checksum]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  if (locked) {
    try {
      await client.query('SELECT pg_advisory_unlock(hashtext($1))', [lockName]);
    } catch {}
  }
  client.release();
  await directPool.end();
}
