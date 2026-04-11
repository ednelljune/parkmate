import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  Bell,
  CircleDot,
  Layers,
  MapPin,
  Navigation,
  Radar,
  Sparkles,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLocation } from "@/hooks/useLocation";
import {
  useNearbyReports,
  useNearbyReportsBackendVersion,
  useParkingZones,
} from "@/hooks/useParkingData";
import { formatDistance, formatTimeAgo } from "@/utils/formatters";
import { getDetectedZonePins } from "@/utils/parkingZonePins";
import {
  normalizeApiZoneAlert,
  normalizeCouncilZoneAlert,
} from "@/utils/zoneAlerts";
import {
  PARKING_ALERT_RADIUS_LABEL,
  PARKING_ALERT_RADIUS_METERS,
} from "@/constants/detectionRadius";
import { BRAND_PALETTE } from "@/theme/brandColors";

const ALERT_RADIUS_METERS = PARKING_ALERT_RADIUS_METERS;
const ALERT_TABS = [
  { id: "all", label: "All" },
  { id: "reports", label: "Reports" },
  { id: "zones", label: "Zones" },
];

const TYPE_COLORS = {
  "1P": {
    bg: "rgba(59, 130, 246, 0.16)",
    border: BRAND_PALETTE.accentBold,
    text: BRAND_PALETTE.navy,
  },
  "2P": {
    bg: "rgba(5, 150, 105, 0.16)",
    border: BRAND_PALETTE.success,
    text: BRAND_PALETTE.deepNavy,
  },
  "3P": {
    bg: "rgba(245, 158, 11, 0.18)",
    border: BRAND_PALETTE.gold,
    text: BRAND_PALETTE.navy,
  },
  "Full Hour": {
    bg: "rgba(59, 130, 246, 0.12)",
    border: BRAND_PALETTE.accent,
    text: BRAND_PALETTE.navy,
  },
};

const FALLBACK_TYPE_COLORS = {
  bg: BRAND_PALETTE.border,
  border: BRAND_PALETTE.border,
  text: BRAND_PALETTE.muted,
};

const TAB_COLORS = {
  all: {
    bg: "rgba(59, 130, 246, 0.16)",
    border: BRAND_PALETTE.accentBold,
    text: BRAND_PALETTE.navy,
  },
  reports: {
    bg: "rgba(5, 150, 105, 0.16)",
    border: BRAND_PALETTE.success,
    text: BRAND_PALETTE.navy,
  },
  zones: {
    bg: "rgba(245, 158, 11, 0.16)",
    border: BRAND_PALETTE.gold,
    text: BRAND_PALETTE.navy,
  },
};

const TAB_COPY = {
  all: {
    eyebrow: "Signal board",
    title: "Nearby parking pulse",
    description:
      "Track live parking reports and zone rules orbiting within your current detection radius.",
    feedTitle: "Mixed radar feed",
  },
  reports: {
    eyebrow: "Live reports",
    title: "Fresh spot pings",
    description:
      "Focus on fast-moving parking signals reported by drivers near your current location.",
    feedTitle: "Report radar",
  },
  zones: {
    eyebrow: "Zone watch",
    title: "Rules in orbit",
    description:
      "Scan nearby parking zone snapshots before you commit to a street or block.",
    feedTitle: "Zone radar",
  },
};

const getAlertColors = (type) => TYPE_COLORS[type] || FALLBACK_TYPE_COLORS;
const getAlertKindTheme = (alertType) =>
  alertType === "zone"
    ? {
        eyebrow: "ZONE SNAPSHOT",
        accent: BRAND_PALETTE.gold,
        soft: "rgba(245, 158, 11, 0.12)",
        panel: "rgba(245, 158, 11, 0.08)",
        button: BRAND_PALETTE.navy,
        buttonText: "Open Zone on Map",
      }
    : {
        eyebrow: "LIVE REPORT",
        accent: BRAND_PALETTE.success,
        soft: "rgba(16, 185, 129, 0.12)",
        panel: "rgba(16, 185, 129, 0.08)",
        button: BRAND_PALETTE.success,
        buttonText: "Open Spot on Map",
      };

const formatTimeRemaining = (diffMs) => {
  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    return "0s left";
  }

  const totalSeconds = Math.ceil(diffMs / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s left`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) {
    return `${minutes}m left`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours}h left`;
  }

  return `${hours}h ${remainingMinutes}m left`;
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const router = useRouter();
  const { location, errorMsg, status } = useLocation();
  const [selectedTab, setSelectedTab] = useState("all");
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const isCompactAndroid = Platform.OS === "android" && windowWidth <= 420;
  const reportsVersionEnabled = Boolean(location);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 1000);

    return () => clearInterval(intervalId);
  }, []);

  const {
    reports,
    refetch,
    isRefetching,
  } = useNearbyReports(location, ALERT_RADIUS_METERS, {
    refetchIntervalMs: false,
    refetchOnMount: false,
    staleTimeMs: Infinity,
  });
  useNearbyReportsBackendVersion(
    location,
    ALERT_RADIUS_METERS,
    reportsVersionEnabled,
  );
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

  const reportAlerts = useMemo(
    () =>
      reports
        .filter((report) => {
          const expiresAtMs = Date.parse(report?.expires_at ?? "");
          return !Number.isFinite(expiresAtMs) || expiresAtMs > currentTimeMs;
        })
        .map((report) => ({
          ...report,
          alertType: "report",
        })),
    [reports, currentTimeMs],
  );

  const zoneAlerts = useMemo(() => {
    const apiZoneAlerts = detectedZonePins.apiZones
      .map((zone) => normalizeApiZoneAlert(zone, location))
      .filter(Boolean);
    const councilZoneAlerts = detectedZonePins.councilZones
      .map((zone) =>
        normalizeCouncilZoneAlert(zone, location, ALERT_RADIUS_METERS),
      )
      .filter(Boolean);
    return [...apiZoneAlerts, ...councilZoneAlerts].sort(
      (a, b) => (a.distance_meters || 0) - (b.distance_meters || 0),
    );
  }, [detectedZonePins.apiZones, detectedZonePins.councilZones, location]);

  const alerts = useMemo(
    () =>
      [...reportAlerts, ...zoneAlerts].sort(
        (a, b) => (a.distance_meters || 0) - (b.distance_meters || 0),
      ),
    [reportAlerts, zoneAlerts],
  );

  const alertCounts = useMemo(
    () => ({
      all: alerts.length,
      reports: reportAlerts.length,
      zones: zoneAlerts.length,
    }),
    [alerts.length, reportAlerts.length, zoneAlerts.length],
  );

  const currentAlerts = useMemo(() => {
    if (selectedTab === "reports") {
      return reportAlerts;
    }

    if (selectedTab === "zones") {
      return zoneAlerts;
    }

    return alerts;
  }, [alerts, reportAlerts, selectedTab, zoneAlerts]);

  const selectedTabMeta = TAB_COPY[selectedTab];
  const spotlightAlert = currentAlerts[0] || alerts[0] || null;
  const spotlightDistance = spotlightAlert
    ? formatDistance(spotlightAlert.distance_meters || 0)
    : "Scanning";
  const spotlightTitle = spotlightAlert
    ? spotlightAlert.zone_name ||
      (spotlightAlert.alertType === "zone"
        ? `${spotlightAlert.zone_type || "Parking"} zone`
        : `${spotlightAlert.parking_type || spotlightAlert.zone_type || "Parking"} availability`)
    : "Scanning your surrounding streets";
  const spotlightText = !spotlightAlert
    ? "No nearby signals yet. Pull to refresh or move into a busier area to wake the radar."
    : spotlightAlert.alertType === "zone"
      ? spotlightAlert.rules_description ||
        `${spotlightAlert.zone_type || "Parking"} rules are active ${spotlightDistance} from your position.`
      : spotlightAlert.quantity && spotlightAlert.quantity > 1
        ? `${spotlightAlert.quantity} reported spots are clustered ${spotlightDistance} away.`
        : `${spotlightAlert.parking_type || spotlightAlert.zone_type || "Parking"} was reported nearby and sits ${spotlightDistance} from your current position.`;
  const spotlightKind =
    spotlightAlert?.alertType === "zone" ? "Zone snapshot" : "Live report";
  const heroStats = [
    { label: "Signals", value: alertCounts.all },
    { label: "Reports", value: alertCounts.reports },
    { label: "Zones", value: alertCounts.zones },
  ];

  const openBuiltInNavigation = ({
    latitude,
    longitude,
    label,
    type = "Parking",
    extras = {},
  }) => {
    if (latitude == null || longitude == null) {
      Alert.alert("Navigation Error", "Location data is missing.");
      return;
    }

    const navigationRequestId = String(Date.now());

    router.navigate({
      pathname: "/",
      params: {
        navigate: "true",
        navigationRequestId,
        spotId: "",
        spotLat: "",
        spotLng: "",
        spotName: "",
        spotType: "",
        zoneId: "",
        zoneName: "",
        zoneType: "",
        zoneLat: "",
        zoneLng: "",
        zoneCapacity: "",
        zoneRules: "",
        ...extras,
        destinationLat: String(Number(latitude)),
        destinationLng: String(Number(longitude)),
        destinationLabel: label || "Parking",
        destinationType: type || "Parking",
      },
    });
  };

  const handleOpenSpotOnMap = (spot) => {
    if (spot?.latitude == null || spot?.longitude == null) {
      Alert.alert("Map Error", "Location data is missing.");
      return;
    }

    router.navigate({
      pathname: "/",
      params: {
        navigate: "false",
        navigationRequestId: String(Date.now()),
        spotId: String(spot.id ?? ""),
        spotLat: String(Number(spot.latitude)),
        spotLng: String(Number(spot.longitude)),
        spotName: spot.zone_name || "Parking Spot",
        spotType: spot.parking_type || spot.zone_type || "Parking",
        zoneId: "",
        zoneName: "",
        zoneType: "",
        zoneLat: "",
        zoneLng: "",
        zoneCapacity: "",
        zoneRules: "",
      },
    });
  };

  const handleNavigateToZone = (zone) => {
    openBuiltInNavigation({
      latitude: zone.center_lat,
      longitude: zone.center_lng,
      label: zone.zone_name || "Parking Zone",
      type: zone.zone_type || "Parking",
      extras: {
        zoneId: String(zone.zoneId || zone.id || ""),
        zoneName: zone.zone_name || "Parking Zone",
        zoneType: zone.zone_type || "Parking",
        zoneLat: String(Number(zone.center_lat)),
        zoneLng: String(Number(zone.center_lng)),
        zoneCapacity:
          zone.capacity_spaces == null ? "" : String(zone.capacity_spaces),
        zoneRules: zone.rules_description || "",
      },
    });
  };

  if (status === "loading" && !location) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={BRAND_PALETTE.accentBold} />
        <Text style={styles.loadingText}>Finding your location...</Text>
      </View>
    );
  }

  if (!location) {
    const isDenied = status === "denied";

    return (
      <View style={styles.unavailableScreen}>
        <Bell size={56} color={BRAND_PALETTE.muted} />
        <Text style={styles.unavailableTitle}>
          {isDenied ? "Location access is off" : "Location unavailable"}
        </Text>
        <Text style={styles.unavailableText}>
          {errorMsg ||
            (isDenied
              ? "Allow location permission to see nearby parking alerts."
              : "We could not determine your location yet. Try reopening the tab in a stronger signal area.")}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.backgroundOrbOne} />
      <View style={styles.backgroundOrbTwo} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 14,
            paddingBottom: insets.bottom + 84,
          },
        ]}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        <LinearGradient
          colors={["#081A2B", "#0B3556", "#0284C7"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroOrbLarge} />
          <View style={styles.heroOrbSmall} />

          <View style={styles.heroEyebrow}>
            <Radar size={14} color="#D7F0FF" />
            <Text style={styles.heroEyebrowText}>{selectedTabMeta.eyebrow}</Text>
          </View>

          <Text style={styles.heroTitle}>{selectedTabMeta.title}</Text>
          <Text style={styles.heroDescription}>{selectedTabMeta.description}</Text>

          <View style={styles.heroStatsRow}>
            {heroStats.map((item) => (
              <View key={item.label} style={styles.heroStatCard}>
                <Text style={styles.heroStatValue}>{item.value}</Text>
                <Text style={styles.heroStatLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.spotlightCard}>
            <View style={styles.spotlightHeader}>
              <View style={styles.spotlightBadge}>
                <Sparkles size={12} color={BRAND_PALETTE.accentBold} />
                <Text style={styles.spotlightBadgeText}>Closest signal</Text>
              </View>
              <View style={styles.spotlightDistancePill}>
                <MapPin size={12} color={BRAND_PALETTE.deepNavy} />
                <Text style={styles.spotlightDistanceText}>{spotlightDistance}</Text>
              </View>
            </View>

            <Text style={styles.spotlightTitle}>{spotlightTitle}</Text>
            <Text style={styles.spotlightText}>{spotlightText}</Text>

            <View style={styles.spotlightMetaRow}>
              <View style={styles.spotlightMetaChip}>
                {spotlightAlert?.alertType === "zone" ? (
                  <Layers size={13} color={BRAND_PALETTE.gold} />
                ) : (
                  <Bell size={13} color={BRAND_PALETTE.success} />
                )}
                <Text style={styles.spotlightMetaText}>{spotlightKind}</Text>
              </View>
              <View style={styles.spotlightMetaChip}>
                <Navigation size={13} color={BRAND_PALETTE.accentBold} />
                <Text style={styles.spotlightMetaText}>
                  {PARKING_ALERT_RADIUS_LABEL} radius
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.filterPanel}>
          <View style={styles.filterPanelHeader}>
            <View>
              <Text style={styles.filterEyebrow}>Tune the radar</Text>
              <Text style={styles.filterTitle}>Shape the feed you want to watch</Text>
            </View>
            <View style={styles.radiusPill}>
              <Navigation size={12} color={BRAND_PALETTE.accentBold} />
              <Text style={styles.radiusPillText}>{PARKING_ALERT_RADIUS_LABEL}</Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabRail}
          >
            {ALERT_TABS.map((tab) => {
              const count = alertCounts[tab.id] || 0;
              const colors = TAB_COLORS[tab.id];
              const isSelected = selectedTab === tab.id;

              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setSelectedTab(tab.id)}
                  style={[
                    styles.tabButton,
                    {
                      backgroundColor: isSelected ? colors.bg : "#F7FBFF",
                      borderColor: isSelected ? colors.border : "#D9E6F2",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabLabel,
                      {
                        color: isSelected ? colors.text : BRAND_PALETTE.muted,
                      },
                    ]}
                  >
                    {tab.label}
                  </Text>
                  <View
                    style={[
                      styles.tabCountWrap,
                      {
                        backgroundColor: isSelected
                          ? colors.border
                          : BRAND_PALETTE.border,
                      },
                    ]}
                  >
                    <Text style={styles.tabCount}>{count}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.feedPanel}>
          <View style={styles.feedHeader}>
            <View>
              <Text style={styles.feedEyebrow}>Signal stream</Text>
              <Text style={styles.feedTitle}>{selectedTabMeta.feedTitle}</Text>
            </View>
            <View style={styles.feedCountBadge}>
              <Text style={styles.feedCountValue}>{currentAlerts.length}</Text>
              <Text style={styles.feedCountLabel}>active</Text>
            </View>
          </View>

          {currentAlerts.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Layers size={30} color={BRAND_PALETTE.muted} />
            </View>
            <Text style={styles.emptyTitle}>
              No {selectedTab === "all"
                ? "Nearby"
                : selectedTab === "reports"
                  ? "Report"
                  : "Zone"} Alerts
            </Text>
            <Text style={styles.emptyText}>
              {selectedTab === "zones"
                ? "No parking zones are currently detected inside your alert radius."
                : selectedTab === "reports"
                  ? "No reported parking spots are currently detected inside your alert radius."
                  : "No parking reports or parking zones are currently detected inside your alert radius."}
            </Text>
          </View>
        ) : (
          <View style={styles.feedList}>
            {currentAlerts.map((alert, index) => {
              const isZoneAlert = alert.alertType === "zone";
              const isCompactZoneCard = isZoneAlert && isCompactAndroid;
              const colors = getAlertColors(
                alert.zone_type || alert.parking_type || "1P",
              );
              const kindTheme = getAlertKindTheme(alert.alertType);
              const createdDate = alert.created_at ? new Date(alert.created_at) : null;
              const expiresDate = alert.expires_at ? new Date(alert.expires_at) : null;
              const timeRemainingMs = expiresDate
                ? Math.max(0, expiresDate.getTime() - currentTimeMs)
                : null;
              const statItems = isZoneAlert
                ? [
                    {
                      label: "Type",
                      value: alert.zone_type || "Parking",
                    },
                    {
                      label: "Distance",
                      value: formatDistance(alert.distance_meters || 0),
                    },
                    ...(alert.capacity_spaces
                      ? [
                          {
                            label: "Capacity",
                            value: `${alert.capacity_spaces} spaces`,
                          },
                        ]
                      : []),
                  ]
                : [
                    {
                      label: "Reported",
                      value: createdDate ? formatTimeAgo(createdDate) : "Just now",
                    },
                    {
                      label: "Expiry",
                      value:
                        timeRemainingMs !== null
                          ? formatTimeRemaining(timeRemainingMs)
                          : "No timer",
                    },
                    ...(alert.quantity && alert.quantity > 1
                      ? [
                          {
                            label: "Count",
                            value: `${alert.quantity} spots`,
                          },
                        ]
                      : []),
                  ];
              const summaryText = isZoneAlert
                ? `${alert.zone_type || "Parking"} regulation area now within range`
                : alert.quantity && alert.quantity > 1
                  ? `${alert.quantity} ${alert.parking_type || alert.zone_type || "parking"} spots reported nearby`
                  : `${alert.parking_type || alert.zone_type || "Parking"} spot reported nearby`;
              const detailText = isZoneAlert
                ? alert.rules_description ||
                  `Watch local signage for ${alert.zone_type || "parking"} conditions in this zone.`
                : createdDate
                  ? `Fresh signal logged ${formatTimeAgo(createdDate)}.`
                  : "Fresh signal logged recently.";

              return (
                <View
                  key={alert.id}
                  style={[
                    styles.feedItem,
                    isCompactZoneCard && styles.compactFeedItem,
                  ]}
                >
                  <View
                    style={[
                      styles.feedRail,
                      isCompactZoneCard && styles.compactFeedRail,
                    ]}
                  >
                    <View
                      style={[
                        styles.feedDot,
                        isCompactZoneCard && styles.compactFeedDot,
                        {
                          backgroundColor: isZoneAlert
                            ? BRAND_PALETTE.gold
                            : BRAND_PALETTE.success,
                        },
                      ]}
                    >
                      <CircleDot size={11} color="#FFF" />
                    </View>
                    {index < currentAlerts.length - 1 ? (
                      <View style={styles.feedLine} />
                    ) : null}
                  </View>

                  <View style={styles.feedCardColumn}>
                    <View style={styles.feedItemHeader}>
                      <Text
                        style={[
                          styles.feedItemLabel,
                          isCompactZoneCard && styles.compactFeedItemLabel,
                        ]}
                      >
                        {isZoneAlert ? "Zone snapshot" : "Live report"}
                      </Text>
                      <Text
                        style={[
                          styles.feedItemDistance,
                          isCompactZoneCard && styles.compactFeedItemDistance,
                        ]}
                      >
                        {formatDistance(alert.distance_meters || 0)}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.alertCard,
                        isZoneAlert ? styles.zoneAlertCard : styles.reportAlertCard,
                        isCompactZoneCard && styles.compactZoneAlertCard,
                        {
                          borderColor: kindTheme.accent,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.cardGlow,
                          {
                            backgroundColor: kindTheme.soft,
                          },
                        ]}
                      />

                      <View style={styles.alertCardHeader}>
                        <View
                          style={[
                            styles.headerLead,
                            isCompactZoneCard && styles.compactHeaderLead,
                          ]}
                        >
                          <View
                            style={[
                              styles.eyebrowBadge,
                              isCompactZoneCard && styles.compactEyebrowBadge,
                              {
                                backgroundColor: kindTheme.soft,
                                borderColor: kindTheme.accent,
                              },
                            ]}
                          >
                            {isZoneAlert ? (
                              <Layers size={12} color={kindTheme.accent} />
                            ) : (
                              <Bell size={12} color={kindTheme.accent} />
                            )}
                            <Text
                              style={[
                                styles.eyebrowText,
                                isCompactZoneCard && styles.compactEyebrowText,
                                {
                                  color: kindTheme.accent,
                                },
                              ]}
                            >
                              {kindTheme.eyebrow}
                            </Text>
                          </View>
                          <View
                            style={{
                              paddingHorizontal: 10,
                              paddingVertical: 5,
                              borderRadius: 999,
                              backgroundColor: colors.bg,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: "700",
                                color: colors.text,
                              }}
                            >
                              {isZoneAlert
                                ? `${alert.zone_type || "Parking"}`
                                : alert.parking_type ||
                                  alert.zone_type ||
                                  "1P"}
                            </Text>
                          </View>
                        </View>

                        <View
                          style={[
                            styles.distancePill,
                            isCompactZoneCard && styles.compactDistancePill,
                            {
                              backgroundColor: kindTheme.panel,
                            },
                          ]}
                        >
                          {isZoneAlert ? (
                            <Layers size={14} color={kindTheme.accent} />
                          ) : (
                            <MapPin size={14} color={kindTheme.accent} />
                          )}
                          <Text
                            style={[
                              styles.distanceText,
                              isCompactZoneCard && styles.compactDistanceText,
                              {
                                color: kindTheme.accent,
                              },
                            ]}
                          >
                            {formatDistance(alert.distance_meters || 0)}
                          </Text>
                        </View>
                      </View>

                      {alert.zone_name ? (
                        <Text
                          style={[
                            styles.zoneName,
                            isCompactZoneCard && styles.compactZoneName,
                          ]}
                        >
                          {alert.zone_name}
                        </Text>
                      ) : null}
                      <Text
                        style={[
                          styles.alertSummary,
                          isCompactZoneCard && styles.compactAlertSummary,
                        ]}
                      >
                        {summaryText}
                      </Text>

                      <View
                        style={[
                          styles.detailPanel,
                          isCompactZoneCard && styles.compactDetailPanel,
                          {
                            backgroundColor: kindTheme.panel,
                            borderColor: kindTheme.soft,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.detailLabel,
                            isCompactZoneCard && styles.compactDetailLabel,
                          ]}
                        >
                          {isZoneAlert ? "Zone rules" : "Report pulse"}
                        </Text>
                        <Text
                          style={[
                            styles.detailText,
                            isCompactZoneCard && styles.compactDetailText,
                          ]}
                        >
                          {detailText}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.statRow,
                          isCompactZoneCard && styles.compactStatRow,
                        ]}
                      >
                        {statItems.map((item) => (
                          <View
                            key={`${alert.id}-${item.label}`}
                            style={[
                              styles.statChip,
                              isCompactZoneCard && styles.compactStatChip,
                              {
                                backgroundColor: kindTheme.panel,
                                borderColor: kindTheme.soft,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.statChipLabel,
                                isCompactZoneCard &&
                                  styles.compactStatChipLabel,
                              ]}
                            >
                              {item.label}
                            </Text>
                            <Text
                              style={[
                                styles.statChipValue,
                                isCompactZoneCard &&
                                  styles.compactStatChipValue,
                              ]}
                            >
                              {item.value}
                            </Text>
                          </View>
                        ))}
                      </View>

                      {!isZoneAlert && alert.quantity && alert.quantity > 1 ? (
                        <View
                          style={[
                            styles.quantityWrap,
                            {
                              backgroundColor: colors.bg,
                              borderColor: colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "600",
                              color: colors.text,
                            }}
                          >
                            High-confidence cluster: {alert.quantity} spots
                            available at this location
                          </Text>
                        </View>
                      ) : null}

                      <TouchableOpacity
                        onPress={() =>
                          isZoneAlert
                            ? handleNavigateToZone(alert)
                            : handleOpenSpotOnMap(alert)
                        }
                        style={[
                          styles.mapButton,
                          isCompactZoneCard && styles.compactMapButton,
                          {
                            backgroundColor: kindTheme.button,
                          },
                        ]}
                      >
                        <Navigation size={16} color="#FFF" />
                        <Text
                          style={[
                            styles.mapButtonText,
                            isCompactZoneCard && styles.compactMapButtonText,
                          ]}
                        >
                          {kindTheme.buttonText}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: BRAND_PALETTE.background,
  },
  loadingText: {
    marginTop: 10,
    color: BRAND_PALETTE.muted,
  },
  unavailableScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: BRAND_PALETTE.background,
    paddingHorizontal: 24,
  },
  unavailableTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: "700",
    color: BRAND_PALETTE.navy,
    textAlign: "center",
  },
  unavailableText: {
    marginTop: 8,
    color: BRAND_PALETTE.muted,
    textAlign: "center",
    lineHeight: 22,
  },
  screen: {
    flex: 1,
    backgroundColor: "#EAF5FF",
  },
  backgroundOrbOne: {
    position: "absolute",
    top: -120,
    right: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(2, 132, 199, 0.12)",
  },
  backgroundOrbTwo: {
    position: "absolute",
    top: 190,
    left: -90,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(245, 158, 11, 0.10)",
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  heroCard: {
    borderRadius: 24,
    padding: 16,
    overflow: "hidden",
    shadowColor: "#03111D",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    elevation: 10,
  },
  heroOrbLarge: {
    position: "absolute",
    top: -42,
    right: -24,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  heroOrbSmall: {
    position: "absolute",
    bottom: -28,
    left: -16,
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: "rgba(125,211,252,0.14)",
  },
  heroEyebrow: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    marginBottom: 10,
  },
  heroEyebrowText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#D7F0FF",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: 23,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 27,
  },
  heroDescription: {
    marginTop: 7,
    fontSize: 12,
    lineHeight: 17,
    color: "rgba(230, 244, 255, 0.86)",
    maxWidth: "92%",
  },
  heroStatsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  heroStatCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.11)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  heroStatValue: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  heroStatLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(230, 244, 255, 0.76)",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  spotlightCard: {
    marginTop: 12,
    borderRadius: 18,
    padding: 12,
    backgroundColor: "#F8FCFF",
  },
  spotlightHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 7,
  },
  spotlightBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#E0F2FE",
  },
  spotlightBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: BRAND_PALETTE.accentBold,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  spotlightDistancePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#E8F4FB",
  },
  spotlightDistanceText: {
    fontSize: 11,
    fontWeight: "700",
    color: BRAND_PALETTE.deepNavy,
  },
  spotlightTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: BRAND_PALETTE.deepNavy,
  },
  spotlightText: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
    color: BRAND_PALETTE.muted,
  },
  spotlightMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 10,
  },
  spotlightMetaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#EFF7FC",
  },
  spotlightMetaText: {
    fontSize: 11,
    fontWeight: "700",
    color: BRAND_PALETTE.deepNavy,
  },
  filterPanel: {
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: "rgba(203, 213, 225, 0.9)",
    padding: 14,
    shadowColor: BRAND_PALETTE.navy,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  filterPanelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  filterEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: BRAND_PALETTE.accentBold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  filterTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: BRAND_PALETTE.navy,
    maxWidth: 210,
  },
  radiusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#EEF8FF",
    borderWidth: 1,
    borderColor: "#D5EAF8",
  },
  radiusPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: BRAND_PALETTE.accentBold,
  },
  tabRail: {
    gap: 8,
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  tabCountWrap: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  tabCount: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFF",
  },
  feedPanel: {
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderWidth: 1,
    borderColor: "rgba(203, 213, 225, 0.9)",
    padding: 14,
    shadowColor: BRAND_PALETTE.navy,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  feedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  feedEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: BRAND_PALETTE.gold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  feedTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: BRAND_PALETTE.navy,
  },
  feedCountBadge: {
    minWidth: 64,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "#F1F8FD",
  },
  feedCountValue: {
    fontSize: 19,
    fontWeight: "800",
    color: BRAND_PALETTE.deepNavy,
    lineHeight: 21,
  },
  feedCountLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: BRAND_PALETTE.muted,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  feedList: {
    gap: 10,
  },
  feedItem: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12,
  },
  compactFeedItem: {
    gap: 8,
  },
  feedRail: {
    width: 24,
    alignItems: "center",
  },
  compactFeedRail: {
    width: 18,
  },
  feedDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  compactFeedDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginTop: 4,
  },
  feedLine: {
    flex: 1,
    width: 2,
    borderRadius: 999,
    backgroundColor: "#D9E7F2",
    marginVertical: 8,
  },
  feedCardColumn: {
    flex: 1,
  },
  feedItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingRight: 2,
  },
  feedItemLabel: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: BRAND_PALETTE.muted,
  },
  feedItemDistance: {
    fontSize: 12,
    fontWeight: "700",
    color: BRAND_PALETTE.deepNavy,
  },
  compactFeedItemLabel: {
    fontSize: 10,
    letterSpacing: 0.6,
  },
  compactFeedItemDistance: {
    fontSize: 11,
  },
  emptyState: {
    paddingVertical: 34,
    paddingHorizontal: 18,
    borderRadius: 22,
    alignItems: "center",
    backgroundColor: "#F8FCFF",
    borderWidth: 1,
    borderColor: "#DCEAF5",
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#EAF5FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: BRAND_PALETTE.navy,
    marginBottom: 6,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 13,
    color: BRAND_PALETTE.muted,
    textAlign: "center",
    paddingHorizontal: 12,
    lineHeight: 20,
  },
  alertCard: {
    backgroundColor: BRAND_PALETTE.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    overflow: "hidden",
    position: "relative",
    shadowColor: BRAND_PALETTE.navy,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  reportAlertCard: {
    backgroundColor: "#FDFEFE",
  },
  zoneAlertCard: {
    backgroundColor: "#FFFEFB",
  },
  compactZoneAlertCard: {
    padding: 11,
    borderRadius: 12,
  },
  cardGlow: {
    position: "absolute",
    top: -28,
    right: -22,
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  alertCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  headerLead: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    flex: 1,
    paddingRight: 12,
  },
  compactHeaderLead: {
    gap: 6,
    paddingRight: 8,
  },
  eyebrowBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  compactEyebrowBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 4,
  },
  eyebrowText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  compactEyebrowText: {
    fontSize: 10,
    letterSpacing: 0.45,
  },
  distancePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  compactDistancePill: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 3,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: "700",
  },
  compactDistanceText: {
    fontSize: 11,
  },
  zoneName: {
    fontSize: 17,
    fontWeight: "700",
    color: BRAND_PALETTE.navy,
    marginBottom: 4,
  },
  compactZoneName: {
    fontSize: 15,
    marginBottom: 3,
  },
  alertSummary: {
    fontSize: 13,
    color: BRAND_PALETTE.deepNavy,
    lineHeight: 18,
    marginBottom: 10,
  },
  compactAlertSummary: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  detailPanel: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 10,
  },
  compactDetailPanel: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: BRAND_PALETTE.muted,
    marginBottom: 5,
  },
  compactDetailLabel: {
    fontSize: 10,
    marginBottom: 4,
    letterSpacing: 0.45,
  },
  detailText: {
    fontSize: 13,
    lineHeight: 19,
    color: BRAND_PALETTE.deepNavy,
  },
  compactDetailText: {
    fontSize: 12,
    lineHeight: 17,
  },
  statRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  compactStatRow: {
    gap: 6,
    marginBottom: 8,
  },
  statChip: {
    minWidth: "31%",
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  compactStatChip: {
    minWidth: "30%",
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
  },
  statChipLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: BRAND_PALETTE.muted,
    marginBottom: 3,
    textTransform: "uppercase",
  },
  compactStatChipLabel: {
    fontSize: 10,
    marginBottom: 2,
  },
  statChipValue: {
    fontSize: 13,
    fontWeight: "700",
    color: BRAND_PALETTE.navy,
  },
  compactStatChipValue: {
    fontSize: 12,
  },
  quantityWrap: {
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  mapButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  compactMapButton: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 9,
  },
  mapButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFF",
  },
  compactMapButtonText: {
    fontSize: 13,
  },
});
