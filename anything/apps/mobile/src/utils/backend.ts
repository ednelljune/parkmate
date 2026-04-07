import Constants from 'expo-constants';
import { NativeModules } from 'react-native';
import { getPublicConfigValue } from '@/lib/publicConfig';

const trimTrailingSlash = (value?: string | null) => value?.replace(/\/+$/, '') ?? undefined;
const backendDevPort = 4000;
const localhostHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);
const nonLocalHostSuffixes = [
  'loca.lt',
  'ngrok-free.app',
  'ngrok.app',
  'trycloudflare.com',
  'exp.direct',
];

const isIpv4Host = (value: string) => /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value);

const shouldForceDevBackendPort = (hostname?: string | null, expoHost?: string) => {
  if (!hostname) {
    return false;
  }

  return localhostHosts.has(hostname) || isIpv4Host(hostname) || hostname === expoHost;
};

const getUrlHostname = (value?: string | null) => {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).hostname;
  } catch {
    return undefined;
  }
};

const isNonLocalHost = (hostname?: string | null) => {
  if (!hostname) {
    return false;
  }

  return nonLocalHostSuffixes.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
  );
};

const getExpoHost = () => {
  const candidates = [
    Constants.expoConfig?.hostUri,
    Constants.expoGoConfig?.debuggerHost,
    Constants.linkingUri,
    NativeModules.SourceCode?.scriptURL,
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const normalized = candidate.replace(/^[a-zA-Z0-9+.-]+:\/\//, '');
    const match = normalized.match(/^([^/:?]+)/);
    const host = match?.[1];
    if (host && !isNonLocalHost(host)) {
      return host;
    }
  }

  return undefined;
};

const normalizeConfiguredBackendUrl = (value?: string | null, expoHost?: string) => {
  const configuredBaseUrl = trimTrailingSlash(value);
  if (!configuredBaseUrl) {
    return undefined;
  }

  if (!__DEV__) {
    return configuredBaseUrl;
  }

  try {
    const configuredUrl = new URL(configuredBaseUrl);
    const configuredHost = configuredUrl.hostname;

    if (!shouldForceDevBackendPort(configuredHost, expoHost)) {
      return configuredBaseUrl;
    }

    if (expoHost && configuredHost !== expoHost && localhostHosts.has(configuredHost)) {
      configuredUrl.hostname = expoHost;
    }

    configuredUrl.port = String(backendDevPort);
    return trimTrailingSlash(configuredUrl.toString());
  } catch {
    return configuredBaseUrl;
  }
};

const getPreferredConfiguredBaseUrl = () => {
  const rawConfiguredBaseUrl = trimTrailingSlash(
    getPublicConfigValue('EXPO_PUBLIC_BASE_URL') || getPublicConfigValue('EXPO_PUBLIC_APP_URL')
  );
  const expoHost = getExpoHost();
  const configuredBaseUrl = normalizeConfiguredBackendUrl(rawConfiguredBaseUrl, expoHost);

  if (!configuredBaseUrl || !__DEV__) {
    return configuredBaseUrl;
  }

  if (!expoHost) {
    return configuredBaseUrl;
  }

  try {
    const configuredUrl = new URL(configuredBaseUrl);
    const configuredHost = configuredUrl.hostname;

    const shouldRewriteHost = configuredHost !== expoHost && localhostHosts.has(configuredHost);

    if (!shouldRewriteHost) {
      return configuredBaseUrl;
    }

    configuredUrl.hostname = expoHost;
    return trimTrailingSlash(configuredUrl.toString());
  } catch {
    return configuredBaseUrl;
  }
};

export const getConfiguredBaseUrl = () => {
  return getPreferredConfiguredBaseUrl();
};

export const getExpoDerivedBaseUrl = () => {
  const expoHost = getExpoHost();
  return expoHost ? `http://${expoHost}:${backendDevPort}` : undefined;
};

export const getDevFallbackBaseUrl = () => {
  if (!__DEV__) {
    return undefined;
  }

  const configuredBaseUrl = getConfiguredBaseUrl();
  const expoDerivedBaseUrl = getExpoDerivedBaseUrl();
  if (!configuredBaseUrl || !expoDerivedBaseUrl || configuredBaseUrl === expoDerivedBaseUrl) {
    return undefined;
  }

  const configuredHost = getUrlHostname(configuredBaseUrl);
  if (!configuredHost || localhostHosts.has(configuredHost) || isIpv4Host(configuredHost)) {
    return undefined;
  }

  return expoDerivedBaseUrl;
};

export const getResolvedBaseUrl = () => {
  const configuredBaseUrl = getConfiguredBaseUrl();
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  return getExpoDerivedBaseUrl();
};

export const resolveBackendUrl = (path?: string | null) => {
  const normalizedPath = path?.trim();
  if (!normalizedPath) {
    return getResolvedBaseUrl();
  }

  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(normalizedPath)) {
    return normalizedPath;
  }

  const resolvedBaseUrl = getResolvedBaseUrl();
  if (!resolvedBaseUrl) {
    return normalizedPath;
  }

  return normalizedPath.startsWith('/')
    ? `${resolvedBaseUrl}${normalizedPath}`
    : `${resolvedBaseUrl}/${normalizedPath}`;
};

export const getBackendHost = () => {
  const resolvedBaseUrl = getResolvedBaseUrl();
  if (resolvedBaseUrl) {
    try {
      return new URL(resolvedBaseUrl).host;
    } catch {
      return undefined;
    }
  }

  const configuredHost = getPublicConfigValue('EXPO_PUBLIC_HOST');
  return configuredHost || undefined;
};
