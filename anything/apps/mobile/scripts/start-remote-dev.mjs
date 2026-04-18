import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import ngrok from '@expo/ngrok';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mobileDir = path.resolve(__dirname, '..');
const node20Bin = '/opt/homebrew/opt/node@20/bin/node';
const expoCliPath = path.join(mobileDir, 'node_modules', '@expo', 'cli', 'build', 'bin', 'cli');
const appConfig = JSON.parse(fs.readFileSync(path.join(mobileDir, 'app.json'), 'utf8'));
const mobileScheme = appConfig?.expo?.scheme;

if (!mobileScheme) {
  throw new Error(`Missing expo.scheme in ${path.join(mobileDir, 'app.json')}.`);
}

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const readOption = (name, fallback) => {
  const prefix = `${name}=`;
  const direct = args.find((value) => value.startsWith(prefix));
  if (direct) {
    return direct.slice(prefix.length);
  }

  const index = args.indexOf(name);
  if (index >= 0 && index + 1 < args.length) {
    return args[index + 1];
  }

  return fallback;
};

const metroPort = Number.parseInt(readOption('--metro-port', '8081'), 10);
const backendPort = Number.parseInt(readOption('--backend-port', '4000'), 10);
const printOnly = hasFlag('--print-only');
const ngrokReadyTimeoutMs = Number.parseInt(readOption('--ngrok-ready-timeout-ms', '45000'), 10);

if (!Number.isInteger(metroPort) || metroPort <= 0 || metroPort > 65535) {
  throw new Error(`Invalid --metro-port value: ${metroPort}`);
}

if (!Number.isInteger(backendPort) || backendPort <= 0 || backendPort > 65535) {
  throw new Error(`Invalid --backend-port value: ${backendPort}`);
}

const localEnvPath = path.join(mobileDir, '.env.local');
const defaultBackendUrl = readEnvValue(localEnvPath, 'EXPO_PUBLIC_BASE_URL');

if (printOnly) {
  console.log(`Run 'npm run start:tunnel' from ${mobileDir} to start Expo with an ngrok-backed dev-client tunnel.`);
  console.log(`If your backend needs remote access, start it on port ${backendPort} before running that command.`);
  process.exit(0);
}

if (await isPortListening(metroPort)) {
  throw new Error(
    `Metro port ${metroPort} is already in use. Stop the existing Expo/Metro session and rerun this script.`
  );
}

console.log(`Starting ngrok Metro tunnel on port ${metroPort} ...`);
const metroTunnel = await startNgrokTunnel(metroPort);

let backendTunnel = null;
if (await isPortListening(backendPort)) {
  console.log(`Starting ngrok backend tunnel on port ${backendPort} ...`);
  backendTunnel = await startNgrokTunnel(backendPort);
} else {
  console.warn(
    `Nothing is listening on backend port ${backendPort}. The dev client tunnel will work, but API calls may still fail unless EXPO_PUBLIC_BASE_URL already points at an https backend.`
  );
}

const backendUrl = backendTunnel?.url ?? defaultBackendUrl;
const backendHost = backendUrl ? new URL(backendUrl).host : undefined;
const devClientUrl = `${mobileScheme}://expo-development-client/?url=${encodeURIComponent(metroTunnel.url)}`;

console.log('');
console.log('Remote dev tunnel session:');
console.log(`Metro tunnel:   ${metroTunnel.url}`);
if (backendTunnel) {
  console.log(`Backend tunnel: ${backendTunnel.url}`);
} else {
  console.log(`Backend URL:    ${backendUrl ?? '(not configured)'}`);
}
console.log('');
console.log('Starting Expo dev server in LAN mode behind the tunnel...');
console.log('');

const expoProcess = spawn(
  node20Bin,
  [
    expoCliPath,
    'start',
    '--dev-client',
    '--scheme',
    mobileScheme,
    '--port',
    String(metroPort),
    '--lan',
    '--clear',
  ],
  {
    cwd: mobileDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      CI: '1',
      EXPO_PACKAGER_PROXY_URL: metroTunnel.url,
      RCT_METRO_PORT: String(metroPort),
      INIT_CWD: mobileDir,
      ...(backendUrl
        ? {
            EXPO_PUBLIC_BASE_URL: backendUrl,
            EXPO_PUBLIC_APP_URL: backendUrl,
            EXPO_PUBLIC_HOST: backendHost,
          }
        : {}),
    },
  }
);

console.log(`Open this URL in the installed dev client if QR launch is flaky:\n${devClientUrl}\n`);

let shuttingDown = false;
const shutdown = async (exitCode = 0) => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  expoProcess.kill('SIGINT');
  await Promise.allSettled([stopNgrokTunnel(metroTunnel), stopNgrokTunnel(backendTunnel)]);
  process.exit(exitCode);
};

process.on('SIGINT', () => void shutdown(0));
process.on('SIGTERM', () => void shutdown(0));

expoProcess.on('exit', async (code, signal) => {
  await Promise.allSettled([stopNgrokTunnel(metroTunnel), stopNgrokTunnel(backendTunnel)]);
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

async function startNgrokTunnel(port) {
  const options = {
    addr: port,
  };

  if (process.env.NGROK_REGION) {
    options.region = process.env.NGROK_REGION;
  }

  if (process.env.NGROK_AUTHTOKEN) {
    options.authtoken = process.env.NGROK_AUTHTOKEN;
  }

  if (process.env.NGROK_CONFIG) {
    options.configPath = process.env.NGROK_CONFIG;
  }

  const url = await connectNgrokWithRetry(options, ngrokReadyTimeoutMs);
  return { port, url };
}

async function stopNgrokTunnel(tunnel) {
  if (!tunnel) {
    return;
  }

  try {
    await ngrok.disconnect(tunnel.url);
  } catch {
    // Ignore teardown failures during shutdown.
  }
}

function isPortListening(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });

    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.once('error', () => {
      resolve(false);
    });
  });
}

function readEnvValue(filePath, name) {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  const pattern = new RegExp(`^${escapeRegExp(name)}=(.*)$`, 'm');
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(pattern);
  return match?.[1]?.trim() || undefined;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function connectNgrokWithRetry(options, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  let lastError;

  while (Date.now() < deadline) {
    attempt += 1;

    try {
      return await ngrok.connect(options);
    } catch (error) {
      lastError = error;
      if (!isNgrokNotReadyError(error)) {
        throw error;
      }

      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        break;
      }

      const waitMs = Math.min(1500, remainingMs);
      console.warn(
        `ngrok agent is not ready yet for port ${options.addr}; retrying in ${waitMs}ms (attempt ${attempt}).`
      );
      await delay(waitMs);
    }
  }

  throw lastError;
}

function isNgrokNotReadyError(error) {
  const body = error?.body;
  const message = typeof body?.msg === 'string' ? body.msg : '';
  const detail = typeof body?.details?.err === 'string' ? body.details.err : '';

  return (
    body?.error_code === 104 ||
    message.includes('not yet ready to start tunnels') ||
    detail.includes('has not yet been established')
  );
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
