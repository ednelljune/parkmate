import { Pool } from 'pg';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const DATABASE_URL_ENV_KEYS = ['DATABASE_POOLER_URL', 'SUPABASE_POOLER_URL', 'DATABASE_URL'];
const INVALID_DATABASE_URL_WARNING =
  'Ignoring invalid database connection string. Set DATABASE_URL or DATABASE_POOLER_URL to a valid postgres URL.';

let hasWarnedAboutInvalidDatabaseUrl = false;

function warnInvalidDatabaseUrl(envKey, value, error) {
  if (hasWarnedAboutInvalidDatabaseUrl) {
    return;
  }

  hasWarnedAboutInvalidDatabaseUrl = true;
  
  // Sanitize the connection string to remove credentials
  let sanitizedPreview = '<redacted-connection-string>';
  if (typeof value === 'string') {
    // Try to remove user:password@ from the connection string
    const sanitized = value.replace(/^(postgres|postgresql):\/\/[^@]*@/, '$1://***@');
    sanitizedPreview = sanitized.length > 80 ? sanitized.slice(0, 80) : sanitized;
  }

  console.warn(
    `${INVALID_DATABASE_URL_WARNING} Received ${envKey}=${sanitizedPreview}${typeof value === 'string' && value.length > 80 ? '...' : ''}`,
    error,
  );
}

export function parseDatabaseUrl(connectionString) {
  if (typeof connectionString !== 'string') {
    return null;
  }

  const trimmedConnectionString = connectionString.trim();

  if (!trimmedConnectionString) {
    return null;
  }

  try {
    return new URL(trimmedConnectionString);
  } catch {
    return null;
  }
}

export function getDatabaseUrl() {
  for (const envKey of DATABASE_URL_ENV_KEYS) {
    const value = process.env[envKey];
    const parsedUrl = parseDatabaseUrl(value);

    if (parsedUrl) {
      return parsedUrl.toString();
    }

    if (typeof value === 'string' && value.trim()) {
      warnInvalidDatabaseUrl(envKey, value, new TypeError('Invalid URL'));
    }
  }

  return null;
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
  const databaseUrl = parseDatabaseUrl(connectionString);

  if (!databaseUrl) {
    throw new Error('A valid DATABASE_URL is required to create a database pool.');
  }

  const config = {
    connectionString: databaseUrl.toString(),
  };

  if (shouldEnableSsl(databaseUrl)) {
    config.ssl = {
      rejectUnauthorized: false,
    };
  }

  return new Pool(config);
}

export const pool = getDatabaseUrl() ? createDatabasePool() : null;
