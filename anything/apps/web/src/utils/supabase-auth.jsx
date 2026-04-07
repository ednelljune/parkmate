import { createContext, useContext, useEffect, useState } from 'react';
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
  normalizeSupabaseUser,
} from '@/lib/supabase/client';

const SupabaseAuthContext = createContext({
  isLoading: true,
  session: null,
  user: null,
});

export function SupabaseAuthProvider({ children }) {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      setSession(null);
      return;
    }

    const client = getSupabaseBrowserClient();
    let isMounted = true;

    client.auth.getSession().then(({ data, error }) => {
      if (!isMounted) {
        return;
      }

      if (error) {
        console.error('Failed to restore Supabase session', error);
        setSession(null);
      } else {
        setSession(data.session ?? null);
      }

      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession ?? null);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <SupabaseAuthContext.Provider
      value={{
        isLoading,
        session,
        user: normalizeSupabaseUser(session?.user),
      }}
    >
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  return useContext(SupabaseAuthContext);
}
