import { useEffect, useMemo, useRef, useState } from 'react';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { WebView } from 'react-native-webview';
import { createParkMateAnimatedLogoHtml } from '@/components/parkmateLogoAnimatedV8';

export const PARKMATE_LOGO_ANIMATION_DURATION_MS = 3200;
const PARKMATE_SVG_ASSET = Asset.fromModule(
  require('../../assets/images/parkmate-logo.svg'),
);

const PARKMATE_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#059669"/>
      <stop offset="100%" stop-color="#0284C7"/>
    </linearGradient>
    <linearGradient id="pinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#E2E8F0"/>
    </linearGradient>
    <linearGradient id="pGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284C7"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <linearGradient id="overlay" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.2"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#000000" flood-opacity="0.3"/>
    </filter>
    <filter id="carShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000000" flood-opacity="0.4"/>
    </filter>
    <filter id="textShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#0F172A" flood-opacity="0.6"/>
    </filter>
    <clipPath id="iconClip">
      <rect width="256" height="256" rx="56"/>
    </clipPath>
  </defs>
  <rect width="256" height="256" rx="56" fill="url(#bgGrad)"/>
  <g clip-path="url(#iconClip)">
    <g>
      <path d="M 128 -20 Q 180 64 128 128 T 128 276" fill="none" stroke="#0F172A" stroke-width="50" stroke-linecap="round" opacity="0.2"/>
      <path d="M 128 -20 Q 180 64 128 128 T 128 276" fill="none" stroke="#FFFFFF" stroke-dasharray="16 16" stroke-width="4" opacity="0.4" />
    </g>
    <g>
      <rect x="20" y="0" width="60" height="256" fill="#0F172A" opacity="0.15" />
      <rect x="80" y="0" width="96" height="256" fill="#0F172A" opacity="0.25" />
      <path d="M 50 320 L 50 -60" fill="none" stroke="#FFFFFF" stroke-dasharray="16 16" stroke-width="2" opacity="0.4" />
      <g stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity="0.45">
        <line x1="176" y1="0" x2="176" y2="256" />
        <line x1="80" y1="2" x2="176" y2="2" />
        <line x1="80" y1="38" x2="176" y2="38" />
        <line x1="80" y1="74" x2="176" y2="74" />
        <line x1="80" y1="110" x2="176" y2="110" />
        <line x1="80" y1="146" x2="176" y2="146" />
        <line x1="80" y1="182" x2="176" y2="182" />
        <line x1="80" y1="218" x2="176" y2="218" />
        <line x1="80" y1="254" x2="176" y2="254" />
      </g>
      <g filter="url(#carShadow)">
        <g transform="translate(136, 20) rotate(-2)">
          <rect x="-16" y="-12" width="32" height="24" rx="4" fill="#94A3B8"/>
          <path d="M 2 -9 L 8 -7 L 8 7 L 2 9 Z" fill="#0F172A" opacity="0.8"/>
          <path d="M -12 -7 L -8 -6 L -8 6 L -12 7 Z" fill="#0F172A" opacity="0.8"/>
        </g>
        <g transform="translate(128, 92)">
          <rect x="-16" y="-12" width="32" height="24" rx="4" fill="#CBD5E1"/>
          <path d="M 2 -9 L 8 -7 L 8 7 L 2 9 Z" fill="#0F172A" opacity="0.8"/>
          <path d="M -12 -7 L -8 -6 L -8 6 L -12 7 Z" fill="#0F172A" opacity="0.8"/>
        </g>
        <g transform="translate(124, 164)">
          <rect x="-16" y="-12" width="32" height="24" rx="4" fill="#475569"/>
          <path d="M 2 -9 L 8 -7 L 8 7 L 2 9 Z" fill="#0F172A" opacity="0.8"/>
          <path d="M -12 -7 L -8 -6 L -8 6 L -12 7 Z" fill="#0F172A" opacity="0.8"/>
        </g>
        <g transform="translate(130, 236) rotate(3)">
          <rect x="-16" y="-12" width="32" height="24" rx="4" fill="#64748B"/>
          <path d="M 2 -9 L 8 -7 L 8 7 L 2 9 Z" fill="#0F172A" opacity="0.8"/>
          <path d="M -12 -7 L -8 -6 L -8 6 L -12 7 Z" fill="#0F172A" opacity="0.8"/>
        </g>
      </g>
      <g>
        <rect x="80" y="110" width="96" height="36" fill="#10B981" opacity="0.2" />
        <rect x="84" y="114" width="88" height="28" fill="none" rx="4" stroke="#34D399" stroke-width="2" stroke-dasharray="6 4" />
        <text x="128" y="138" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="28" fill="#10B981" opacity="0.8" text-anchor="middle">P</text>
      </g>
      <rect width="256" height="256" fill="url(#overlay)"/>
    </g>
  </g>
  <g>
    <path d="M 128 44 A 64 64 0 0 0 64 108 C 64 160 120 215 124.5 219.5 C 126.5 221.5 129.5 221.5 131.5 219.5 C 136 215 192 160 192 108 A 64 64 0 0 0 128 44 Z" fill="url(#pinGrad)" filter="url(#shadow)"/>
    <path d="M 106 136 V 80 M 106 80 H 132 A 20 20 0 0 1 132 120 H 106" fill="none" stroke="url(#pGrad)" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <text x="128" y="246" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="900" letter-spacing="1" text-anchor="middle" filter="url(#textShadow)">
    <tspan fill="#FFFFFF">Park</tspan><tspan fill="#FEF08A">Mate</tspan>
  </text>
</svg>`;

export function AnimatedParkMateLogo({
  size = 96,
  style,
  playOnce = false,
  onAnimationComplete,
  staticOnly = false,
}) {
  const [hasWebViewError, setHasWebViewError] = useState(false);
  const [assetSvgXml, setAssetSvgXml] = useState(null);
  const completionRef = useRef(false);
  const logoHtml = useMemo(
    () => createParkMateAnimatedLogoHtml(PARKMATE_LOGO_ANIMATION_DURATION_MS),
    [],
  );
  const renderedSvgXml = assetSvgXml || PARKMATE_LOGO_SVG;

  useEffect(() => {
    let isCancelled = false;

    const loadBundledSvg = async () => {
      try {
        await PARKMATE_SVG_ASSET.downloadAsync();
        const assetUri =
          PARKMATE_SVG_ASSET.localUri || PARKMATE_SVG_ASSET.uri || null;

        if (!assetUri) {
          return;
        }

        const svgXml = await FileSystem.readAsStringAsync(assetUri);
        if (!isCancelled && svgXml) {
          setAssetSvgXml(svgXml);
        }
      } catch {
        // Keep the embedded fallback so startup never breaks on asset load failure.
      }
    };

    loadBundledSvg().catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    completionRef.current = false;
  }, [onAnimationComplete, playOnce, staticOnly]);

  useEffect(() => {
    if (!onAnimationComplete || !playOnce || staticOnly || completionRef.current) {
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
  }, [onAnimationComplete, playOnce, staticOnly]);

  return (
    <View
      pointerEvents="none"
      style={[styles.container, { width: size, height: size }, style]}
    >
      {staticOnly || hasWebViewError ? (
        <SvgXml xml={renderedSvgXml} width="100%" height="100%" />
      ) : (
        <>
          <SvgXml xml={renderedSvgXml} width="100%" height="100%" />
          <WebView
            bounces={false}
            onError={() => setHasWebViewError(true)}
            scrollEnabled={false}
            source={{ html: logoHtml }}
            style={styles.webView}
          />
        </>
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
});

export default AnimatedParkMateLogo;
