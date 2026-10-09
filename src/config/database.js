import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

function parseDatabaseUrl(value, name) {
  try {
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) {
      throw new Error();
    }
    return url;
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL connection URL.`);
  }
}


function poolConfig(connectionString, applicationName, max) {
  const url = parseDatabaseUrl(connectionString, applicationName);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (!local) {
    for (const option of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(option);
  }
  const config = {
    connectionString: url.toString(),
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 15_000,
    query_timeout: 20_000,
    idle_in_transaction_session_timeout: 15_000,
    application_name: applicationName,
    keepAlive: true,
  };
  if (!local) config.ssl = { rejectUnauthorized: true, ...(process.env.DATABASE_SSL_CA ? { ca: process.env.DATABASE_SSL_CA } : {}) };
  return config;
}

function directConnectionString() {
  if (env.databaseUrlUnpooled) {
    parseDatabaseUrl(env.databaseUrlUnpooled, 'DATABASE_URL_UNPOOLED');
    return env.databaseUrlUnpooled;
  }
  const url = parseDatabaseUrl(env.databaseUrl, 'DATABASE_URL');
  if (url.hostname.includes('-pooler.') && url.hostname.endsWith('.neon.tech')) {
    url.hostname = url.hostname.replace('-pooler.', '.');
    return url.toString();
  }
  return env.databaseUrl;
}

const poolSize = Number(process.env.DATABASE_POOL_SIZE || 10);
if (!Number.isInteger(poolSize) || poolSize < 1 || poolSize > 30) throw new Error('DATABASE_POOL_SIZE must be between 1 and 30.');
export const pool = new Pool(poolConfig(env.databaseUrl, 'deadsmile-games-api', poolSize));

const directUrl = directConnectionString();
export const directPool = directUrl === env.databaseUrl
  ? pool
  : new Pool(poolConfig(directUrl, 'deadsmile-games-direct', 1));
export const realtimePool = directPool;

function handlePoolError(label) {
  return (error) => {
    console.error(label, {
      code: error?.code || 'UNKNOWN',
      message: error?.message || 'Unexpected database error',
    });
  };
}

pool.on('error', handlePoolError('[database-pool]'));
if (directPool !== pool) {
  directPool.on('error', handlePoolError('[database-direct-pool]'));
}

export function query(text, params) {
  return pool.query(text, params);
}
