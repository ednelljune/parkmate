import { create } from 'zustand';
import { getPublicConfigValue } from '@/lib/publicConfig';
import { normalizeSupabaseUser } from '@/lib/supabase';

export const authKey = `${getPublicConfigValue('EXPO_PUBLIC_PROJECT_GROUP_ID') || 'parkmate'}-supabase-session`;

/**
 * This store manages the authentication state of the application.
 */
export const useAuthStore = create((set) => ({
  isReady: false,
  session: null,
  user: null,
  setReady: (isReady) => set({ isReady }),
  setSession: (session) => {
    set({
      session,
      user: normalizeSupabaseUser(session?.user),
    });
  },
  reset: () =>
    set({
      session: null,
      user: null,
    }),
}));
