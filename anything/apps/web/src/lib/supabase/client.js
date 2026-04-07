import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseClientKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseClientKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseClientKey)
  : null;

export function getSupabaseBrowserClient() {
  if (!supabase) {
    throw new Error(
      'Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL plus a publishable/anon key.'
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
