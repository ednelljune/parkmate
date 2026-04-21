const normalizedApiBaseUrl =
  typeof process.env.NEXT_PUBLIC_API_BASE_URL === 'string'
    ? process.env.NEXT_PUBLIC_API_BASE_URL.trim().replace(/\/+$/, '')
    : '';

export function getApiUrl(path: string) {
  if (!path.startsWith('/')) {
    throw new Error(`API path must start with "/": ${path}`);
  }

  return normalizedApiBaseUrl ? `${normalizedApiBaseUrl}${path}` : path;
}
