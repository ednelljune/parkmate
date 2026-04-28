import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  PRO_ACCESS_CACHE_KEY,
  PURCHASES_SUPPORTS_NATIVE,
} from '@/lib/purchases/config';
import {
  addPurchasesCustomerInfoListener,
  ensurePurchasesConfigured,
  fetchPurchasesCustomerInfo,
  fetchPurchasesOfferings,
  getCurrentPurchasesAppUserId,
  isAnonymousPurchasesUserId,
  isPurchasesReadyForPlatform,
  logInPurchasesUser,
  logOutPurchasesUser,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
} from '@/lib/purchases/client';
import {
  getCurrentOffering,
  getProPackage,
  getProPriceLabel,
  hasProEntitlement,
} from '@/lib/purchases/entitlements';
import fetch from '@/__create/fetch';
import { useAuthStore } from '@/utils/auth/store';

const ProAccessContext = createContext(null);

const DEFAULT_GATE_NAME = 'generic_pro_gate';

const normalizeErrorMessage = (error, fallbackMessage) =>
  error?.message || error?.userInfo?.message || fallbackMessage;

const getCachedSnapshotKey = (appUserId) =>
  `${PRO_ACCESS_CACHE_KEY}:${appUserId || 'anonymous'}`;

const loadCachedSnapshot = async (appUserId) => {
  try {
    const rawValue = await AsyncStorage.getItem(getCachedSnapshotKey(appUserId));
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue);
    return typeof parsed?.hasPro === 'boolean' ? parsed : null;
  } catch (error) {
    return null;
  }
};

const persistCachedSnapshot = async (appUserId, hasPro) => {
  try {
    await AsyncStorage.setItem(
      getCachedSnapshotKey(appUserId),
      JSON.stringify({
        hasPro: Boolean(hasPro),
        syncedAt: new Date().toISOString(),
      }),
    );
  } catch (error) {
    console.warn('[purchases] Failed to persist pro access snapshot', {
      message: error?.message || String(error),
    });
  }
};

export function ProAccessProvider({ children }) {
  const isAuthReady = useAuthStore((state) => state.isReady);
  const appUserId = useAuthStore((state) => state.user?.id || null);

  const [state, setState] = useState({
    hasPro: false,
    isReady: !PURCHASES_SUPPORTS_NATIVE,
    isLoading: false,
    isConfigured: false,
    isSupported: PURCHASES_SUPPORTS_NATIVE,
    customerInfo: null,
    serverHasPro: false,
    offerings: null,
    lastError: null,
    isPaywallVisible: false,
    paywallSource: null,
    isPurchaseInFlight: false,
    isRestoreInFlight: false,
  });

  const customerInfoListenerCleanupRef = useRef(null);

  const applyAccessSnapshot = useCallback(
    ({ customerInfo, serverHasPro }) => {
      let nextHasPro = false;

      setState((currentState) => {
        const nextCustomerInfo =
          customerInfo === undefined ? currentState.customerInfo : customerInfo;
        const nextServerHasPro =
          typeof serverHasPro === 'boolean' ? serverHasPro : currentState.serverHasPro;
        nextHasPro = hasProEntitlement(nextCustomerInfo) || nextServerHasPro;

        return {
          ...currentState,
          customerInfo: nextCustomerInfo,
          serverHasPro: nextServerHasPro,
          hasPro: nextHasPro,
          lastError: null,
        };
      });

      persistCachedSnapshot(appUserId, nextHasPro).catch(() => null);
    },
    [appUserId],
  );

  const applyCustomerInfo = useCallback((customerInfo) => {
    applyAccessSnapshot({ customerInfo });
  }, [applyAccessSnapshot]);

  const refreshServerAccess = useCallback(async () => {
    if (!appUserId) {
      applyAccessSnapshot({ customerInfo: null, serverHasPro: false });
      setState((currentState) => ({
        ...currentState,
        isConfigured: false,
        isLoading: false,
        isReady: true,
      }));
      return null;
    }

    try {
      const response = await fetch('/api/users/profile');
      if (!response.ok) {
        throw new Error(`Failed to load account profile (${response.status})`);
      }

      const payload = await response.json();
      applyAccessSnapshot({
        serverHasPro: Boolean(payload?.user?.is_pro_access),
      });

      return payload?.user ?? null;
    } catch (error) {
      setState((currentState) => ({
        ...currentState,
        serverHasPro: false,
        hasPro: hasProEntitlement(currentState.customerInfo),
      }));

      throw error;
    }
  }, [appUserId, applyAccessSnapshot]);

  const refreshProAccess = useCallback(
    async ({ includeOfferings = false } = {}) => {
      if (!isPurchasesReadyForPlatform()) {
        setState((currentState) => ({
          ...currentState,
          isReady: true,
          isLoading: false,
          isConfigured: false,
        }));

        return {
          customerInfo: null,
          offerings: null,
        };
      }

      setState((currentState) => ({
        ...currentState,
        isLoading: true,
      }));

      try {
        const [customerInfo, offerings] = await Promise.all([
          fetchPurchasesCustomerInfo(),
          includeOfferings ? fetchPurchasesOfferings() : Promise.resolve(null),
        ]);

        applyCustomerInfo(customerInfo);

        setState((currentState) => ({
          ...currentState,
          offerings: offerings ?? currentState.offerings,
          isReady: true,
          isLoading: false,
          isConfigured: true,
        }));

        return {
          customerInfo,
          offerings,
        };
      } catch (error) {
        const message = normalizeErrorMessage(
          error,
          'Unable to refresh ParkMate Pro access right now.',
        );

        setState((currentState) => ({
          ...currentState,
          isReady: true,
          isLoading: false,
          lastError: message,
        }));

        throw error;
      }
    },
    [applyCustomerInfo],
  );

  useEffect(() => {
    setState((currentState) => ({
      ...currentState,
      customerInfo: null,
      serverHasPro: false,
      hasPro: false,
    }));

    let isCancelled = false;

    loadCachedSnapshot(appUserId).then((snapshot) => {
      if (isCancelled || !snapshot) {
        return;
      }

      setState((currentState) => ({
        ...currentState,
        hasPro: snapshot.hasPro,
      }));
    });

    return () => {
      isCancelled = true;
    };
  }, [appUserId]);

  useEffect(() => {
    if (!isAuthReady) {
      return undefined;
    }

    let isCancelled = false;

    refreshServerAccess()
      .then(() => {
        if (isCancelled) {
          return;
        }
      })
      .catch(() => null);

    return () => {
      isCancelled = true;
    };
  }, [isAuthReady, refreshServerAccess]);

  useEffect(() => {
    if (!isAuthReady) {
      return undefined;
    }

    let isCancelled = false;

    const bootstrapProAccess = async () => {
      if (!isPurchasesReadyForPlatform()) {
        setState((currentState) => ({
          ...currentState,
          isReady: true,
          isLoading: false,
          isConfigured: false,
        }));
        return;
      }

      setState((currentState) => ({
        ...currentState,
        isLoading: true,
        lastError: null,
      }));

      try {
        const { configuredNow } = await ensurePurchasesConfigured(appUserId);
        let customerInfoFromIdentitySync = null;

        if (!configuredNow) {
          const currentPurchasesAppUserId = await getCurrentPurchasesAppUserId();

          if (appUserId) {
            if (currentPurchasesAppUserId !== appUserId) {
              const logInResult = await logInPurchasesUser(appUserId);
              customerInfoFromIdentitySync = logInResult?.customerInfo || null;
            }
          } else if (
            currentPurchasesAppUserId &&
            !isAnonymousPurchasesUserId(currentPurchasesAppUserId)
          ) {
            customerInfoFromIdentitySync = await logOutPurchasesUser();
          }
        }

        if (!customerInfoListenerCleanupRef.current) {
          customerInfoListenerCleanupRef.current = addPurchasesCustomerInfoListener(
            (customerInfo) => {
              applyCustomerInfo(customerInfo);
              setState((currentState) => ({
                ...currentState,
                isReady: true,
                isConfigured: true,
                isLoading: false,
              }));
            },
          );
        }

        const [{ customerInfo }, offeringsPayload] = await Promise.all([
          customerInfoFromIdentitySync
            ? Promise.resolve({ customerInfo: customerInfoFromIdentitySync })
            : refreshProAccess({ includeOfferings: false }),
          fetchPurchasesOfferings().catch(() => null),
        ]);

        if (isCancelled) {
          return;
        }

        if (customerInfoFromIdentitySync) {
          applyCustomerInfo(customerInfoFromIdentitySync);
        }

        setState((currentState) => ({
          ...currentState,
          offerings: offeringsPayload ?? currentState.offerings,
          isReady: true,
          isLoading: false,
          isConfigured: true,
        }));
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setState((currentState) => ({
          ...currentState,
          isReady: true,
          isLoading: false,
          lastError: normalizeErrorMessage(
            error,
            'Unable to set up ParkMate Pro right now.',
          ),
        }));
      }
    };

    bootstrapProAccess().catch(() => null);

    return () => {
      isCancelled = true;
    };
  }, [appUserId, applyCustomerInfo, isAuthReady, refreshProAccess]);

  useEffect(() => {
    if (!state.isConfigured) {
      return undefined;
    }

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        refreshProAccess({ includeOfferings: false }).catch(() => null);
        refreshServerAccess().catch(() => null);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [appUserId, applyAccessSnapshot, refreshProAccess, state.isConfigured]);

  useEffect(
    () => () => {
      customerInfoListenerCleanupRef.current?.();
      customerInfoListenerCleanupRef.current = null;
    },
    [],
  );

  const dismissPaywall = useCallback(() => {
    setState((currentState) => ({
      ...currentState,
      isPaywallVisible: false,
      paywallSource: null,
    }));
  }, []);

  const presentPaywall = useCallback((source = DEFAULT_GATE_NAME) => {
    setState((currentState) => {
      if (currentState.hasPro) {
        return currentState;
      }

      return {
        ...currentState,
        isPaywallVisible: true,
        paywallSource: source,
      };
    });
  }, []);

  const ensureProAccess = useCallback(
    (source = DEFAULT_GATE_NAME) => {
      if (state.hasPro) {
        return true;
      }

      presentPaywall(source);
      return false;
    },
    [presentPaywall, state.hasPro],
  );

  const proPackage = useMemo(() => getProPackage(state.offerings), [state.offerings]);
  const currentOffering = useMemo(
    () => getCurrentOffering(state.offerings),
    [state.offerings],
  );
  const proPriceLabel = useMemo(() => getProPriceLabel(proPackage), [proPackage]);

  const purchasePro = useCallback(async () => {
    if (!proPackage) {
      const message = state.isConfigured
        ? 'ParkMate Pro is not available for purchase yet.'
        : 'Purchases are not configured for this build yet.';

      setState((currentState) => ({
        ...currentState,
        lastError: message,
      }));

      throw new Error(message);
    }

    setState((currentState) => ({
      ...currentState,
      isPurchaseInFlight: true,
      lastError: null,
    }));

    try {
      const purchaseResult = await purchaseRevenueCatPackage(proPackage);
      const nextCustomerInfo =
        purchaseResult?.customerInfo || purchaseResult?.purchaserInfo || null;

      if (nextCustomerInfo) {
        applyCustomerInfo(nextCustomerInfo);
      }

      setState((currentState) => ({
        ...currentState,
        isPurchaseInFlight: false,
        isPaywallVisible: false,
        paywallSource: null,
      }));

      return nextCustomerInfo;
    } catch (error) {
      if (error?.userCancelled) {
        setState((currentState) => ({
          ...currentState,
          isPurchaseInFlight: false,
        }));

        return null;
      }

      const message = normalizeErrorMessage(
        error,
        'Unable to complete the ParkMate Pro purchase.',
      );

      setState((currentState) => ({
        ...currentState,
        isPurchaseInFlight: false,
        lastError: message,
      }));

      throw error;
    }
  }, [applyCustomerInfo, proPackage, state.isConfigured]);

  const restorePurchases = useCallback(async () => {
    setState((currentState) => ({
      ...currentState,
      isRestoreInFlight: true,
      lastError: null,
    }));

    try {
      const nextCustomerInfo = await restoreRevenueCatPurchases();
      applyCustomerInfo(nextCustomerInfo);

      setState((currentState) => ({
        ...currentState,
        isRestoreInFlight: false,
        isPaywallVisible: false,
        paywallSource: null,
      }));

      return nextCustomerInfo;
    } catch (error) {
      const message = normalizeErrorMessage(
        error,
        'Unable to restore ParkMate Pro purchases.',
      );

      setState((currentState) => ({
        ...currentState,
        isRestoreInFlight: false,
        lastError: message,
      }));

      throw error;
    }
  }, [applyCustomerInfo]);

  const value = useMemo(
    () => ({
      hasPro: state.hasPro,
      isReady: state.isReady,
      isLoading: state.isLoading,
      isConfigured: state.isConfigured,
      isSupported: state.isSupported,
      customerInfo: state.customerInfo,
      offerings: state.offerings,
      currentOffering,
      proPackage,
      proPriceLabel,
      lastError: state.lastError,
      isPaywallVisible: state.isPaywallVisible,
      paywallSource: state.paywallSource,
      isPurchaseInFlight: state.isPurchaseInFlight,
      isRestoreInFlight: state.isRestoreInFlight,
      presentPaywall,
      dismissPaywall,
      ensureProAccess,
      purchasePro,
      restorePurchases,
      refreshProAccess,
      refreshServerAccess,
    }),
    [
      currentOffering,
      dismissPaywall,
      ensureProAccess,
      presentPaywall,
      proPackage,
      proPriceLabel,
      purchasePro,
      refreshProAccess,
      refreshServerAccess,
      restorePurchases,
      state.customerInfo,
      state.hasPro,
      state.isConfigured,
      state.isLoading,
      state.isPaywallVisible,
      state.isPurchaseInFlight,
      state.isReady,
      state.isRestoreInFlight,
      state.isSupported,
      state.lastError,
      state.offerings,
      state.paywallSource,
    ],
  );

  return (
    <ProAccessContext.Provider value={value}>
      {children}
    </ProAccessContext.Provider>
  );
}

export function useProAccess() {
  const context = useContext(ProAccessContext);

  if (!context) {
    throw new Error('useProAccess must be used inside ProAccessProvider');
  }

  return context;
}

export default useProAccess;
