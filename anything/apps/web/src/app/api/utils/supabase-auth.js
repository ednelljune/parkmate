import { createClient } from '@supabase/supabase-js';

const SUPABASE_CONFIG_CANDIDATES = [
  {
    label: 'expo-public',
    urlEnvNames: ['EXPO_PUBLIC_SUPABASE_URL'],
    keyEnvNames: [
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      'EXPO_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ],
  },
  {
    label: 'next-public',
    urlEnvNames: ['NEXT_PUBLIC_SUPABASE_URL'],
    keyEnvNames: [
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ],
  },
];

const SUPABASE_URL_ENV_NAMES = Array.from(
  new Set(SUPABASE_CONFIG_CANDIDATES.flatMap((candidate) => candidate.urlEnvNames)),
);

const SUPABASE_KEY_ENV_NAMES = Array.from(
  new Set(SUPABASE_CONFIG_CANDIDATES.flatMap((candidate) => candidate.keyEnvNames)),
);

function getConfiguredEnvEntry(names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === 'string' && value.trim()) {
      return { name, value: value.trim() };
    }
  }

  return null;
}

function createSupabaseAuthConfigError(message, details) {
  const error = new Error(message);
  error.name = 'SupabaseAuthConfigError';
  error.details = details;
  return error;
}

function readSupabaseAuthConfig() {
  for (const candidate of SUPABASE_CONFIG_CANDIDATES) {
    const urlEntry = getConfiguredEnvEntry(candidate.urlEnvNames);
    if (!urlEntry) {
      continue;
    }

    const keyEntry = getConfiguredEnvEntry(candidate.keyEnvNames);
    if (!keyEntry) {
      continue;
    }

    try {
      new URL(urlEntry.value);
    } catch {
      throw createSupabaseAuthConfigError(
        `Invalid Supabase URL in ${urlEntry.name}`,
        {
          candidate: candidate.label,
          invalidUrlEnvName: urlEntry.name,
        },
      );
    }

    return {
      url: urlEntry.value,
      key: keyEntry.value,
      urlEnvName: urlEntry.name,
      keyEnvName: keyEntry.name,
      candidate: candidate.label,
    };
  }

  const missing = [];

  if (!getConfiguredEnvEntry(SUPABASE_URL_ENV_NAMES)) {
    missing.push(`one of ${SUPABASE_URL_ENV_NAMES.join(', ')}`);
  }

  if (!getConfiguredEnvEntry(SUPABASE_KEY_ENV_NAMES)) {
    missing.push(`one of ${SUPABASE_KEY_ENV_NAMES.join(', ')}`);
  }

  if (missing.length > 0) {
    throw createSupabaseAuthConfigError(
      `Missing Supabase auth environment configuration: ${missing.join('; ')}`,
      {
        missing,
        availableUrlEnvNames: SUPABASE_URL_ENV_NAMES,
        availableKeyEnvNames: SUPABASE_KEY_ENV_NAMES,
        triedCandidates: SUPABASE_CONFIG_CANDIDATES.map((candidate) => ({
          label: candidate.label,
          urlEnvNames: candidate.urlEnvNames,
          keyEnvNames: candidate.keyEnvNames,
        })),
      },
    );
  }

  throw createSupabaseAuthConfigError(
    'Supabase auth environment configuration is incomplete for every supported environment pair',
    {
      availableUrlEnvNames: SUPABASE_URL_ENV_NAMES,
      availableKeyEnvNames: SUPABASE_KEY_ENV_NAMES,
      triedCandidates: SUPABASE_CONFIG_CANDIDATES.map((candidate) => ({
        label: candidate.label,
        urlEnvNames: candidate.urlEnvNames,
        keyEnvNames: candidate.keyEnvNames,
      })),
    },
  );
}

let cachedSupabaseClient = null;

function getSupabaseClient() {
  if (cachedSupabaseClient) {
    return cachedSupabaseClient;
  }

  const config = readSupabaseAuthConfig();
  cachedSupabaseClient = createClient(config.url, config.key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedSupabaseClient;
}

function getBearerToken(request) {
  const authorizationHeader =
    request.headers.get('authorization') || request.headers.get('Authorization');

  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');

  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}

function buildSafeConfigDetails(error) {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const details = error.details;
  if (!details || typeof details !== 'object') {
    return null;
  }

  return { ...details };
}

export async function getAuthenticatedUser(request) {
  const supabase = getSupabaseClient();
  const token = getBearerToken(request);

  if (!token) {
    console.warn('[auth] Missing bearer token on authenticated request', {
      url: request.url,
      method: request.method,
    });
    return { user: null, error: null };
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error) {
    console.error('[auth] Failed to resolve bearer token', {
      url: request.url,
      method: request.method,
      error: error.message,
    });
    return { user: null, error };
  }

  console.log('[auth] Authenticated request', {
    url: request.url,
    method: request.method,
    userId: data.user?.id || null,
  });
  return { user: data.user ?? null, error: null };
}

export async function requireAuthenticatedUser(request) {
  try {
    const { user, error } = await getAuthenticatedUser(request);

    if (error || !user) {
      return {
        user: null,
        response: Response.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 },
        ),
      };
    }

    return { user, response: null };
  } catch (error) {
    console.error('Failed to verify Supabase bearer token:', {
      url: request.url,
      method: request.method,
      name: error?.name || 'Error',
      message: error?.message || String(error),
      details: buildSafeConfigDetails(error),
    });

    const isConfigError = error?.name === 'SupabaseAuthConfigError';

    return {
      user: null,
      response: Response.json(
        {
          success: false,
          error: isConfigError
            ? 'Authentication backend is not configured correctly'
            : 'Authentication is not configured correctly',
        },
        { status: 500 },
      ),
    };
  }
}
