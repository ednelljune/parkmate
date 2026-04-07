import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const webEnvPath = path.join(repoRoot, 'apps', 'web', '.env');
const mobileEnvPath = path.join(repoRoot, 'apps', 'mobile', '.env');

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) {
      continue;
    }

    const key = current.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      args[key] = 'true';
      continue;
    }

    args[key] = value;
    index += 1;
  }
  return args;
}

function parseEnvFile(contents) {
  const map = new Map();
  for (const rawLine of contents.split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trim().startsWith('#')) {
      continue;
    }

    const separatorIndex = rawLine.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = rawLine.slice(0, separatorIndex).trim();
    const value = rawLine.slice(separatorIndex + 1).trim();
    map.set(key, value);
  }
  return map;
}

function readEnvMap(envPath) {
  if (!fs.existsSync(envPath)) {
    return new Map();
  }
  return parseEnvFile(fs.readFileSync(envPath, 'utf8'));
}

function writeEnvMap(envPath, envMap) {
  const lines = [];
  for (const [key, value] of envMap.entries()) {
    lines.push(`${key}=${value}`);
  }
  fs.writeFileSync(envPath, `${lines.join('\n')}\n`, 'utf8');
}

const args = parseArgs(process.argv.slice(2));
const backendUrl = args['backend-url'];
const databaseUrl = args['database-url'];

if (!backendUrl || !databaseUrl) {
  throw new Error(
    'Usage: node scripts/configure-parkmate-backend.mjs --backend-url https://your-backend.example.com --database-url postgres://...'
  );
}

const backendHost = new URL(backendUrl).host;
const authSecret = args['auth-secret'] || crypto.randomBytes(32).toString('hex');
const corsOrigins =
  args['cors-origins'] ||
  'http://localhost:8081,http://localhost:19006,exp://127.0.0.1:8081';

const webEnv = readEnvMap(webEnvPath);
const mobileEnv = readEnvMap(mobileEnvPath);

webEnv.set('DATABASE_URL', databaseUrl);
webEnv.set('AUTH_SECRET', authSecret);
webEnv.set('AUTH_URL', backendUrl);
webEnv.set('CORS_ORIGINS', corsOrigins);
if (args['anything-project-token']) {
  webEnv.set('ANYTHING_PROJECT_TOKEN', args['anything-project-token']);
}

mobileEnv.set('EXPO_PUBLIC_APP_URL', backendUrl);
mobileEnv.set('EXPO_PUBLIC_BASE_URL', backendUrl);
mobileEnv.set('EXPO_PUBLIC_HOST', backendHost);

writeEnvMap(webEnvPath, webEnv);
writeEnvMap(mobileEnvPath, mobileEnv);

console.log(`Updated ${webEnvPath}`);
console.log(`Updated ${mobileEnvPath}`);
console.log('Next steps:');
console.log('1. Run `node ./scripts/bootstrap-database.mjs` from apps/web.');
console.log('2. Deploy apps/web to your public backend host.');
console.log('3. Restart Expo with `npx expo start -c`.');
