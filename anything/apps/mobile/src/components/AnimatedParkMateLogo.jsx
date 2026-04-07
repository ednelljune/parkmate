import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { createParkMateAnimatedLogoHtml } from '@/components/parkmateLogoAnimatedV8';

export const PARKMATE_LOGO_ANIMATION_DURATION_MS = 3200;

const LOGO_FALLBACK_SOURCE = require('../../assets/images/parkmate-logo.png');

export function AnimatedParkMateLogo({
  size = 96,
  style,
  playOnce = false,
  onAnimationComplete,
}) {
  const [hasWebViewError, setHasWebViewError] = useState(false);
  const completionRef = useRef(false);
  const logoHtml = useMemo(
    () => createParkMateAnimatedLogoHtml(PARKMATE_LOGO_ANIMATION_DURATION_MS),
    [],
  );

  useEffect(() => {
    completionRef.current = false;
  }, [onAnimationComplete, playOnce]);

  useEffect(() => {
    if (!onAnimationComplete || !playOnce || completionRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      if (completionRef.current) {
        return;
      }
      completionRef.current = true;
      onAnimationComplete();
    }, PARKMATE_LOGO_ANIMATION_DURATION_MS);

    return () => clearTimeout(timer);
  }, [onAnimationComplete, playOnce]);

  return (
    <View
      pointerEvents="none"
      style={[styles.container, { width: size, height: size }, style]}
    >
      {hasWebViewError ? (
        <Image
          resizeMode="contain"
          source={LOGO_FALLBACK_SOURCE}
          style={styles.logo}
        />
      ) : (
        <WebView
          bounces={false}
          onError={() => setHasWebViewError(true)}
          scrollEnabled={false}
          source={{ html: logoHtml }}
          style={styles.webView}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    overflow: 'visible',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  webView: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
});

export default AnimatedParkMateLogo;
