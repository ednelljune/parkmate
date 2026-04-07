import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { createClient, processLock } from '@supabase/supabase-js';
import { getPublicConfigValue } from '@/lib/publicConfig';

const MOBILE_APP_SCHEME = 'parkmate';
const supabaseUrl = getPublicConfigValue('EXPO_PUBLIC_SUPABASE_URL');
const supabaseClientKey =
  getPublicConfigValue('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ||
  getPublicConfigValue('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const supabaseProjectRef = supabaseUrl ? new URL(supabaseUrl).hostname.split('.')[0] : null;
export const supabaseStorageKey = 'parkmate-supabase-auth';
const legacySupabaseStorageKey = supabaseProjectRef
  ? `sb-${supabaseProjectRef}-auth-token`
  : null;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseClientKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseClientKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        storageKey: supabaseStorageKey,
        storage: Platform.OS === 'web' ? undefined : AsyncStorage,
        lock: processLock,
      },
    })
  : null;

export function getSupabaseClient() {
  if (!supabase) {
    throw new Error(
      'Supabase Auth is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
    );
  }

  return supabase;
}

export function normalizeSupabaseUser(user) {
  if (!user) {
    return null;
  }

  const metadata = user.user_metadata ?? {};

  return {
    id: user.id,
    email: user.email ?? null,
    name: metadata.full_name ?? metadata.name ?? null,
    image: metadata.avatar_url ?? metadata.picture ?? null,
  };
}

export function getEmailRedirectUrl(params = {}) {
  const queryParams = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value != null && value !== '')
  ).toString();

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const callbackUrl = new URL('/auth/callback', window.location.origin);
    if (queryParams) {
      callbackUrl.search = queryParams;
    }
    return callbackUrl.toString();
  }

  return `${MOBILE_APP_SCHEME}://auth/callback${queryParams ? `?${queryParams}` : ''}`;
}

export async function createSessionFromUrl(url) {
  if (!isSupabaseConfigured || !url) {
    return null;
  }

  const parsed = Linking.parse(url);
  const queryParams = parsed.queryParams ?? {};
  const fragmentParams = parsed.fragment
    ? Object.fromEntries(new URLSearchParams(parsed.fragment))
    : {};
  const allParams = {
    ...fragmentParams,
    ...queryParams,
  };

  const errorCode = allParams.error_code ?? allParams.error;
  const errorDescription = allParams.error_description ?? allParams.errorDescription;

  if (errorCode || errorDescription) {
    throw new Error(errorDescription || errorCode || 'Authentication failed');
  }

  const code = allParams.code;
  const tokenHash = allParams.token_hash;
  const tokenType = allParams.type;
  const accessToken = allParams.access_token;
  const refreshToken = allParams.refresh_token;

  const client = getSupabaseClient();

  if (typeof code === 'string' && code) {
    const { data, error } = await client.auth.exchangeCodeForSession(code);

    if (error) {
      throw error;
    }

    return data.session ?? null;
  }

  if (typeof tokenHash === 'string' && tokenHash && typeof tokenType === 'string' && tokenType) {
    const { data, error } = await client.auth.verifyOtp({
      token_hash: tokenHash,
      type: tokenType,
    });

    if (error) {
      throw error;
    }

    return data.session ?? null;
  }

  if (!accessToken || !refreshToken) {
    return null;
  }

  const { data, error } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    throw error;
  }

  return data.session ?? null;
}

const normalizeCallbackParamValue = (value) => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === 'string' ? value : null;
};

export async function createSessionFromCallbackParams(params = {}) {
  if (!params || typeof params !== 'object') {
    return null;
  }

  const queryParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    const normalizedValue = normalizeCallbackParamValue(value);
    if (normalizedValue != null && normalizedValue !== '') {
      queryParams.set(key, normalizedValue);
    }
  });

  const serializedParams = queryParams.toString();
  if (!serializedParams) {
    return null;
  }

  return createSessionFromUrl(
    `${MOBILE_APP_SCHEME}://auth/callback?${serializedParams}`,
  );
}

export async function clearStoredSupabaseSession() {
  const storageKeys = [supabaseStorageKey, legacySupabaseStorageKey].filter(Boolean);

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    storageKeys.forEach((key) => window.localStorage.removeItem(key));
    return;
  }

  await Promise.all(storageKeys.map((key) => AsyncStorage.removeItem(key)));
}
