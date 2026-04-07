import { Pool } from 'pg';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function getDatabaseUrl() {
  return (
    process.env.DATABASE_POOLER_URL ||
    process.env.SUPABASE_POOLER_URL ||
    process.env.DATABASE_URL ||
    null
  );
}

function shouldDisableSsl(url) {
  const sslMode = url.searchParams.get('sslmode');
  const ssl = url.searchParams.get('ssl');

  return (
    sslMode === 'disable' ||
    ssl === 'disable' ||
    ssl === 'false' ||
    ssl === '0'
  );
}

function shouldEnableSsl(url) {
  if (LOCAL_HOSTS.has(url.hostname)) {
    return false;
  }

  return !shouldDisableSsl(url);
}

export function createDatabasePool(connectionString = getDatabaseUrl()) {
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to create a database pool.');
  }

  const databaseUrl = new URL(connectionString);
  const config = {
    connectionString,
  };

  if (shouldEnableSsl(databaseUrl)) {
    config.ssl = {
      rejectUnauthorized: false,
    };
  }

  return new Pool(config);
}

export const pool = getDatabaseUrl() ? createDatabasePool() : null;
