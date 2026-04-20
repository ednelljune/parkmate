import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/utils/auth/useAuth';
import {
  clearStoredSupabaseSession,
  createSessionFromCallbackParams,
  getSupabaseClient,
  isSupabaseConfigured,
} from '@/lib/supabase';
import { useAuthStore } from '@/utils/auth/store';

function normalizeParam(value) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === 'string' ? value : null;
}

export default function AuthCallback() {
  const params = useLocalSearchParams();
  const { isReady, isAuthenticated } = useAuth();
  const [isHandlingConfirmation, setIsHandlingConfirmation] = useState(true);
  const [callbackError, setCallbackError] = useState(null);
  const confirmationFlow = normalizeParam(params.flow);
  const confirmationType = normalizeParam(params.type);
  const code = normalizeParam(params.code);
  const tokenHash = normalizeParam(params.token_hash);
  const accessToken = normalizeParam(params.access_token);
  const refreshToken = normalizeParam(params.refresh_token);
  const authError = normalizeParam(params.error) || normalizeParam(params.error_code);
  const hasSessionCallbackParams = useMemo(
    () =>
      Boolean(
        code ||
          tokenHash ||
          (accessToken && refreshToken) ||
          authError,
      ),
    [accessToken, authError, code, refreshToken, tokenHash]
  );
  const callbackParams = useMemo(
    () => ({
      access_token: accessToken,
      code,
      error: normalizeParam(params.error),
      error_code: normalizeParam(params.error_code),
      error_description: normalizeParam(params.error_description),
      flow: confirmationFlow,
      refresh_token: refreshToken,
      token_hash: tokenHash,
      type: confirmationType,
    }),
    [
      accessToken,
      code,
      confirmationFlow,
      confirmationType,
      params.error,
      params.error_code,
      params.error_description,
      refreshToken,
      tokenHash,
    ]
  );
  const isSignupConfirmation = useMemo(
    () =>
      confirmationFlow === 'signup_confirmed' ||
      confirmationType === 'signup',
    [confirmationFlow, confirmationType]
  );

  useEffect(() => {
    let isMounted = true;

    const handleAuthCallback = async () => {
      try {
        if (hasSessionCallbackParams && !isAuthenticated) {
          await createSessionFromCallbackParams(callbackParams);
        }

        if (!isSignupConfirmation) {
          if (isMounted) {
            setIsHandlingConfirmation(false);
            setCallbackError(null);
          }
          return;
        }

        if (isSupabaseConfigured) {
          await getSupabaseClient().auth.signOut({ scope: 'local' }).catch(() => null);
        }
        await clearStoredSupabaseSession().catch(() => null);
        useAuthStore.setState({
          isReady: true,
          session: null,
          user: null,
        });
      } catch (error) {
        if (isMounted) {
          setCallbackError(error instanceof Error ? error.message : 'Unable to complete sign in.');
        }
      } finally {
        if (isMounted) {
          if (isSignupConfirmation) {
            router.replace({
              pathname: '/accounts/login',
              params: { confirmed: '1' },
            });
          } else {
            setIsHandlingConfirmation(false);
          }
        }
      }
    };

    if (!isReady) {
      return () => {
        isMounted = false;
      };
    }

    handleAuthCallback();

    return () => {
      isMounted = false;
    };
  }, [
    callbackParams,
    hasSessionCallbackParams,
    isAuthenticated,
    isReady,
    isSignupConfirmation,
  ]);

  if (isSignupConfirmation && (!isReady || isHandlingConfirmation)) {
    return (
      <View style={styles.screen}>
        <ActivityIndicator color="#0284c7" size="large" />
        <Text style={styles.text}>Confirming your email...</Text>
      </View>
    );
  }

  if (isReady && isAuthenticated) {
    return <Redirect href="/" />;
  }

  if (callbackError) {
    return (
      <View style={styles.screen}>
        <Text style={styles.text}>Sign-in link failed</Text>
        <Text style={styles.errorText}>{callbackError}</Text>
      </View>
    );
  }

  if (isReady && !isAuthenticated) {
    return <Redirect href="/accounts/login" />;
  }

  return (
    <View style={styles.screen}>
      <ActivityIndicator color="#0284c7" size="large" />
      <Text style={styles.text}>Finishing sign in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b1f33',
    gap: 16,
  },
  text: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#fda4af',
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 280,
    textAlign: 'center',
  },
});
