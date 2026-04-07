import { getEmailRedirectUrl, getSupabaseClient } from '@/lib/supabase';

export const signInWithCredentials = async ({ email, password, mode, fullName }) => {
  const client = getSupabaseClient();
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedFullName =
    typeof fullName === 'string' && fullName.trim() ? fullName.trim() : null;

  if (mode === 'signup') {
    const { data, error } = await client.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: getEmailRedirectUrl({ flow: 'signup_confirmed' }),
        data: normalizedFullName
          ? {
              full_name: normalizedFullName,
              name: normalizedFullName,
            }
          : undefined,
      },
    });

    if (error) {
      throw error;
    }

    return {
      session: data.session ?? null,
      user: data.user ?? null,
      requiresEmailConfirmation: !data.session,
    };
  }

  const { data, error } = await client.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error) {
    throw error;
  }

  return {
    session: data.session ?? null,
    user: data.user ?? null,
  };
};
