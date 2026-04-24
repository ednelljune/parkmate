import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { getApiUrl } from '@/utils/api-base';

export async function getAdminAccessToken(sessionAccessToken?: string | null) {
  if (typeof sessionAccessToken === 'string' && sessionAccessToken.trim()) {
    return sessionAccessToken;
  }

  const client = getSupabaseBrowserClient();
  const { data, error } = await client.auth.getSession();

  if (error) {
    throw error;
  }

  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error('You must be signed in to use admin tools.');
  }

  return accessToken;
}

export async function fetchAdminJson<T = any>(
  path: string,
  init: RequestInit = {},
  sessionAccessToken?: string | null,
) {
  const accessToken = await getAdminAccessToken(sessionAccessToken);
  const headers = new Headers(init.headers ?? {});

  if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  headers.set('Authorization', `Bearer ${accessToken}`);

  const response = await fetch(getApiUrl(path), {
    ...init,
    headers,
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || result?.success === false) {
    throw new Error(result?.message || result?.error || 'Request failed.');
  }

  return result as T;
}
