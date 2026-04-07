import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabasePool, getDatabaseUrl } from '../db/client.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');
const envPaths = [path.join(appRoot, '.env'), path.join(appRoot, '.env.local')];

function parseEnvFile(contents) {
  const entries = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    entries[key] = value;
  }

  return entries;
}

for (const envPath of envPaths) {
  if (!fs.existsSync(envPath)) {
    continue;
  }

  const parsed = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) {
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

if (!getDatabaseUrl()) {
  throw new Error('DATABASE_URL or DATABASE_POOLER_URL is required to check the database connection.');
}

const pool = createDatabasePool();

try {
  const result = await pool.query(`
    SELECT
      current_database() AS database_name,
      current_user AS current_user,
      inet_server_addr()::text AS server_address,
      now() AS server_time
  `);

  console.log(
    JSON.stringify(
      {
        ok: true,
        row: result.rows[0],
      },
      null,
      2
    )
  );
} finally {
  await pool.end();
}
