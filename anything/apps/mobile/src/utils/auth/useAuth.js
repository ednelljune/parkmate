import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useCallback, useEffect } from 'react';
import {
  clearStoredSupabaseSession,
  createSessionFromUrl,
  getSupabaseClient,
  isSupabaseConfigured,
  normalizeSupabaseUser,
} from '@/lib/supabase';
import { useAuthStore } from './store';

let subscription;
let initPromise;

/**
 * This hook provides authentication functionality.
 */
export const useAuth = () => {
  const { isReady, session, user, setReady, setSession, reset } = useAuthStore();

  const initiate = useCallback(() => {
    if (initPromise) {
      return initPromise;
    }

    initPromise = (async () => {
      if (!isSupabaseConfigured) {
        useAuthStore.setState({
          isReady: true,
          session: null,
          user: null,
        });
        return;
      }

      const client = getSupabaseClient();
      const initialUrl = await Linking.getInitialURL().catch(() => null);

      if (initialUrl) {
        await createSessionFromUrl(initialUrl).catch((error) => {
          console.error('Failed to restore Supabase session from URL', error);
        });
      }

      const {
        data: { session: currentSession },
      } = await client.auth.getSession();

      useAuthStore.setState({
        isReady: true,
        session: currentSession ?? null,
        user: normalizeSupabaseUser(currentSession?.user),
      });

      if (!subscription) {
        const result = client.auth.onAuthStateChange((_event, nextSession) => {
          useAuthStore.setState({
            isReady: true,
            session: nextSession ?? null,
            user: normalizeSupabaseUser(nextSession?.user),
          });
        });

        subscription = result.data.subscription;
      }
    })();

    return initPromise;
  }, []);

  const signIn = useCallback(() => {
    router.push('/accounts/login');
  }, []);
  const signUp = useCallback(() => {
    router.push('/accounts/signup');
  }, []);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) {
      initPromise = undefined;
      subscription?.unsubscribe?.();
      subscription = undefined;
      useAuthStore.setState({
        isReady: true,
        session: null,
        user: null,
      });
      reset();
      router.replace('/accounts/login');
      return;
    }

    const client = getSupabaseClient();
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) {
      throw error;
    }

    await clearStoredSupabaseSession();
    initPromise = undefined;
    subscription?.unsubscribe?.();
    subscription = undefined;
    useAuthStore.setState({
      isReady: true,
      session: null,
      user: null,
    });
    reset();
    router.replace('/accounts/login');
  }, [reset]);

  return {
    isReady,
    isAuthenticated: isReady ? !!session : null,
    signIn,
    signOut,
    signUp,
    auth: session,
    session,
    user,
    setSession,
    setReady,
    initiate,
  };
};

export const useRequireAuth = (options) => {
  const { isAuthenticated, isReady } = useAuth();

  useEffect(() => {
    if (!isAuthenticated && isReady) {
      router.replace(options?.mode === 'signup' ? '/accounts/signup' : '/accounts/login');
    }
  }, [isAuthenticated, isReady, options?.mode]);
};

export default useAuth;
