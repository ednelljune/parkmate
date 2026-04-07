import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabasePool, getDatabaseUrl } from '../db/client.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');
const schemaPath = path.join(appRoot, 'db', 'schema.sql');
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

function loadLocalEnv() {
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
}

loadLocalEnv();

if (!getDatabaseUrl()) {
  throw new Error('DATABASE_URL is required to bootstrap the database.');
}

const schemaSql = fs.readFileSync(schemaPath, 'utf8');
const pool = createDatabasePool();

try {
  await pool.query(schemaSql);
  console.log(`Applied schema from ${schemaPath}`);
} finally {
  await pool.end();
}
