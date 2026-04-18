import { useAuth } from '@/utils/auth/useAuth';
import { AnimatedParkMateLogo } from '@/components/AnimatedParkMateLogo';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStartupPrefetch } from '@/hooks/useStartupPrefetch';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PARKMATE_LOGO_ANIMATION_DURATION_MS } from '@/components/AnimatedParkMateLogo';
import { WebView } from 'react-native-webview';

SplashScreen.preventAutoHideAsync().catch(() => null);

const BOOT_SCENE_TIMEOUT_MS = PARKMATE_LOGO_ANIMATION_DURATION_MS + 2000;
const PARKMATE_SVG_ASSET = Asset.fromModule(
  require('../../assets/images/parkmate-logo.svg'),
);

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
  const { isStartupReady, startupProgress, startupStatusLabel } = useStartupPrefetch();
  const [hasCompletedBootScene, setHasCompletedBootScene] = useState(false);
  const [staticLogoXml, setStaticLogoXml] = useState(null);
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

  useEffect(() => {
    let isCancelled = false;

    const loadStaticLogo = async () => {
      try {
        await PARKMATE_SVG_ASSET.downloadAsync();
        const assetUri =
          PARKMATE_SVG_ASSET.localUri || PARKMATE_SVG_ASSET.uri || null;

        if (!assetUri) {
          return;
        }

        const svgXml = await FileSystem.readAsStringAsync(assetUri);
        if (!isCancelled && svgXml) {
          setStaticLogoXml(svgXml);
        }
      } catch (error) {
        console.warn('[startup.loader] Failed to load ParkMate SVG', {
          message: error?.message || String(error),
        });
      }
    };

    loadStaticLogo().catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, []);

  return !isReady || !hasCompletedBootScene || !isStartupReady ? (
    <View onLayout={hideNativeSplash} style={styles.loadingScreen}>
      <View style={styles.backdropOrbLarge} />
      <View style={styles.backdropOrbSmall} />
      <View style={styles.loadingCard}>
        {hasCompletedBootScene ? (
          staticLogoXml ? (
            <StaticLogoWebView svgXml={staticLogoXml} />
          ) : (
            <Image
              resizeMode="contain"
              source={require('../../assets/images/parkmate-logo-current.png')}
              style={styles.staticLogoImage}
            />
          )
        ) : (
          <PressStartLogo
            onAnimationComplete={handleBootSceneComplete}
          />
        )}
        {hasCompletedBootScene ? (
          <>
            <Text style={styles.loadingEyebrow}>ParkMate Startup</Text>
            <Text style={styles.loadingTitle}>Getting parking ready for you</Text>
            <Text style={styles.loadingLabel}>
              Loading nearby parking zones, activity, and recent spot updates.
            </Text>
            <StartupProgressLane
              progress={startupProgress}
              statusLabel={startupStatusLabel}
            />
          </>
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

function StaticLogoWebView({ svgXml }) {
  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
    />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        overflow: hidden;
      }
      body {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      svg {
        width: 100%;
        height: 100%;
        display: block;
      }
    </style>
  </head>
  <body>
    ${svgXml}
  </body>
</html>`;

  return (
    <View style={styles.staticLogoFrame}>
      <WebView
        bounces={false}
        originWhitelist={['*']}
        scrollEnabled={false}
        source={{ html }}
        style={styles.staticLogoWebView}
      />
    </View>
  );
}

function PressStartLogo({ onAnimationComplete }) {
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const intro = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 70,
        useNativeDriver: true,
      }),
    ]);

    intro.start();
    return () => intro.stop();
  }, [opacity, scale]);

  useEffect(() => {
    if (!onAnimationComplete) {
      return undefined;
    }

    const timer = setTimeout(() => {
      onAnimationComplete();
    }, PARKMATE_LOGO_ANIMATION_DURATION_MS);

    return () => clearTimeout(timer);
  }, [onAnimationComplete]);

  return (
    <Animated.Image
      resizeMode="contain"
      source={require('../../assets/images/parkmate-logo-current.png')}
      style={[
        styles.logoImage,
        {
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
}

function StartupProgressLane({ progress = 0, statusLabel = "Preparing your live parking view" }) {
  const progressFill = useRef(new Animated.Value(0)).current;
  const carProgress = useRef(new Animated.Value(0)).current;
  const barSweep = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.5,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    pulseLoop.start();

    return () => {
      pulseLoop.stop();
      pulse.stopAnimation();
    };
  }, [pulse]);

  useEffect(() => {
    const barSweepLoop = Animated.loop(
      Animated.timing(barSweep, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    barSweepLoop.start();

    return () => {
      barSweepLoop.stop();
      barSweep.stopAnimation();
    };
  }, [barSweep]);

  useEffect(() => {
    const normalizedProgress = Math.max(0, Math.min(progress / 100, 1));
    const fillAnimation = Animated.timing(progressFill, {
      toValue: normalizedProgress,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    const carAnimation = Animated.timing(carProgress, {
      toValue: normalizedProgress,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    fillAnimation.start();
    carAnimation.start();

    return () => {
      fillAnimation.stop();
      carAnimation.stop();
    };
  }, [carProgress, progress, progressFill]);

  const progressFillWidth = progressFill.interpolate({
    inputRange: [0, 1],
    outputRange: ['12%', '100%'],
  });
  const translateX = carProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-84, 84],
  });
  const sweepTranslateX = barSweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-64, 180],
  });

  return (
    <View style={styles.progressSection}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressPercentText}>{Math.max(0, Math.min(Math.round(progress), 100))}%</Text>
        <Text style={styles.progressHeaderText}>Almost there</Text>
      </View>
      <View style={styles.progressLane}>
        <View style={styles.progressLaneGlow} />
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: progressFillWidth,
            },
          ]}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.progressFillSweep,
              {
                transform: [{ translateX: sweepTranslateX }],
              },
            ]}
          />
        </Animated.View>
        <View style={styles.progressDashRow}>
          {Array.from({ length: 8 }).map((_, index) => (
            <View key={index} style={styles.progressDash} />
          ))}
        </View>
        <Animated.View
          style={[
            styles.progressCarWrap,
            {
              transform: [{ translateX }],
            },
          ]}
        >
          <ProgressCar />
        </Animated.View>
      </View>

      <View style={styles.progressLegendRow}>
        <Animated.View style={[styles.progressDot, { opacity: pulse }]} />
        <Text style={styles.progressLegendText}>{statusLabel}</Text>
      </View>
    </View>
  );
}

function ProgressCar() {
  return (
    <View style={styles.progressCar}>
      <View style={styles.progressCarCabin} />
      <View style={styles.progressWheelLeft} />
      <View style={styles.progressWheelRight} />
    </View>
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
    width: '100%',
    maxWidth: 340,
    minHeight: 420,
    borderRadius: 32,
    paddingHorizontal: 28,
    paddingVertical: 34,
    backgroundColor: 'rgba(12, 27, 45, 0.9)',
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 18 },
  },
  logoImage: {
    width: 224,
    height: 224,
  },
  staticLogoImage: {
    width: 208,
    height: 208,
  },
  staticLogoFrame: {
    width: 208,
    height: 208,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  staticLogoWebView: {
    width: 208,
    height: 208,
    backgroundColor: 'transparent',
  },
  loadingEyebrow: {
    marginTop: 4,
    color: '#67E8F9',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  loadingTitle: {
    marginTop: 8,
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  loadingLabel: {
    marginTop: 8,
    color: 'rgba(226,232,240,0.86)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  progressSection: {
    width: '100%',
    maxWidth: 220,
    marginTop: 14,
    alignItems: 'center',
  },
  progressHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
    paddingHorizontal: 4,
  },
  progressPercentText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
  },
  progressHeaderText: {
    color: 'rgba(203, 213, 225, 0.78)',
    fontSize: 11,
    fontWeight: '700',
  },
  progressLane: {
    width: '100%',
    height: 36,
    borderRadius: 13,
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.18)',
  },
  progressLaneGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 145, 178, 0.12)',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor: 'rgba(14, 165, 233, 0.14)',
  },
  progressFillSweep: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 56,
    borderRadius: 13,
    backgroundColor: 'rgba(103, 232, 249, 0.28)',
  },
  progressDashRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  progressDash: {
    width: 10,
    height: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(226, 232, 240, 0.38)',
  },
  progressCarWrap: {
    position: 'absolute',
    left: '50%',
    top: 7,
    marginLeft: -13,
  },
  progressCar: {
    width: 26,
    height: 14,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.16)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  progressCarCabin: {
    position: 'absolute',
    top: 2,
    width: 10,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#0EA5E9',
  },
  progressWheelLeft: {
    position: 'absolute',
    bottom: -2,
    left: 5,
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#0F172A',
  },
  progressWheelRight: {
    position: 'absolute',
    bottom: -2,
    right: 5,
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#0F172A',
  },
  progressLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#34D399',
    marginRight: 6,
  },
  progressLegendText: {
    color: 'rgba(203, 213, 225, 0.84)',
    fontSize: 11,
    fontWeight: '600',
  },
});
