import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

const isLocalDatabase = /localhost|127\.0\.0\.1/.test(env.databaseUrl);

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: isLocalDatabase ? false : { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', () => {});

export function query(text, params) {
  return pool.query(text, params);
}
