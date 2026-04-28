import { Platform } from 'react-native';
import { getPublicConfigValue } from '@/lib/publicConfig';

export const PRO_ENTITLEMENT_ID = 'pro';
export const PRO_PRODUCT_ID = 'parkmate_pro_lifetime';
export const PRO_OFFERING_ID = 'default';
export const PRO_LAUNCH_PRICE_LABEL = 'A$19.99';
export const PRO_ACCESS_CACHE_KEY = 'parkmate-pro-access-snapshot';

const APPLE_REVENUECAT_API_KEY = getPublicConfigValue(
  'EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY',
);
const GOOGLE_REVENUECAT_API_KEY = getPublicConfigValue(
  'EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY',
);

export const PURCHASES_SUPPORTS_NATIVE =
  Platform.OS === 'ios' || Platform.OS === 'android';

export const getRevenueCatApiKey = () => {
  if (Platform.OS === 'ios') {
    return APPLE_REVENUECAT_API_KEY;
  }

  if (Platform.OS === 'android') {
    return GOOGLE_REVENUECAT_API_KEY;
  }

  return undefined;
};

export const isRevenueCatConfigured = () =>
  Boolean(PURCHASES_SUPPORTS_NATIVE && getRevenueCatApiKey());

