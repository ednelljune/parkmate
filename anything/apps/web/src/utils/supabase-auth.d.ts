declare module '@/utils/supabase-auth' {
  import type { ReactNode } from 'react';

  export function SupabaseAuthProvider(props: { children: ReactNode }): JSX.Element;
  export function useSupabaseAuth(): {
    isLoading: boolean;
    session: unknown;
    user: {
      id: string | null;
      email: string | null;
      name: string | null;
      image: string | null;
    } | null;
  };
}
