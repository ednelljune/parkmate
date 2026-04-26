import { useEffect, useMemo, useRef, useState } from "react";
import { Redirect, Tabs, useGlobalSearchParams, useRouter } from "expo-router";
import { Bell, ChevronRight, Clock, History, Info, MapPin, ShieldCheck, Trophy, User } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { MotiView, AnimatePresence } from "moti";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useLocation } from "@/hooks/useLocation";
import { getDistanceMeters } from "@/utils/geo";
import { useNearbyReports, useParkingZones } from "@/hooks/useParkingData";
import {
  configureNotificationHandler,
  isExpoGo,
  notificationsUnsupportedInCurrentRuntime,
  scheduleLocalAlertNotification,
} from "@/lib/notifications";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuthStore } from "@/utils/auth/store";
import useUser from "@/utils/auth/useUser";
import { BRAND_PALETTE } from "@/theme/brandColors";
import { getDetectedZonePins } from "@/utils/parkingZonePins";
import {
  normalizeApiZoneAlert,
  normalizeCouncilZoneAlert,
} from "@/utils/zoneAlerts";
import { PARKING_ALERT_RADIUS_METERS } from "@/constants/detectionRadius";
import { useUnreadActivityCount } from "@/hooks/useActivityNotifications";
import {
  hydrateSystemUpdateNotificationState,
  markSystemUpdatesNotified,
  primeSystemUpdatesNotified,
} from "@/utils/systemUpdateNotificationState";
import { deriveSystemUpdateItems } from "@/utils/systemUpdates";
import {
  addSentryBreadcrumb,
  captureError,
  normalizeForSentry,
} from "@/monitoring/sentry";
import { useFirstLoginTutorial } from "@/utils/firstLoginTutorial";

export const unstable_settings = {
  initialRouteName: "index",
};

const ALERT_RADIUS_METERS = PARKING_ALERT_RADIUS_METERS;
const IN_APP_TOUR_STEPS = [
  {
    id: "map",
    route: "/",
    label: "Map",
    icon: MapPin,
    title: "Find parking from the map",
    body: "Open zone pins, report real openings, claim a spot you took, flag false reports, or suggest a missing public zone.",
    chips: ["Zone pins", "Report spot", "Claim / false / suggest"],
    demoTitle: "Live map actions",
    demoHint: "Tap a zone, report an opening, or suggest a missing public zone.",
  },
  {
    id: "alerts",
    route: "/notifications",
    label: "Alerts",
    icon: Bell,
    title: "Watch nearby parking movement",
    body: "Use Alerts when you want a faster feed of nearby reports and zones without scanning the map constantly.",
    chips: ["Nearby feed", "Open on map"],
    demoTitle: "Nearby feed",
    demoHint: "Fresh reports and zone updates appear here first.",
  },
  {
    id: "timer",
    route: "/timer",
    label: "Timer",
    icon: Clock,
    title: "Track your stay after you park",
    body: "Use the manual timer for your own stay and let the claimed timer handle automatic claim-linked sessions separately.",
    chips: ["Manual timer", "Auto claimed timer"],
    demoTitle: "Parking countdown",
    demoHint: "Manual timer stays separate from the auto claimed timer lane.",
  },
  {
    id: "activity",
    route: "/activity",
    label: "Activity",
    icon: History,
    title: "Check outcomes and system updates",
    body: "See if your reports were claimed, expired, reviewed, approved, or rejected, then manage updates with swipe actions.",
    chips: ["Claims", "Review outcomes"],
    demoTitle: "Outcome updates",
    demoHint: "Claims, approvals, and rejections land here with swipe actions.",
  },
  {
    id: "leaders",
    route: "/leaderboard",
    label: "Leaders",
    icon: Trophy,
    title: "Climb the city leaderboard",
    body: "Ranking is based on impact, so accurate reports, claims, and approved zones help move you up.",
    chips: ["Impact rank", "Badge tier"],
    demoTitle: "Impact competition",
    demoHint: "Your position rises as your reports and zones help other drivers.",
  },
  {
    id: "profile",
    route: "/profile",
    label: "Profile",
    icon: User,
    title: "Track your progress",
    body: "Your profile shows your badge, rank, contribution score, legal links, and a replay entry for this tour.",
    chips: ["Badge + rank", "Replay later"],
    demoTitle: "Driver profile",
    demoHint: "Check your badge, rank, and replay the tour any time.",
  },
];
const isFiniteCoordinate = (value) => Number.isFinite(Number(value));
const toNotificationString = (value, fallback = "") => {
  if (value == null) {
    return fallback;
  }

  const normalized = String(value);
  return normalized.length > 0 ? normalized : fallback;
};

const buildNotificationData = (alert) => {
  if (alert?.alertType === "zone") {
    if (!isFiniteCoordinate(alert.center_lat) || !isFiniteCoordinate(alert.center_lng)) {
      return null;
    }

    return {
      zoneId: toNotificationString(alert.zoneId || alert.id),
      zoneName: toNotificationString(alert.zone_name, "Parking Zone"),
      zoneType: toNotificationString(alert.zone_type, "Parking"),
      zoneLat: String(Number(alert.center_lat)),
      zoneLng: String(Number(alert.center_lng)),
      zoneCapacity: toNotificationString(alert.capacity_spaces ?? ""),
      zoneRules: toNotificationString(alert.rules_description ?? ""),
    };
  }

  if (!isFiniteCoordinate(alert?.latitude) || !isFiniteCoordinate(alert?.longitude)) {
    return null;
  }

  return {
    reportId: toNotificationString(alert.id).replace(/^report-/, ""),
    latitude: String(Number(alert.latitude)),
    longitude: String(Number(alert.longitude)),
    zone_name: toNotificationString(alert.zone_name, "Parking Spot"),
    zone_type: toNotificationString(alert.zone_type || alert.parking_type),
    parking_type: toNotificationString(alert.parking_type || alert.zone_type),
  };
};

const buildAlertNotificationPayload = (alert, count) => {
  const distance =
    typeof alert?.distance_meters === "number"
      ? `${Math.round(alert.distance_meters)}m away`
      : "nearby";

  if (alert?.alertType === "zone") {
    return {
      title:
        count > 1 ? `${count} nearby parking alerts` : "Nearby parking zone",
      body:
        count > 1
          ? `Latest: ${alert.zone_type || "Parking"} zone in ${alert.zone_name || "your area"} ${distance}.`
          : `${alert.zone_type || "Parking"} zone in ${alert.zone_name || "your area"} is ${distance}.`,
    };
  }

  const quantity = alert?.quantity || 1;
  const parkingType = alert?.parking_type || alert?.zone_type || "Parking";
  const zoneName = alert?.zone_name ? ` in ${alert.zone_name}` : "";

  if (count > 1) {
    return {
      title: `${count} nearby parking alerts`,
      body: `Latest: ${quantity} ${parkingType} spot${quantity > 1 ? "s" : ""}${zoneName} ${distance}.`,
    };
  }

  return {
    title: "Nearby parking spot",
    body: `${quantity} ${parkingType} spot${quantity > 1 ? "s" : ""}${zoneName} ${distance}.`,
  };
};

const buildSystemUpdateNotificationPayload = (item) => {
  const zoneName = item?.zone_name || "Reported spot";
  const parkingType = item?.parking_type || item?.zone_type || "Parking";
  const quantity = Math.max(1, Number(item?.quantity) || 1);
  const quantityLabel =
    quantity > 1 ? `${quantity} ${parkingType} spots` : `${parkingType} spot`;
  const falseReportCount = Math.max(1, Number(item?.false_report_count) || 1);
  const trustThreshold = Math.max(1, Number(item?.trust_score_threshold) || 3);

  if (item?.mailbox_type === "claimed") {
    return {
      title: "Your reported spot was claimed",
      body: `${quantityLabel} in ${zoneName} was claimed. You earned +${Math.max(0, Number(item?.claim_points_awarded) || 10)} contribution points.`,
    };
  }

  if (item?.mailbox_type === "expired") {
    return {
      title: "Your reported spot expired",
      body: `${quantityLabel} in ${zoneName} expired without being claimed.`,
    };
  }

  if (item?.mailbox_type === "zone_reviewing") {
    return {
      title: "Missing zone under review",
      body: `Your missing public zone suggestion in ${zoneName} is now under review.`,
    };
  }

  if (item?.mailbox_type === "zone_approved") {
    return {
      title: "Missing zone approved",
      body: `Your missing public zone suggestion in ${zoneName} was approved and added to the map. You earned +${Math.max(0, Number(item?.claim_points_awarded) || 10)} contribution points.`,
    };
  }

  if (item?.mailbox_type === "zone_rejected") {
    return {
      title: "Missing zone not approved",
      body: `Your missing public zone suggestion in ${zoneName} was not approved.`,
    };
  }

  return {
    title: "Your reported spot was flagged",
    body:
      falseReportCount >= trustThreshold
        ? `${quantityLabel} in ${zoneName} was flagged as false by ${falseReportCount} drivers. Trust score impact has been applied.`
        : `${quantityLabel} in ${zoneName} was flagged as false by ${falseReportCount} drivers.`,
  };
};

const buildSystemUpdateNotificationData = (item) => ({
  screen: "activity",
  type: item?.mailbox_type || "system_update",
  reportId: item?.report_id ? String(item.report_id) : "",
  zone_name: item?.zone_name || "Reported spot",
  zone_type: item?.zone_type || "",
  parking_type: item?.parking_type || "",
  quantity: Math.max(1, Number(item?.quantity) || 1),
  latitude: item?.latitude != null ? String(item.latitude) : "",
  longitude: item?.longitude != null ? String(item.longitude) : "",
});

function TourOverlay({
  activeStep,
  activeStepIndex,
  isFirstStep,
  isLastStep,
  isSaving,
  onBack,
  onNext,
  onClose,
}) {
  const insets = useSafeAreaInsets();
  const ActiveIcon = activeStep.icon;
  const progress = (activeStepIndex + 1) / IN_APP_TOUR_STEPS.length;

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={["#059669", "#0284C7"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={[styles.tourOverlayWrap, { paddingTop: insets.top + 20 }]}>
        <MotiView
          from={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "timing", duration: 600 }}
          style={styles.tourBranding}
        >
          <Text style={styles.tourBrandingPark}>Park</Text>
          <Text style={styles.tourBrandingMate}>Mate</Text>
        </MotiView>

        <AnimatePresence mode="wait">
          <MotiView
            key={activeStep.id}
            from={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: "spring", damping: 15 }}
            style={styles.tourCardContainer}
          >
            <BlurView intensity={Platform.OS === 'ios' ? 80 : 100} tint="light" style={styles.tourCard}>
              <View style={styles.tourProgressBarBg}>
                <MotiView
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ type: "timing", duration: 500 }}
                  style={styles.tourProgressBarFill}
                />
              </View>

              <View style={styles.tourCardHeader}>
                <View style={styles.tourIconCircle}>
                  <ActiveIcon color="#0284C7" size={28} />
                </View>
                <View style={styles.tourStepIndicator}>
                  <Text style={styles.tourStepIndicatorText}>
                    STEP {activeStepIndex + 1}
                  </Text>
                </View>
              </View>

              <Text style={styles.tourTitle}>{activeStep.title}</Text>
              <Text style={styles.tourBody}>{activeStep.body}</Text>

              <View style={styles.tourChipRow}>
                {activeStep.chips.map((chip, idx) => (
                  <MotiView
                    key={`${activeStep.id}-${chip}`}
                    from={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 300 + idx * 100 }}
                    style={styles.tourChip}
                  >
                    <Text style={styles.tourChipText}>{chip}</Text>
                  </MotiView>
                ))}
              </View>

              <View style={styles.tourDemoPreview}>
                <LinearGradient
                  colors={["rgba(255,255,255,0.5)", "rgba(224,242,254,0.3)"]}
                  style={styles.tourDemoGradient}
                >
                  <Info size={14} color="#0369A1" />
                  <Text style={styles.tourDemoHint}>{activeStep.demoHint}</Text>
                </LinearGradient>
              </View>
            </BlurView>
          </MotiView>
        </AnimatePresence>

        <View style={[styles.tourFooter, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.tourMainActions}>
            {!isFirstStep && (
              <Pressable onPress={onBack} style={styles.tourBackButton}>
                <Text style={styles.tourBackButtonText}>Back</Text>
              </Pressable>
            )}
            
            <Pressable 
              onPress={onNext} 
              disabled={isSaving} 
              style={[styles.tourNextButton, isFirstStep && { flex: 1 }]}
            >
              <LinearGradient
                colors={["#0284C7", "#0369A1"]}
                style={styles.tourNextButtonGradient}
              >
                <Text style={styles.tourNextButtonText}>
                  {isSaving ? "Saving..." : isLastStep ? "Get Started" : "Next"}
                </Text>
                {!isLastStep && <ChevronRight color="#FFF" size={18} />}
              </LinearGradient>
            </Pressable>
          </View>

          <Pressable onPress={onClose} style={styles.tourSkipButton}>
            <Text style={styles.tourSkipButtonText}>Skip tour</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function AuthenticatedTabLayout({ shouldShowTutorial, completeTutorial }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const globalParams = useGlobalSearchParams();
  const { location } = useLocation();
  const { data: user } = useUser();
  const { session } = useAuthStore();
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [isSavingTour, setIsSavingTour] = useState(false);
  const lastNearbyAlertCheckRef = useRef(null);
  const lastNearbyAlertLocationRef = useRef(null);
  const alertedAlertIdsRef = useRef(new Set());
  const { reports: nearbySpots } = useNearbyReports(location, ALERT_RADIUS_METERS);
  const nearbyZones = useParkingZones(location, ALERT_RADIUS_METERS, {
    includeGeometry: false,
    refetchIntervalMs: false,
    refetchOnMount: false,
    staleTimeMs: Infinity,
  });
  const detectedZonePins = useMemo(
    () =>
      getDetectedZonePins({
        apiZones: nearbyZones,
        location,
        radiusMeters: ALERT_RADIUS_METERS,
      }),
    [location, nearbyZones],
  );
  const normalizedReportAlerts = useMemo(
    () =>
      nearbySpots.map((spot) => ({
        ...spot,
        id: `report-${spot.id}`,
        alertType: "report",
      })),
    [nearbySpots],
  );
  const normalizedZoneAlerts = useMemo(() => {
    const apiZoneAlerts = detectedZonePins.apiZones
      .map((zone) => normalizeApiZoneAlert(zone, location))
      .filter(Boolean)
      .map((zone) => ({
        ...zone,
        id: `api-zone-${zone.zoneId}`,
      }));
    const councilZoneAlerts = detectedZonePins.councilZones
      .map((zone) =>
        normalizeCouncilZoneAlert(zone, location, ALERT_RADIUS_METERS),
      )
      .filter(Boolean);

    return [...apiZoneAlerts, ...councilZoneAlerts];
  }, [detectedZonePins.councilZones, detectedZonePins.apiZones, location]);
  const alertsBadgeCount =
    normalizedReportAlerts.length + normalizedZoneAlerts.length;
  const {
    unreadCount: unreadActivityCount,
    allNotifications: activityNotifications = [],
  } = useUnreadActivityCount(
    100,
    Boolean(session?.access_token),
  );
  const systemUpdateItems = useMemo(
    () => deriveSystemUpdateItems(activityNotifications),
    [activityNotifications],
  );

  const getTabBadge = (count) => {
    if (!count || count <= 0) {
      return undefined;
    }

    return count > 99 ? "99+" : count;
  };

  const replayParam = Array.isArray(globalParams.tour)
    ? globalParams.tour[0]
    : globalParams.tour;
  const isReplayTour = replayParam === "1" || replayParam === "true";
  const isTourActive = shouldShowTutorial || isReplayTour;
  const activeTourStep = IN_APP_TOUR_STEPS[tourStepIndex] || IN_APP_TOUR_STEPS[0];
  const isFirstTourStep = tourStepIndex === 0;
  const isLastTourStep = tourStepIndex === IN_APP_TOUR_STEPS.length - 1;

  useEffect(() => {
    if (!isTourActive) {
      setTourStepIndex(0);
      return;
    }

    const params = isReplayTour ? { tour: "1" } : undefined;
    router.replace(
      params
        ? {
            pathname: activeTourStep.route,
            params,
          }
        : activeTourStep.route,
    );
  }, [activeTourStep.route, isReplayTour, isTourActive, router]);

  const finishTour = async () => {
    if (isSavingTour) {
      return;
    }

    setIsSavingTour(true);

    try {
      if (shouldShowTutorial) {
        await completeTutorial();
        router.replace("/");
        return;
      }

      router.replace("/profile");
    } finally {
      setIsSavingTour(false);
    }
  };

  const handleNextTourStep = async () => {
    if (isLastTourStep) {
      await finishTour();
      return;
    }

    setTourStepIndex((currentStep) =>
      Math.min(IN_APP_TOUR_STEPS.length - 1, currentStep + 1),
    );
  };

  const handleBackTourStep = () => {
    setTourStepIndex((currentStep) => Math.max(0, currentStep - 1));
  };

  useEffect(() => {
    configureNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: !(isExpoGo && Platform.OS === "ios"),
        shouldShowList: !(isExpoGo && Platform.OS === "ios"),
        shouldPlaySound: !(isExpoGo && Platform.OS === "ios"),
        shouldSetBadge: !(isExpoGo && Platform.OS === "ios"),
      }),
    })
      .then(() => {
        addSentryBreadcrumb({
          category: "notifications.config",
          message: "Tab layout notification handler is active",
          data: {
            screen: "tabs_layout",
          },
        });
      })
      .catch((error) => {
        captureError(error, {
          handled: true,
          level: "error",
          tags: {
            notifications_stage: "tabs_layout_handler_setup",
          },
        });
      });
  }, []);

  useNotifications((response) => {
    try {
      const data = response?.notification?.request?.content?.data || {};
      const alertEventId =
        response?.notification?.request?.identifier || String(Date.now());

      addSentryBreadcrumb({
        category: "notifications.navigation",
        message: "Handling notification response in tabs layout",
        data: normalizeForSentry({
          alertEventId,
          actionIdentifier: response?.actionIdentifier,
          data,
          reportId: data.reportId || null,
          zoneId: data.zoneId || null,
        }),
      });

      if (
        data.screen === "activity" ||
        data.type === "report_claimed" ||
        data.type === "false_reported" ||
        data.type === "expired"
      ) {
        router.navigate("/activity");
        return;
      }

      if (
        data.zoneId &&
        isFiniteCoordinate(data.zoneLat) &&
        isFiniteCoordinate(data.zoneLng)
      ) {
        router.navigate({
          pathname: "/",
          params: {
            zoneId: data.zoneId,
            zoneName: data.zoneName || "Parking Zone",
            zoneType: data.zoneType || "Parking",
            zoneLat: data.zoneLat,
            zoneLng: data.zoneLng,
            zoneCapacity: data.zoneCapacity || "",
            zoneRules: data.zoneRules || "",
            spotId: "",
            spotLat: "",
            spotLng: "",
            spotName: "",
            spotType: "",
            alertEventId,
          },
        });
        return;
      }

      if (
        data.reportId &&
        isFiniteCoordinate(data.latitude) &&
        isFiniteCoordinate(data.longitude)
      ) {
        router.navigate({
          pathname: "/",
          params: {
            spotId: data.reportId,
            spotLat: data.latitude,
            spotLng: data.longitude,
            spotName: data.zone_name || "Parking Spot",
            spotType: data.zone_type || data.parking_type,
            zoneId: "",
            zoneName: "",
            zoneType: "",
            zoneLat: "",
            zoneLng: "",
            zoneRules: "",
            alertEventId,
          },
        });
      }
    } catch (error) {
      captureError(error, {
        handled: true,
        level: "error",
        tags: {
          notifications_stage: "tabs_layout_response_navigation",
        },
        extras: {
          response: normalizeForSentry({
            actionIdentifier: response?.actionIdentifier,
            identifier: response?.notification?.request?.identifier,
            data: response?.notification?.request?.content?.data,
          }),
        },
      });
      throw error;
    }
  });

  useEffect(() => {
    let isActive = true;

    if (!user?.id || systemUpdateItems.length === 0) {
      return () => {
        isActive = false;
      };
    }

    (async () => {
      const state = await hydrateSystemUpdateNotificationState(user.id);
      if (!isActive) {
        return;
      }

      if (!state.initialized) {
        await primeSystemUpdatesNotified(user.id, systemUpdateItems);
        return;
      }

      const unseenItems = systemUpdateItems.filter(
        (item) => item?.id && !state.notifiedIds.has(String(item.id)),
      );

      if (unseenItems.length === 0) {
        return;
      }

      const sortedUnseenItems = [...unseenItems].sort((a, b) => {
        const aTime = new Date(a?.sent_at || a?.occurred_at || 0).getTime();
        const bTime = new Date(b?.sent_at || b?.occurred_at || 0).getTime();
        return aTime - bTime;
      });

      for (const item of sortedUnseenItems) {
        const payload = buildSystemUpdateNotificationPayload(item);
        const data = buildSystemUpdateNotificationData(item);

        if (notificationsUnsupportedInCurrentRuntime) {
          Alert.alert(payload.title, payload.body);
          continue;
        }

        if (item?.mailbox_type === "claimed") {
          continue;
        }

        await scheduleLocalAlertNotification({
          title: payload.title,
          body: payload.body,
          data,
        }).catch(() => {});
      }

      await markSystemUpdatesNotified(user.id, sortedUnseenItems);
    })().catch((error) => {
      captureError(error, {
        handled: true,
        level: "error",
        tags: {
          notifications_stage: "system_update_local_delivery",
        },
      });
    });

    return () => {
      isActive = false;
    };
  }, [systemUpdateItems, user?.id]);

  useEffect(() => {
    if (isExpoGo) {
      addSentryBreadcrumb({
        category: "notifications.alert",
        level: "warning",
        message: "Skipping local nearby alert scheduling in Expo Go",
        data: {
          platform: Platform.OS,
        },
      });
      return;
    }

    if (!location) {
      lastNearbyAlertCheckRef.current = null;
      lastNearbyAlertLocationRef.current = null;
      alertedAlertIdsRef.current = new Set();
      return;
    }

    const currentLocation = {
      latitude: location.latitude,
      longitude: location.longitude,
    };
    const previousLocation = lastNearbyAlertLocationRef.current;
    const movedFar =
      previousLocation &&
      getDistanceMeters(previousLocation, currentLocation) > ALERT_RADIUS_METERS;

    lastNearbyAlertLocationRef.current = currentLocation;

    if (lastNearbyAlertCheckRef.current === null || movedFar) {
      lastNearbyAlertCheckRef.current = new Date();
      alertedAlertIdsRef.current = new Set(
        [...normalizedReportAlerts, ...normalizedZoneAlerts].map((alert) =>
          String(alert.id),
        ),
      );
      return;
    }

    const previousCheck = lastNearbyAlertCheckRef.current;
    lastNearbyAlertCheckRef.current = new Date();

    const newNearbyAlerts = [
      ...normalizedZoneAlerts.filter(
        (alert) => !alertedAlertIdsRef.current.has(String(alert.id)),
      ),
      ...normalizedReportAlerts.filter((alert) => {
        const createdAt = alert?.created_at ? new Date(alert.created_at) : null;

        if (alertedAlertIdsRef.current.has(String(alert.id))) return false;
        if (
          alert?.user_id &&
          user?.id &&
          String(alert.user_id) === String(user.id)
        ) {
          return false;
        }
        if (!createdAt || Number.isNaN(createdAt.getTime())) return false;

        return createdAt > previousCheck;
      }),
    ];

    [...normalizedReportAlerts, ...normalizedZoneAlerts].forEach((alert) => {
      alertedAlertIdsRef.current.add(String(alert.id));
    });

    if (newNearbyAlerts.length === 0) {
      return;
    }

    const latestReportAlert = [...newNearbyAlerts]
      .filter((alert) => alert?.alertType === "report")
      .sort((a, b) => {
        const aTime = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b?.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      })[0];

    const latestAlert = latestReportAlert || [...newNearbyAlerts].sort((a, b) => {
      const aTime = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    })[0];

    const payload = buildAlertNotificationPayload(
      latestAlert,
      newNearbyAlerts.length,
    );
    const notificationData = buildNotificationData(latestAlert);

    if (!notificationData) {
      addSentryBreadcrumb({
        category: "notifications.alert",
        level: "warning",
        message: "Skipping nearby alert notification because payload data could not be built",
        data: normalizeForSentry({
          latestAlert,
          newNearbyAlertsCount: newNearbyAlerts.length,
        }),
      });
      return;
    }

    addSentryBreadcrumb({
      category: "notifications.alert",
      message: "Detected new nearby parking alert to schedule",
      data: normalizeForSentry({
        latestAlert,
        newNearbyAlertsCount: newNearbyAlerts.length,
        notificationData,
      }),
    });

    (async () => {
      try {
        await scheduleLocalAlertNotification({
          ...payload,
          data: notificationData,
        });
      } catch (error) {
        captureError(error, {
          handled: true,
          level: "error",
          tags: {
            notifications_stage: "tabs_layout_schedule_local_alert",
          },
          extras: {
            latestAlert: normalizeForSentry(latestAlert),
            notificationData: normalizeForSentry(notificationData),
            payload: normalizeForSentry(payload),
          },
        });
      }
    })();
  }, [location, normalizedReportAlerts, normalizedZoneAlerts, user?.id]);

  return (
    <View style={styles.screen}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: BRAND_PALETTE.surface,
            borderTopWidth: 1,
            borderColor: BRAND_PALETTE.border,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 10),
            height: 64 + insets.bottom,
          },
          tabBarActiveTintColor: BRAND_PALETTE.accentBold,
          tabBarInactiveTintColor: BRAND_PALETTE.muted,
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: "600",
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Map",
            tabBarIcon: ({ color }) => <MapPin color={color} size={24} />,
          }}
        />
        <Tabs.Screen
          name="spots"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: "Alerts",
            tabBarIcon: ({ color }) => <Bell color={color} size={24} />,
            tabBarBadge: getTabBadge(alertsBadgeCount),
            tabBarBadgeStyle: {
              backgroundColor: BRAND_PALETTE.error || "#D64545",
              color: "#FFF",
              fontSize: 11,
              fontWeight: "700",
            },
          }}
        />
        <Tabs.Screen
          name="notifications-feed"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="timer"
          options={{
            title: "Timer",
            tabBarIcon: ({ color }) => <Clock color={color} size={24} />,
          }}
        />
        <Tabs.Screen
          name="activity"
          options={{
            title: "Activity",
            tabBarIcon: ({ color }) => <History color={color} size={24} />,
            tabBarBadge: getTabBadge(unreadActivityCount),
            tabBarBadgeStyle: {
              backgroundColor: BRAND_PALETTE.error || "#D64545",
              color: "#FFF",
              fontSize: 11,
              fontWeight: "700",
            },
          }}
        />
        <Tabs.Screen
          name="leaderboard"
          options={{
            title: "Leaders",
            tabBarIcon: ({ color }) => <Trophy color={color} size={24} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color }) => <User color={color} size={24} />,
          }}
        />
      </Tabs>

      {isTourActive ? (
        <TourOverlay
          activeStep={activeTourStep}
          activeStepIndex={tourStepIndex}
          isFirstStep={isFirstTourStep}
          isLastStep={isLastTourStep}
          isSaving={isSavingTour}
          onBack={handleBackTourStep}
          onNext={handleNextTourStep}
          onClose={finishTour}
        />
      ) : null}
    </View>
  );
}

export default function TabLayout() {
  const { session, isReady, user } = useAuthStore();
  const userId = user?.id || session?.user?.id || null;
  const {
    isLoading: isLoadingTutorialStatus,
    shouldShowTutorial,
    completeTutorial,
  } =
    useFirstLoginTutorial(userId);

  if (!isReady) {
    return null;
  }

  if (!session) {
    return <Redirect href="/accounts/login" />;
  }

  if (userId && isLoadingTutorialStatus) {
    return null;
  }

  return (
    <AuthenticatedTabLayout
      completeTutorial={completeTutorial}
      shouldShowTutorial={shouldShowTutorial}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  tourOverlayWrap: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  tourBranding: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  tourBrandingPark: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  tourBrandingMate: {
    color: "#FEF08A",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  tourCardContainer: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  tourCard: {
    borderRadius: 32,
    padding: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  tourProgressBarBg: {
    height: 6,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 3,
    marginBottom: 24,
    overflow: "hidden",
  },
  tourProgressBarFill: {
    height: "100%",
    backgroundColor: "#0284C7",
    borderRadius: 3,
  },
  tourCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  tourIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0284C7",
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  tourStepIndicator: {
    backgroundColor: "rgba(2, 132, 199, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tourStepIndicatorText: {
    color: "#0369A1",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  tourTitle: {
    color: "#0F172A",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 30,
    marginBottom: 12,
  },
  tourBody: {
    color: "#475569",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  tourChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 24,
  },
  tourChip: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  tourChipText: {
    color: "#1E293B",
    fontSize: 12,
    fontWeight: "700",
  },
  tourDemoPreview: {
    borderRadius: 20,
    overflow: "hidden",
  },
  tourDemoGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 10,
  },
  tourDemoHint: {
    color: "#0369A1",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  tourFooter: {
    width: "100%",
    gap: 16,
  },
  tourMainActions: {
    flexDirection: "row",
    gap: 12,
  },
  tourBackButton: {
    flex: 1,
    height: 56,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  tourBackButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  tourNextButton: {
    flex: 2,
    height: 56,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  tourNextButtonGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  tourNextButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  tourSkipButton: {
    alignSelf: "center",
    paddingVertical: 8,
  },
  tourSkipButtonText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 14,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
