import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  CheckCircle2,
  Radar,
  Sparkles,
  TimerReset,
  X,
} from 'lucide-react-native';
import { PRO_LAUNCH_PRICE_LABEL } from '@/lib/purchases/config';
import { BRAND_PALETTE } from '@/theme/brandColors';
import { useProAccess } from '@/hooks/useProAccess';

const withAlpha = (hex, alpha) => {
  const normalizedHex = hex.replace('#', '');
  const parsedHex =
    normalizedHex.length === 3
      ? normalizedHex
          .split('')
          .map((char) => char + char)
          .join('')
      : normalizedHex;

  const int = Number.parseInt(parsedHex, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const PAYWALL_COLORS = {
  backgroundGradient: [
    BRAND_PALETTE.deepNavy,
    BRAND_PALETTE.navy,
    withAlpha(BRAND_PALETTE.accentBold, 0.88),
  ],
  logoGradient: [BRAND_PALETTE.navy, BRAND_PALETTE.accentBold],
  closeIcon: withAlpha(BRAND_PALETTE.surface, 0.56),
  heroSubhead: withAlpha(BRAND_PALETTE.surface, 0.78),
  heroTitle: BRAND_PALETTE.surface,
  heroTitleAccent: BRAND_PALETTE.accent,
  contextBackground: BRAND_PALETTE.surface,
  contextBorder: withAlpha(BRAND_PALETTE.accent, 0.22),
  featureIconBackground: BRAND_PALETTE.surface,
  featureIconBorder: withAlpha(BRAND_PALETTE.accent, 0.14),
  featureDescription: withAlpha(BRAND_PALETTE.surface, 0.74),
  noticeTitle: BRAND_PALETTE.surface,
  noticeBody: withAlpha(BRAND_PALETTE.surface, 0.68),
  secondaryText: BRAND_PALETTE.highlight,
  legalText: withAlpha(BRAND_PALETTE.surface, 0.7),
  divider: withAlpha(BRAND_PALETTE.accent, 0.24),
  shimmer: withAlpha(BRAND_PALETTE.surface, 0.28),
};

const FEATURE_ROWS = [
  {
    icon: Radar,
    title: 'Custom Alert Radius',
    description: 'Expand your radar from the default 300m view to wider Pro presets when you need a bigger search area.',
  },
  {
    icon: Sparkles,
    title: 'Best chance sorting',
    description: 'Prioritize fresher, stronger signals so the most promising openings rise to the top first.',
  },
  {
    icon: TimerReset,
    title: 'Custom Reminders',
    description: 'Choose reminder patterns that fit the stay instead of using one fixed warning cadence.',
  },
  {
    icon: CheckCircle2,
    title: 'Profile Insights',
    description: 'See deeper personal metrics like claim conversion, impact per report, and progression pacing.',
  },
];

const GATE_COPY = {
  radius_upgrade: 'Unlock larger radius presets.',
  premium_sort_mode: 'Use Best chance sorting.',
  custom_timer_reminders: 'Choose a reminder preset.',
  claimed_spot_timer: 'Auto-start from a claimed spot.',
  profile_insights: 'Open profile insights.',
  profile_membership: 'Open ParkMate Pro.',
};

export function ProPaywall() {
  const insets = useSafeAreaInsets();
  const {
    dismissPaywall,
    isConfigured,
    isPaywallVisible,
    isPurchaseInFlight,
    isRestoreInFlight,
    lastError,
    paywallSource,
    proPriceLabel,
    purchasePro,
    restorePurchases,
  } = useProAccess();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const auraPulse = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    if (isPaywallVisible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 800,
          easing: Easing.out(Easing.exp),
          useNativeDriver: true,
        }),
      ]).start();

      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(auraPulse, {
            toValue: 1,
            duration: 5000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(auraPulse, {
            toValue: 0,
            duration: 5000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );

      const shimmerLoop = Animated.loop(
        Animated.timing(shimmerAnim, {
          toValue: 2,
          duration: 2400,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );

      pulseLoop.start();
      shimmerLoop.start();
      return () => {
        pulseLoop.stop();
        shimmerLoop.stop();
      };
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(20);
    }
  }, [isPaywallVisible, fadeAnim, slideAnim, auraPulse, shimmerAnim]);

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.spring(buttonScale, {
      toValue: 0.97,
      useNativeDriver: true,
      tension: 150,
      friction: 12,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 150,
      friction: 12,
    }).start();
  };

  const contextualLabel = useMemo(
    () => GATE_COPY[paywallSource] || 'The ultimate parking upgrade.',
    [paywallSource],
  );

  const ctaLabel = useMemo(() => {
    const label = proPriceLabel || PRO_LAUNCH_PRICE_LABEL;
    return label ? `Unlock Pro for ${label}` : 'Unlock ParkMate Pro';
  }, [proPriceLabel]);

  const handlePurchasePress = async () => {
    const customerInfo = await purchasePro();
    if (customerInfo) {
      router.replace('/pro-center');
    }
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={dismissPaywall}
      presentationStyle="fullScreen"
      transparent
      visible={isPaywallVisible}
    >
      <LinearGradient
        colors={PAYWALL_COLORS.backgroundGradient}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.overlay}
      >
        <View style={styles.backgroundContainer}>
          <Animated.View
            style={[
              styles.aura,
              {
                opacity: auraPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.15, 0.4],
                }),
                transform: [
                  {
                    scale: auraPulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.3],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>

        <View
          style={[
            styles.container,
            { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom - 20, 8) },
          ]}
        >
          <View style={styles.header}>
            <Pressable onPress={dismissPaywall} style={styles.closeIcon}>
              <X color={PAYWALL_COLORS.closeIcon} size={24} />
            </Pressable>
          </View>

          <Animated.View style={[styles.hero, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.heroEyebrow}>EXCLUSIVE ACCESS</Text>
            <Text style={styles.heroTitle}>
              <Text style={styles.heroTitlePark}>Park</Text>
              <Text style={styles.heroTitleMate}>Mate</Text>
              {' '}Pro
            </Text>
            <Text style={styles.heroSubhead}>One payment. Permanent premium parking tools.</Text>
            <View style={styles.contextPill}>
              <Text style={styles.contextText}>{contextualLabel}</Text>
            </View>
            <Text style={styles.heroLifetimeNote}>Lifetime access. No recurring subscription.</Text>
          </Animated.View>

          <ScrollView
            style={styles.scrollArea}
            bounces={false}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={{ opacity: fadeAnim }}>
              {FEATURE_ROWS.map((feature) => {
                const Icon = feature.icon;
                return (
                  <View key={feature.title} style={styles.featureItem}>
                    <View style={styles.iconContainer}>
                      <Icon color={BRAND_PALETTE.accentBold} size={24} />
                    </View>
                    <View style={styles.featureCopy}>
                      <Text style={styles.featureTitle}>{feature.title}</Text>
                      <Text style={styles.featureDescription}>{feature.description}</Text>
                    </View>
                  </View>
                );
              })}
            </Animated.View>

            {!isConfigured && (
              <BlurView intensity={14} style={styles.noticeInline}>
                <Text style={styles.noticeTitle}>Sandbox Environment</Text>
                <Text style={styles.noticeBody}>Configure RevenueCat to test the live purchase flow.</Text>
              </BlurView>
            )}

            {lastError && (
              <View style={styles.errorCard}>
                <Text style={styles.errorBody}>{lastError}</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <Pressable
                disabled={!isConfigured || isPurchaseInFlight || isRestoreInFlight}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={() => handlePurchasePress().catch(() => null)}
              >
                <LinearGradient
                  colors={PAYWALL_COLORS.logoGradient}
                  end={{ x: 1, y: 1 }}
                  start={{ x: 0, y: 0 }}
                  style={styles.primaryButton}
                >
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.shimmerOverlay,
                      {
                        opacity: 0.72,
                      },
                      {
                        transform: [
                          {
                            translateX: shimmerAnim.interpolate({
                              inputRange: [-1, 2],
                              outputRange: [-360, 640],
                            }),
                          },
                          { skewX: '-20deg' },
                        ],
                      },
                    ]}
                  >
                    <LinearGradient
                      colors={[
                        'transparent',
                        withAlpha(BRAND_PALETTE.surface, 0.14),
                        withAlpha(BRAND_PALETTE.surface, 0.65),
                        withAlpha(BRAND_PALETTE.surface, 0.14),
                        'transparent',
                      ]}
                      end={{ x: 1, y: 0 }}
                      start={{ x: 0, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                  </Animated.View>

                  {isPurchaseInFlight ? (
                    <ActivityIndicator color={BRAND_PALETTE.surface} />
                  ) : (
                    <View style={styles.primaryButtonContent}>
                      <Text style={styles.primaryButtonText}>{ctaLabel}</Text>
                      <Sparkles color={withAlpha(BRAND_PALETTE.surface, 0.5)} size={20} />
                    </View>
                  )}
                </LinearGradient>
              </Pressable>
            </Animated.View>

            <View style={styles.secondaryActions}>
              <Pressable
                disabled={isPurchaseInFlight || isRestoreInFlight}
                onPress={() => restorePurchases().catch(() => null)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Restore Access</Text>
              </Pressable>
              <View style={styles.dot} />
              <Pressable onPress={dismissPaywall} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Maybe Later</Text>
              </Pressable>
            </View>
            <Text style={styles.legalText}>Single lifetime payment. Terms and Privacy apply.</Text>
          </View>
        </View>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  aura: {
    width: 600,
    height: 600,
    borderRadius: 300,
    backgroundColor: BRAND_PALETTE.accentBold,
    opacity: 0.2,
    filter: 'blur(100px)',
  },
  container: {
    flex: 1,
    paddingHorizontal: 32,
  },
  header: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  closeIcon: {
    padding: 8,
  },
  hero: {
    marginTop: 20,
    alignItems: 'center',
  },
  heroEyebrow: {
    color: BRAND_PALETTE.accentBold,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 48,
    fontWeight: '300',
    letterSpacing: -1,
  },
  heroTitlePark: {
    color: PAYWALL_COLORS.heroTitle,
  },
  heroTitleMate: {
    color: PAYWALL_COLORS.heroTitleAccent,
  },
  heroSubhead: {
    color: PAYWALL_COLORS.heroSubhead,
    fontSize: 18,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 24,
  },
  heroLifetimeNote: {
    color: PAYWALL_COLORS.legalText,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 10,
    textAlign: 'center',
  },
  contextPill: {
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: PAYWALL_COLORS.contextBackground,
    borderWidth: 1,
    borderColor: PAYWALL_COLORS.contextBorder,
  },
  contextText: {
    color: BRAND_PALETTE.accentBold,
    fontSize: 14,
    fontWeight: '700',
  },
  content: {
    paddingTop: 40,
    gap: 24,
  },
  scrollArea: {
    flex: 1,
  },
  featureItem: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 24,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: PAYWALL_COLORS.featureIconBackground,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: PAYWALL_COLORS.featureIconBorder,
  },
  featureCopy: {
    flex: 1,
  },
  featureTitle: {
    color: BRAND_PALETTE.surface,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  featureDescription: {
    color: PAYWALL_COLORS.featureDescription,
    fontSize: 14,
    lineHeight: 20,
  },
  noticeInline: {
    paddingVertical: 8,
  },
  noticeTitle: {
    color: BRAND_PALETTE.surface,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  noticeBody: {
    color: PAYWALL_COLORS.noticeBody,
    fontSize: 13,
  },
  errorCard: {
    padding: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
  },
  errorBody: {
    color: '#EF4444',
    fontSize: 13,
    textAlign: 'center',
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 24,
    paddingBottom: 12,
    gap: 20,
  },
  primaryButton: {
    height: 64,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    shadowColor: BRAND_PALETTE.surface,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 360,
  },
  primaryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  primaryButtonText: {
    color: BRAND_PALETTE.surface,
    fontSize: 18,
    fontWeight: '900',
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  secondaryButton: {
    padding: 8,
  },
  secondaryButtonText: {
    color: PAYWALL_COLORS.secondaryText,
    fontSize: 14,
    fontWeight: '600',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: PAYWALL_COLORS.divider,
  },
  legalText: {
    color: PAYWALL_COLORS.legalText,
    fontSize: 11,
    textAlign: 'center',
  },
});
