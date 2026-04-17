import { useAuth } from '@/utils/auth/useAuth';
import { AnimatedParkMateLogo } from '@/components/AnimatedParkMateLogo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStartupPrefetch } from '@/hooks/useStartupPrefetch';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PARKMATE_LOGO_ANIMATION_DURATION_MS } from '@/components/AnimatedParkMateLogo';

const PARKMATE_STATIC_LOGO = require('../../assets/images/parkmate-logo.png');
SplashScreen.preventAutoHideAsync().catch(() => null);

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

const BOOT_SCENE_TIMEOUT_MS = PARKMATE_LOGO_ANIMATION_DURATION_MS + 2000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <RootLayoutContent />
    </QueryClientProvider>
  );
}

function RootLayoutContent() {
  const { initiate, isReady } = useAuth();
  const { isStartupReady } = useStartupPrefetch();
  const [hasCompletedBootScene, setHasCompletedBootScene] = useState(false);
  const hasHiddenNativeSplash = useRef(false);

  useEffect(() => {
    initiate();
  }, [initiate]);

  const hideNativeSplash = useCallback(() => {
    if (hasHiddenNativeSplash.current) {
      return;
    }
    hasHiddenNativeSplash.current = true;
    SplashScreen.hideAsync().catch(() => null);
  }, []);

  const handleBootSceneComplete = useCallback(() => {
    setHasCompletedBootScene(true);
  }, []);

  useEffect(() => {
    if (hasCompletedBootScene) {
      return;
    }

    const timer = setTimeout(() => {
      handleBootSceneComplete();
    }, BOOT_SCENE_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [handleBootSceneComplete, hasCompletedBootScene]);

  return !isReady || !hasCompletedBootScene || !isStartupReady ? (
    <View onLayout={hideNativeSplash} style={styles.loadingScreen}>
      <View style={styles.backdropOrbLarge} />
      <View style={styles.backdropOrbSmall} />
      <View style={styles.loadingCard}>
        {hasCompletedBootScene ? (
          <Image
            source={PARKMATE_STATIC_LOGO}
            resizeMode="contain"
            style={styles.logoImage}
          />
        ) : (
          <AnimatedParkMateLogo
            size={224}
            style={styles.logoImage}
            playOnce
            onAnimationComplete={handleBootSceneComplete}
          />
        )}
        {hasCompletedBootScene ? (
          <Text style={styles.loadingLabel}>Connecting to ParkMate services...</Text>
        ) : null}
      </View>
    </View>
  ) : (
    <GestureHandlerRootView onLayout={hideNativeSplash} style={{ flex: 1 }}>
      <StatusBar style="dark" animated />
      <Slot />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#0b1f33',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 24,
  },
  backdropOrbLarge: {
    position: 'absolute',
    top: -80,
    right: -30,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(34, 211, 238, 0.18)',
  },
  backdropOrbSmall: {
    position: 'absolute',
    bottom: 70,
    left: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(54, 211, 153, 0.16)',
  },
  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 272,
    height: 272,
  },
  logoImage: {
    width: 224,
    height: 224,
  },
  loadingLabel: {
    marginTop: 18,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
