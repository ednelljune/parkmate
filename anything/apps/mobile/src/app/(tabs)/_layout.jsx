import { useEffect, useMemo, useRef } from "react";
import { Redirect, Tabs, useRouter } from "expo-router";
import { Bell, Clock, History, MapPin, Trophy, User } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Alert, Platform } from "react-native";

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

export const unstable_settings = {
  initialRouteName: "index",
};

const ALERT_RADIUS_METERS = PARKING_ALERT_RADIUS_METERS;
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

function AuthenticatedTabLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { location } = useLocation();
  const { data: user } = useUser();
  const { session } = useAuthStore();
  const lastNearbyAlertCheckRef = useRef(null);
  const lastNearbyAlertLocationRef = useRef(null);
  const alertedAlertIdsRef = useRef(new Set());
  const { reports: nearbySpots } = useNearbyReports(location, ALERT_RADIUS_METERS);
  const nearbyZones = useParkingZones(location, ALERT_RADIUS_METERS);
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
  );
}

export default function TabLayout() {
  const { session, isReady } = useAuthStore();

  if (!isReady) {
    return null;
  }

  if (!session) {
    return <Redirect href="/accounts/login" />;
  }

  return <AuthenticatedTabLayout />;
}
