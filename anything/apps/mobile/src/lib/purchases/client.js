import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import {
  getRevenueCatApiKey,
  isRevenueCatConfigured,
  PURCHASES_SUPPORTS_NATIVE,
} from './config';

let hasAppliedPurchasesLogLevel = false;
let hasDisabledPurchasesForSession = false;

const isRevenueCatApiKeyError = (error) => {
  const message = error?.message || error?.userInfo?.message || '';
  const statusCode = error?.statusCode || error?.status || error?.response?.status;

  return statusCode === 401 || /invalid api key/i.test(message);
};

const disablePurchasesForSessionIfNeeded = (error) => {
  if (isRevenueCatApiKeyError(error)) {
    hasDisabledPurchasesForSession = true;
  }
};

const applyPurchasesLogLevel = async () => {
  if (hasAppliedPurchasesLogLevel) {
    return;
  }

  try {
    await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
  } catch (error) {
    console.warn('[purchases] Failed to set RevenueCat log level', {
      message: error?.message || String(error),
    });
  } finally {
    hasAppliedPurchasesLogLevel = true;
  }
};

export const isPurchasesReadyForPlatform = () =>
  Boolean(
    PURCHASES_SUPPORTS_NATIVE &&
      isRevenueCatConfigured() &&
      !hasDisabledPurchasesForSession,
  );

export const isAnonymousPurchasesUserId = (value) =>
  typeof value === 'string' && value.startsWith('$RCAnonymousID:');

export const ensurePurchasesConfigured = async (appUserID = null) => {
  if (!isPurchasesReadyForPlatform()) {
    return {
      available: false,
      configuredNow: false,
    };
  }

  await applyPurchasesLogLevel();

  const configured = await Purchases.isConfigured().catch(() => false);
  if (!configured) {
    Purchases.configure({
      apiKey: getRevenueCatApiKey(),
      appUserID: appUserID || null,
    });

    return {
      available: true,
      configuredNow: true,
    };
  }

  return {
    available: true,
    configuredNow: false,
  };
};

const guardRevenueCatRequest = async (request) => {
  try {
    return await request();
  } catch (error) {
    disablePurchasesForSessionIfNeeded(error);
    throw error;
  }
};

export const getCurrentPurchasesAppUserId = async () => {
  try {
    return await Purchases.getAppUserID();
  } catch (error) {
    return null;
  }
};

export const fetchPurchasesCustomerInfo = async () =>
  guardRevenueCatRequest(() => Purchases.getCustomerInfo());

export const fetchPurchasesOfferings = async () =>
  guardRevenueCatRequest(() => Purchases.getOfferings());

export const logInPurchasesUser = async (appUserID) =>
  guardRevenueCatRequest(() => Purchases.logIn(appUserID));

export const logOutPurchasesUser = async () => guardRevenueCatRequest(() => Purchases.logOut());

export const purchaseRevenueCatPackage = async (proPackage) =>
  guardRevenueCatRequest(() => Purchases.purchasePackage(proPackage));

export const restoreRevenueCatPurchases = async () =>
  guardRevenueCatRequest(() => Purchases.restorePurchases());

export const addPurchasesCustomerInfoListener = (listener) => {
  Purchases.addCustomerInfoUpdateListener(listener);

  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
};
