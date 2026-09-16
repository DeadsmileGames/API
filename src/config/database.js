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

function sslConfig(url) {
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  const hasSslOptions = ['sslmode', 'sslcert', 'sslkey', 'sslrootcert'].some((key) => url.searchParams.has(key));
  return !isLocal && !hasSslOptions ? true : undefined;
}

function poolConfig(connectionString, applicationName, max) {
  const url = parseDatabaseUrl(connectionString, applicationName);
  const config = {
    connectionString,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 15_000,
    query_timeout: 20_000,
    idle_in_transaction_session_timeout: 15_000,
    application_name: applicationName,
    keepAlive: true,
  };
  const ssl = sslConfig(url);
  if (ssl) config.ssl = ssl;
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

export const pool = new Pool(poolConfig(env.databaseUrl, 'deadsmile-games-api', 10));

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
