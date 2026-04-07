import { fetch as expoFetch } from 'expo/fetch';
import { getPublicConfigValue } from '../lib/publicConfig';
import {
  getConfiguredBaseUrl,
  getDevFallbackBaseUrl,
  getResolvedBaseUrl,
} from '../utils/backend';
import { useAuthStore } from '../utils/auth/store';

const originalFetch = fetch;
const retriableGatewayStatuses = new Set([502, 503, 504]);
const tunnelHostSuffixes = ['loca.lt', 'ngrok-free.app', 'ngrok.app', 'trycloudflare.com'];

const getURLFromArgs = (...args: Parameters<typeof fetch>) => {
  const [urlArg] = args;
  let url: string | null;
  if (typeof urlArg === 'string') {
    url = urlArg;
  } else if (typeof urlArg === 'object' && urlArg !== null) {
    url = urlArg.url;
  } else {
    url = null;
  }
  return url;
};

const isFileURL = (url: string) => {
  return url.startsWith('file://') || url.startsWith('data:');
};

const getHostname = (value?: string | null) => {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).hostname;
  } catch {
    return undefined;
  }
};

const isTunnelUrl = (value?: string | null) => {
  const hostname = getHostname(value);
  if (!hostname) {
    return false;
  }

  return tunnelHostSuffixes.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
  );
};

const buildFallbackUrl = (requestUrl: string, fallbackBaseUrl?: string) => {
  if (!fallbackBaseUrl) {
    return null;
  }

  try {
    const parsedRequestUrl = new URL(requestUrl);
    return `${fallbackBaseUrl}${parsedRequestUrl.pathname}${parsedRequestUrl.search}`;
  } catch {
    return null;
  }
};

const isFirstPartyURL = (url: string) => {
  const resolvedBaseUrl = getResolvedBaseUrl();
  const configuredBaseUrl = getConfiguredBaseUrl();
  return (
    url.startsWith('/') ||
    (configuredBaseUrl && url.startsWith(configuredBaseUrl)) ||
    (resolvedBaseUrl && url.startsWith(resolvedBaseUrl))
  );
};

const isSecondPartyURL = (url: string) => {
  return url.startsWith('/_create/');
};

type Params = Parameters<typeof expoFetch>;
const fetchToWeb = async function fetchWithHeaders(...args: Params) {
  const firstPartyURL = getResolvedBaseUrl();
  const secondPartyURL = getPublicConfigValue('EXPO_PUBLIC_PROXY_BASE_URL');
  const [input, init] = args;
  const url = getURLFromArgs(input, init);
  if (!url) {
    return expoFetch(input, init);
  }

  if (isFileURL(url)) {
    return originalFetch(input, init);
  }

  const isExternalFetch = !isFirstPartyURL(url);
  // we should not add headers to requests that don't go to our own server
  if (isExternalFetch) {
    return expoFetch(input, init);
  }

  let finalInput = input;
  const baseURL = isSecondPartyURL(url) ? secondPartyURL : firstPartyURL;
  const configuredBaseUrl = getConfiguredBaseUrl();
  if (typeof input === 'string') {
    if (input.startsWith('/')) {
      finalInput = `${baseURL}${input}`;
    } else if (
      baseURL &&
      configuredBaseUrl &&
      input.startsWith(configuredBaseUrl) &&
      configuredBaseUrl !== baseURL
    ) {
      finalInput = `${baseURL}${input.slice(configuredBaseUrl.length)}`;
    } else {
      finalInput = input;
    }
  } else {
    return expoFetch(input, init);
  }

  const initHeaders = init?.headers ?? {};
  const finalHeaders = new Headers(initHeaders);

  const headers = {
    'x-createxyz-project-group-id': getPublicConfigValue('EXPO_PUBLIC_PROJECT_GROUP_ID'),
  };

  for (const [key, value] of Object.entries(headers)) {
    if (value) {
      finalHeaders.set(key, value);
    }
  }

  const auth = useAuthStore.getState().session;

  if (auth?.access_token) {
    finalHeaders.set('authorization', `Bearer ${auth.access_token}`);
  }

  const finalHeadersObject = Object.fromEntries(finalHeaders.entries());
  const finalUrl = typeof finalInput === 'string' ? finalInput : url;
  const fallbackBaseUrl = getDevFallbackBaseUrl();
  const fallbackUrl =
    typeof finalUrl === 'string' && isTunnelUrl(finalUrl)
      ? buildFallbackUrl(finalUrl, fallbackBaseUrl)
      : null;
  const shouldTraceAuthRequest =
    typeof finalUrl === 'string' &&
    (
      finalUrl.includes('/api/reports/create') ||
      finalUrl.includes('/api/users/profile') ||
      finalUrl.includes('/api/notifications/activity')
    );

  if (shouldTraceAuthRequest) {
    console.log('[fetch.auth] Sending first-party request', {
      originalUrl: url,
      finalUrl,
      hasSession: !!auth,
      hasAccessToken: !!auth?.access_token,
      authHeaderPresent: !!finalHeadersObject.authorization,
      projectGroupHeaderPresent: !!finalHeadersObject['x-createxyz-project-group-id'],
    });
  }

  const requestInit = {
    ...init,
    headers: finalHeadersObject,
  };

  try {
    const response = await expoFetch(finalInput, requestInit);

    if (
      fallbackUrl &&
      retriableGatewayStatuses.has(response.status)
    ) {
      console.warn('[fetch.auth] Retrying first-party request against Expo LAN backend', {
        originalUrl: finalUrl,
        fallbackUrl,
        status: response.status,
      });

      return expoFetch(fallbackUrl, requestInit);
    }

    return response;
  } catch (error) {
    if (fallbackUrl) {
      console.warn('[fetch.auth] First-party request failed against tunnel host, retrying Expo LAN backend', {
        originalUrl: finalUrl,
        fallbackUrl,
        message: error instanceof Error ? error.message : String(error),
      });

      return expoFetch(fallbackUrl, requestInit);
    }

    throw error;
  }
};

export default fetchToWeb;
