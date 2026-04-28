import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Lock, Sparkles } from 'lucide-react-native';
import { BRAND_PALETTE } from '@/theme/brandColors';

export function LockedFeatureCard({
  title,
  description,
  ctaLabel = 'Unlock with Pro',
  onPress,
}) {
  const shimmerAnim = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    const shimmerLoop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 2,
        duration: 2400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    shimmerLoop.start();
    return () => shimmerLoop.stop();
  }, [shimmerAnim]);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { opacity: pressed ? 0.94 : 1 },
      ]}
      >
      <View style={styles.iconWrap}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.iconShimmer,
            {
              transform: [
                {
                  translateX: shimmerAnim.interpolate({
                    inputRange: [-1, 2],
                    outputRange: [-22, 44],
                  }),
                },
                { skewX: '-18deg' },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={[
              'transparent',
              'rgba(255,255,255,0.12)',
              'rgba(255,255,255,0.65)',
              'rgba(255,255,255,0.12)',
              'transparent',
            ]}
            end={{ x: 1, y: 0 }}
            start={{ x: 0, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Sparkles color={BRAND_PALETTE.accentBold} size={18} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <View style={styles.ctaRow}>
          <Lock color={BRAND_PALETTE.navy} size={14} />
          <Text style={styles.ctaLabel}>{ctaLabel}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'flex-start',
    backgroundColor: '#F4FAFF',
    borderColor: '#D4E7F6',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: '#E7F3FF',
    borderRadius: 14,
    height: 40,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    width: 40,
  },
  iconShimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 24,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: BRAND_PALETTE.deepNavy,
    fontSize: 15,
    fontWeight: '800',
  },
  description: {
    color: BRAND_PALETTE.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  ctaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  ctaLabel: {
    color: BRAND_PALETTE.navy,
    fontSize: 13,
    fontWeight: '700',
  },
});

export default LockedFeatureCard;
