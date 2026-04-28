import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND_PALETTE } from '@/theme/brandColors';

export function ShiningProBadge({ label = 'Pro', style, textStyle }) {
  const shimmerAnim = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    const shimmerLoop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 2,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    shimmerLoop.start();
    return () => shimmerLoop.stop();
  }, [shimmerAnim]);

  return (
    <View style={[styles.badge, style]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.shimmer,
          {
            transform: [
              {
                translateX: shimmerAnim.interpolate({
                  inputRange: [-1, 2],
                  outputRange: [-40, 80],
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
            'rgba(255,255,255,0.16)',
            'rgba(255,255,255,0.6)',
            'rgba(255,255,255,0.16)',
            'transparent',
          ]}
          end={{ x: 1, y: 0 }}
          start={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Text style={[styles.text, textStyle]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    backgroundColor: BRAND_PALETTE.deepNavy,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    overflow: 'hidden',
    position: 'relative',
    alignSelf: 'flex-start',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 30,
  },
  text: {
    color: BRAND_PALETTE.surface,
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});

export default ShiningProBadge;
