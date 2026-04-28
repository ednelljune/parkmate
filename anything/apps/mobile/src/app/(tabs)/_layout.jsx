import { useEffect, useMemo, useRef, useState } from "react";
import { Redirect, Tabs, useGlobalSearchParams, useRouter } from "expo-router";
import { Bell, Clock, History, MapPin, ShieldCheck, Sparkles, Trophy, User } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { MotiView, AnimatePresence } from "moti";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaskedView from "@react-native-masked-view/masked-view";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Circle, Rect } from "react-native-svg";

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
const TUTORIAL_TAB_ORDER = ["map", "alerts", "timer", "activity", "leaders", "profile"];
const withAlpha = (hex, alpha) => {
  const normalized = String(hex || "").replace("#", "");
  const parsed = Number.parseInt(normalized, 16);

  if (!Number.isFinite(parsed)) {
    return hex;
  }

  const red = (parsed >> 16) & 255;
  const green = (parsed >> 8) & 255;
  const blue = parsed & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const IN_APP_TOUR_STEPS = [
  {
    id: "map-overview",
    route: "/",
    label: "Map",
    icon: MapPin,
    title: "Browse live parking zones",
    body: "The map shows parking zones and live spot reports. Tap a zone to open the details.",
    instruction: "Start on the map, then tap any zone pin to inspect the rules and availability.",
    simulationType: "map-overview",
  },
  {
    id: "map-details",
    route: "/",
    label: "Map",
    icon: MapPin,
    title: "Open the zone details",
    body: "A zone expands with capacity, parking rules, and live reports from other drivers.",
    instruction: "Use the details sheet to decide whether the zone is worth driving to.",
    simulationType: "map-details",
  },
  {
    id: "claim-timer",
    route: "/timer",
    label: "Timer",
    icon: Clock,
    title: "Claim a spot and start the timer",
    body: "When you claim a spot, the timer can auto-start for Pro. Free users can still set it manually.",
    instruction: "Claimed spots and timer tracking live together on the timer tab.",
    simulationType: "claim-timer",
  },
  {
    id: "report-spot",
    route: "/",
    label: "Map",
    icon: MapPin,
    title: "Report an open spot",
    body: "Report a newly open parking spot from the map so other drivers can see it fast.",
    instruction: "Tap report, confirm the spot, and it appears in the live map feed.",
    simulationType: "report-spot",
  },
  {
    id: "alerts",
    route: "/notifications",
    label: "Alerts",
    icon: Bell,
    title: "Watch nearby parking movement",
    body: "Alerts keep you updated when a zone or spot opens near you.",
    instruction: "Use alerts when you want a faster feed without scanning the map constantly.",
    simulationType: "alerts",
  },
  {
    id: "activity",
    route: "/activity",
    label: "Activity",
    icon: History,
    title: "Track report outcomes",
    body: "See whether your reports were claimed, expired, approved, or flagged.",
    instruction: "Swipe an item to review the outcome or follow up on a report.",
    simulationType: "activity",
  },
  {
    id: "leaders",
    route: "/leaderboard",
    label: "Leaders",
    icon: Trophy,
    title: "Climb the leaderboard",
    body: "Earn points for accurate reports, approved zones, and useful claims.",
    instruction: "Your rank improves as your contributions help more drivers.",
    simulationType: "leaders",
  },
  {
    id: "profile",
    route: "/profile",
    label: "Profile",
    icon: User,
    title: "Manage your profile",
    body: "Your profile shows your badge, trust score, stats, and the replay shortcut for this tour.",
    instruction: "Keep your profile updated so your contributions stay visible and trusted.",
    simulationType: "profile",
  },
];
const COACHMARK_LAYOUTS = {
  "map-overview": { tabIndex: 0, holeRadius: 36 },
  "map-details": { tabIndex: 0, holeRadius: 36 },
  "report-spot": { tabIndex: 0, holeRadius: 36 },
  "claim-timer": { tabIndex: 2, holeRadius: 36 },
  alerts: { tabIndex: 1, holeRadius: 36 },
  activity: { tabIndex: 3, holeRadius: 36 },
  leaders: { tabIndex: 4, holeRadius: 36 },
  profile: { tabIndex: 5, holeRadius: 36 },
};
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

function FeatureSimulation({ type }) {
  if (type === "map-overview") {
    return (
      <MotiView from={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} style={styles.simContainer}>
        <View style={styles.simOverviewCard}>
          <View style={styles.simMapCanvas}>
            <View style={styles.simMapRoadH} />
            <View style={styles.simMapRoadV} />
            <View style={[styles.simMapRoadH, styles.simMapRoadLower]} />
            <View style={[styles.simMapRoadV, styles.simMapRoadRight]} />
            <View style={styles.simMapBlockLabel}>
              <Text style={styles.simMapBlockLabelText}>UNION SQUARE</Text>
            </View>
            <View style={styles.simMapZonePulse} />
            <View style={styles.simMapZonePin}>
              <MapPin color="#FFF" size={16} />
            </View>
            <View style={styles.simMapZoneTag}>
              <Text style={styles.simMapZoneTagText}>1P</Text>
            </View>
          </View>
          <View style={styles.simMapHeader}>
            <View style={styles.simMapPin}>
              <MapPin color="#FFF" size={12} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.simMapTitle}>Public parking zone</Text>
              <Text style={styles.simMapSubtitle}>Tap the highlighted zone to open details</Text>
            </View>
          </View>
          <View style={styles.simZoneSnippet}>
            <View style={styles.simZoneSnippetHeader}>
              <View style={styles.simZoneSnippetType}>
                <Text style={styles.simZoneSnippetTypeText}>1P</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.simZoneSnippetTitle}>Collins St public zone</Text>
                <Text style={styles.simZoneSnippetSubtitle}>4 open spots · 12 spaces total</Text>
              </View>
            </View>
            <Text style={styles.simZoneSnippetBody}>
              Mon-Fri 8am-6pm. Tap the zone to see capacity, rules, and live reports.
            </Text>
          </View>
        </View>
      </MotiView>
    );
  }

  if (type === "map-details") {
    return (
      <MotiView from={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={styles.simContainer}>
        <View style={styles.simDetailCard}>
          <View style={styles.simDetailHeader}>
            <View>
              <Text style={styles.simDetailTitle}>Parking Zone Details</Text>
              <Text style={styles.simDetailSubtitle}>Capacity, rules, and live reports</Text>
            </View>
            <View style={styles.simDetailBadge}>
              <Text style={styles.simDetailBadgeText}>PUBLIC</Text>
            </View>
          </View>
          <View style={styles.simDetailRow}>
            <Text style={styles.simDetailLabel}>Capacity</Text>
            <Text style={styles.simDetailValue}>12 spots</Text>
          </View>
          <View style={styles.simDetailRow}>
            <Text style={styles.simDetailLabel}>Rules</Text>
            <Text style={styles.simDetailValue}>Mon-Fri 8am-6pm • 1 Hour Max</Text>
          </View>
          <View style={styles.simDetailRow}>
            <Text style={styles.simDetailLabel}>Reports</Text>
            <Text style={styles.simDetailValue}>4 nearby drivers</Text>
          </View>
          <View style={styles.simDetailDescriptionBox}>
            <Text style={styles.simDetailDescriptionTitle}>Description</Text>
            <Text style={styles.simDetailDescriptionBody}>
              Public parking zone on Collins St. Tap a spot marker or claim from here to start the next step.
            </Text>
          </View>
          <View style={styles.simDetailAction}>
            <Text style={styles.simDetailActionText}>Claim spot</Text>
          </View>
        </View>
      </MotiView>
    );
  }

  if (type === "claim-timer") {
    return (
      <View style={styles.simContainer}>
        <View style={styles.simClaimCard}>
          <View style={styles.simClaimHeader}>
            <Text style={styles.simClaimTitle}>Claimed spot</Text>
            <View style={styles.simClaimBadge}>
              <Text style={styles.simClaimBadgeText}>Pro auto-start</Text>
            </View>
          </View>
          <View style={styles.simClaimSpotRow}>
            <View style={styles.simClaimSpotDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.simClaimSpotTitle}>Collins St - 1P zone</Text>
              <Text style={styles.simClaimSpotBody}>Confirm the claim and the timer starts.</Text>
            </View>
          </View>
          <View style={styles.simTimerRing}>
            <Text style={styles.simTimerText}>00:54:12</Text>
            <Text style={styles.simTimerLabel}>REMAINING</Text>
          </View>
          <Text style={styles.simClaimFooterText}>Free users can still set a manual timer.</Text>
        </View>
      </View>
    );
  }

  if (type === "report-spot") {
    return (
      <MotiView from={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} style={styles.simContainer}>
        <View style={styles.simReportCard}>
          <View style={styles.simReportMapRow}>
            <View style={styles.simReportMapPin}>
              <MapPin color={BRAND_PALETTE.accentBold} size={14} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.simReportTitle}>Open spot in zone</Text>
              <Text style={styles.simReportBody}>Tap report to add it to the live map.</Text>
            </View>
          </View>
          <View style={styles.simReportAction}>
            <Text style={styles.simReportActionText}>Report spot</Text>
          </View>
        </View>
      </MotiView>
    );
  }

  if (type === "alerts") {
    return (
      <MotiView from={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} style={styles.simContainer}>
        <View style={styles.simAlertCard}>
          <View style={styles.simAlertIcon}>
            <Bell color="#0284C7" size={14} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.simAlertTitle}>New spot found!</Text>
            <Text style={styles.simAlertBody}>2P spot just opened in Lonsdale St</Text>
          </View>
          <View style={styles.simAlertTime}>
            <Text style={styles.simAlertTimeText}>Just now</Text>
          </View>
        </View>
      </MotiView>
    );
  }

  if (type === "activity") {
    return (
      <MotiView from={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} style={styles.simContainer}>
        <View style={styles.simFeedCard}>
          <View style={styles.simFeedHeader}>
            <View style={[styles.simFeedStatusDot, { backgroundColor: "#8B5CF6" }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.simFeedTitle}>Missing zone under review</Text>
              <Text style={styles.simFeedSubtitle}>11 hours ago · Union Square</Text>
            </View>
          </View>
          <View style={styles.simFeedDivider} />
          <View style={styles.simFeedHeader}>
            <View style={[styles.simFeedStatusDot, { backgroundColor: "#10B981" }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.simFeedTitle}>Your report was claimed</Text>
              <Text style={styles.simFeedSubtitle}>You earned +10 contribution points</Text>
            </View>
          </View>
        </View>
      </MotiView>
    );
  }

  if (type === "leaders") {
    return (
      <MotiView from={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} style={styles.simContainer}>
        <View style={styles.simLeaderboardCard}>
          <View style={styles.simLeaderboardHeader}>
            <Text style={styles.simLeaderboardEyebrow}>TOP THREE</Text>
            <Text style={styles.simLeaderboardHeaderText}>Mini podium preview</Text>
          </View>
          <View style={styles.simLeaderboardPodium}>
            <View style={styles.simLeaderboardLane}>
              <View style={[styles.simLeaderboardBadge, styles.simLeaderboardBadgeSilver]}>
                <Text style={styles.simLeaderboardBadgeText}>2</Text>
              </View>
              <View style={[styles.simLeaderboardColumn, styles.simLeaderboardColumnSide]}>
                <View style={[styles.simLeaderboardAvatar, styles.simLeaderboardAvatarSilver]}>
                  <Text style={styles.simLeaderboardAvatarText}>JT</Text>
                </View>
                <Text style={styles.simLeaderboardTier}>PACESETTER</Text>
                <Text style={styles.simLeaderboardName}>Jamie</Text>
                <Text style={styles.simLeaderboardPoints}>255</Text>
              </View>
            </View>
            <View style={styles.simLeaderboardLane}>
              <View style={[styles.simLeaderboardBadge, styles.simLeaderboardBadgeGold]}>
                <Text style={styles.simLeaderboardBadgeText}>1</Text>
              </View>
              <View style={[styles.simLeaderboardColumn, styles.simLeaderboardColumnCenter]}>
                <View style={[styles.simLeaderboardAvatar, styles.simLeaderboardAvatarGold]}>
                  <Text style={styles.simLeaderboardAvatarText}>AT</Text>
                </View>
                <Text style={styles.simLeaderboardTier}>CHAMPION</Text>
                <Text style={styles.simLeaderboardName}>Alex</Text>
                <Text style={styles.simLeaderboardPoints}>1,250</Text>
              </View>
            </View>
            <View style={styles.simLeaderboardLane}>
              <View style={[styles.simLeaderboardBadge, styles.simLeaderboardBadgeBronze]}>
                <Text style={styles.simLeaderboardBadgeText}>3</Text>
              </View>
              <View style={[styles.simLeaderboardColumn, styles.simLeaderboardColumnSide]}>
                <View style={[styles.simLeaderboardAvatar, styles.simLeaderboardAvatarBronze]}>
                  <Text style={styles.simLeaderboardAvatarText}>JS</Text>
                </View>
                <Text style={styles.simLeaderboardTier}>CONTENDER</Text>
                <Text style={styles.simLeaderboardName}>June</Text>
                <Text style={styles.simLeaderboardPoints}>190</Text>
              </View>
            </View>
          </View>
          <View style={styles.simLeaderboardFooter}>
            <Sparkles color="#0284C7" size={12} />
            <Text style={styles.simLeaderboardFooterText}>Impact decides rank</Text>
          </View>
        </View>
      </MotiView>
    );
  }

  if (type === "profile") {
    return (
      <MotiView from={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} style={styles.simContainer}>
        <View style={styles.simProfileCard}>
          <View style={styles.simProfileTopRow}>
            <View style={styles.simProfileAvatar}>
              <Text style={styles.simProfileAvatarText}>JS</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.simProfileName}>June S</Text>
              <Text style={styles.simProfileMeta}>City Vanguard · #9 citywide</Text>
            </View>
          </View>
          <View style={styles.simProfileStatRow}>
            <View style={styles.simProfileStatPill}>
              <Text style={styles.simProfileStatValue}>180</Text>
              <Text style={styles.simProfileStatLabel}>impact</Text>
            </View>
            <View style={styles.simProfileStatPill}>
              <Text style={styles.simProfileStatValue}>20</Text>
              <Text style={styles.simProfileStatLabel}>reports</Text>
            </View>
            <View style={styles.simProfileStatPill}>
              <Text style={styles.simProfileStatValue}>3</Text>
              <Text style={styles.simProfileStatLabel}>claims</Text>
            </View>
          </View>
        </View>
      </MotiView>
    );
  }

  return (
    <View style={styles.simContainer}>
      <ActivityIndicator color={BRAND_PALETTE.accentBold} />
    </View>
  );
}

function SpotlightOrb({ style, colors, duration = 4200, delay = 0 }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration,
          delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [delay, duration, pulse]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.tourSpotlight,
        style,
        {
          opacity: pulse.interpolate({
            inputRange: [0, 1],
            outputRange: [0.16, 0.32],
          }),
          transform: [
            {
              scale: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.96, 1.08],
              }),
            },
          ],
        },
      ]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0.2, y: 0.2 }}
        end={{ x: 0.8, y: 0.8 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

function TourOverlay({
  activeStep,
  activeStepIndex,
  isLastStep,
  isSaving,
  onNext,
  onClose,
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const ActiveIcon = activeStep.icon;
  const coachmark = COACHMARK_LAYOUTS[activeStep.id] || COACHMARK_LAYOUTS["map-overview"];
  const tabIndex = coachmark.tabIndex ?? 0;
  const holeX = width * ((tabIndex + 0.5) / TUTORIAL_TAB_ORDER.length);
  const tabBarHeight = 64 + insets.bottom;
  const tabBarTop = height - tabBarHeight;
  const holeY = tabBarTop + 20;
  const holeR = coachmark.holeRadius ?? 36;
  const beaconLeft = holeX - 42;
  const beaconTop = holeY - 42;
  const cardWidth = Math.min(width - 48, 420);
  const cardHeight = 374;
  const cardLeft = Math.min(Math.max(24, holeX - cardWidth / 2), width - cardWidth - 24);
  const cardBelow = holeY + holeR + 28;
  const cardAbove = holeY - holeR - cardHeight - 28;
  const showCardBelow =
    cardBelow + cardHeight <= height - insets.bottom - 24;
  const cardTop = showCardBelow
    ? cardBelow
    : Math.max(insets.top + 112, cardAbove);
  const pointerLeft = Math.min(
    Math.max(holeX - cardLeft - 10, 28),
    cardWidth - 48,
  );

  return (
    <View style={StyleSheet.absoluteFill}>
      <MaskedView
        maskElement={
          <Svg height={height} width={width} viewBox={`0 0 ${width} ${height}`}>
            <Rect x="0" y="0" width={width} height={height} fill="white" />
            <Circle cx={holeX} cy={holeY} r={holeR} fill="black" />
          </Svg>
        }
        style={StyleSheet.absoluteFill}
      >
        <LinearGradient
          colors={[
            withAlpha(BRAND_PALETTE.deepNavy, 0.82),
            withAlpha(BRAND_PALETTE.navy, 0.88),
            withAlpha(BRAND_PALETTE.deepNavy, 0.94),
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </MaskedView>

      <SpotlightOrb
        style={[
          styles.tourSpotlightOrbLarge,
          {
            left: holeX - 150,
            top: holeY - 150,
          },
        ]}
        colors={[
          withAlpha(BRAND_PALETTE.surface, 0.26),
          withAlpha(BRAND_PALETTE.surface, 0.1),
          withAlpha(BRAND_PALETTE.surface, 0),
        ]}
        duration={5200}
      />
      <SpotlightOrb
        style={[
          styles.tourSpotlightOrbCore,
          {
            left: holeX - 92,
            top: holeY - 92,
          },
        ]}
        colors={[
          withAlpha(BRAND_PALETTE.surface, 0.56),
          withAlpha(BRAND_PALETTE.surface, 0.22),
          withAlpha(BRAND_PALETTE.surface, 0),
        ]}
        duration={3600}
        delay={120}
      />

      <View pointerEvents="none" style={[styles.tourBeaconWrap, { left: beaconLeft, top: beaconTop }]}>
        <View style={styles.tourBeaconOuter}>
          <View style={styles.tourBeaconInner}>
            <ActiveIcon color={BRAND_PALETTE.accentBold} size={22} />
          </View>
        </View>
      </View>

      <AnimatePresence mode="wait">
        <MotiView
          key={activeStep.id}
          from={{ opacity: 0, scale: 0.98, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 8 }}
          transition={{ type: "timing", duration: 350 }}
          style={[styles.tourCardContainer, { width: cardWidth, left: cardLeft, top: cardTop }]}
        >
          <View
            style={[
              styles.tourCardPointer,
              showCardBelow ? styles.tourCardPointerTop : styles.tourCardPointerBottom,
              { left: pointerLeft },
            ]}
          />
          <BlurView intensity={88} tint="light" style={styles.tourCard}>
            <View style={styles.tourCardTopRow}>
              <Text style={styles.tourStepMeta}>
                TIP {activeStepIndex + 1} OF {IN_APP_TOUR_STEPS.length}
              </Text>
              <Pressable onPress={onClose} hitSlop={10} style={styles.tourCardCloseButton}>
                <Text style={styles.tourCardCloseText}>×</Text>
              </Pressable>
            </View>

            <Text style={styles.tourTitle}>{activeStep.title}</Text>
            <Text style={styles.tourBody}>{activeStep.body}</Text>
            <FeatureSimulation type={activeStep.simulationType} />

            <View style={styles.tourCardActions}>
              <Pressable onPress={onClose} style={styles.tourSkipLink}>
                <Text style={styles.tourSkipLinkText}>Skip tour</Text>
              </Pressable>

              <Pressable onPress={onNext} disabled={isSaving} style={styles.tourPrimaryButton}>
                <LinearGradient
                  colors={[BRAND_PALETTE.deepNavy, BRAND_PALETTE.navy]}
                  style={styles.tourPrimaryButtonGradient}
                >
                  <Text style={styles.tourPrimaryButtonText}>
                    {isSaving ? "Saving..." : isLastStep ? "GOT IT" : "NEXT"}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </BlurView>
        </MotiView>
      </AnimatePresence>
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
  const [tourDismissed, setTourDismissed] = useState(false);
  const [replayTourActive, setReplayTourActive] = useState(false);
  const [tutorialCompletedThisSession, setTutorialCompletedThisSession] = useState(false);
  const lastNearbyAlertCheckRef = useRef(null);
  const lastNearbyAlertLocationRef = useRef(null);
  const alertedAlertIdsRef = useRef(new Set());
  const hasConsumedReplayParamRef = useRef(false);
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
  const isReplayTourRequested = replayParam === "1" || replayParam === "true";
  const shouldStartReplayTour =
    isReplayTourRequested &&
    !shouldShowTutorial &&
    !replayTourActive &&
    !hasConsumedReplayParamRef.current;
  const shouldDisplayFirstLoginTour =
    shouldShowTutorial && !tutorialCompletedThisSession;
  const isTourActive =
    (shouldDisplayFirstLoginTour || replayTourActive) && !tourDismissed;
  const activeTourStep = IN_APP_TOUR_STEPS[tourStepIndex] || IN_APP_TOUR_STEPS[0];
  const isLastTourStep = tourStepIndex === IN_APP_TOUR_STEPS.length - 1;

  useEffect(() => {
    if (shouldStartReplayTour) {
      hasConsumedReplayParamRef.current = true;
      setTourStepIndex(0);
      setReplayTourActive(true);
      setTourDismissed(false);
      router.replace(IN_APP_TOUR_STEPS[0].route);
    }
  }, [router, shouldStartReplayTour]);

  useEffect(() => {
    if (!isReplayTourRequested && !replayTourActive) {
      hasConsumedReplayParamRef.current = false;
    }
  }, [isReplayTourRequested, replayTourActive]);

  useEffect(() => {
    if (!isTourActive) {
      setTourStepIndex(0);
      return;
    }

    router.replace(activeTourStep.route);
  }, [activeTourStep.route, isTourActive, router]);

  useEffect(() => {
    if (shouldShowTutorial) {
      setTourDismissed(false);
      setTutorialCompletedThisSession(false);
    }
  }, [shouldShowTutorial]);

  const finishTour = async () => {
    if (isSavingTour) {
      return;
    }

    setIsSavingTour(true);
    setTourDismissed(true);
    setTutorialCompletedThisSession(true);
    setReplayTourActive(false);

    try {
      if (shouldShowTutorial) {
        await completeTutorial();
        router.replace("/");
        return;
      }

      router.replace("/profile");
    } catch (error) {
      setTourDismissed(false);
      setTutorialCompletedThisSession(false);
      throw error;
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
          isLastStep={isLastTourStep}
          isSaving={isSavingTour}
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
    justifyContent: "flex-start",
  },
  tourBeaconWrap: {
    position: "absolute",
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: BRAND_PALETTE.accentBold,
    shadowOpacity: 0.3,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  tourBeaconOuter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1,
    borderColor: withAlpha(BRAND_PALETTE.surface, 0.82),
    backgroundColor: withAlpha(BRAND_PALETTE.surface, 0.18),
    alignItems: "center",
    justifyContent: "center",
  },
  tourBeaconInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: BRAND_PALETTE.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  tourBranding: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  tourBrandingPark: {
    color: BRAND_PALETTE.surface,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  tourBrandingMate: {
    color: BRAND_PALETTE.accent,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  tourCardContainer: {
    position: "absolute",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 16 },
    elevation: 18,
  },
  tourCard: {
    borderRadius: 30,
    padding: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: withAlpha(BRAND_PALETTE.border, 0.96),
    backgroundColor: withAlpha(BRAND_PALETTE.surface, 0.98),
  },
  tourCardPointer: {
    position: "absolute",
    width: 20,
    height: 20,
    backgroundColor: withAlpha(BRAND_PALETTE.surface, 0.98),
    transform: [{ rotate: "45deg" }],
    borderTopLeftRadius: 4,
  },
  tourCardPointerTop: {
    top: -8,
  },
  tourCardPointerBottom: {
    bottom: -8,
  },
  tourCardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  tourStepMeta: {
    color: BRAND_PALETTE.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  tourCardCloseButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tourCardCloseText: {
    color: BRAND_PALETTE.muted,
    fontSize: 24,
    lineHeight: 24,
    fontWeight: "300",
  },
  tourTitle: {
    color: BRAND_PALETTE.deepNavy,
    fontSize: 23,
    fontWeight: "900",
    lineHeight: 28,
    marginBottom: 8,
  },
  tourBody: {
    color: BRAND_PALETTE.muted,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 22,
  },
  tourCardActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  tourSkipLink: {
    flexShrink: 0,
    paddingVertical: 10,
    paddingRight: 4,
  },
  tourSkipLinkText: {
    color: BRAND_PALETTE.navy,
    fontSize: 15,
    fontWeight: "700",
  },
  tourPrimaryButton: {
    flex: 1,
    height: 52,
    borderRadius: 18,
    overflow: "hidden",
  },
  tourPrimaryButtonGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tourPrimaryButtonText: {
    color: BRAND_PALETTE.surface,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  tourSpotlightOrbLarge: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    overflow: "hidden",
  },
  tourSpotlightOrbCore: {
    position: "absolute",
    width: 184,
    height: 184,
    borderRadius: 92,
    overflow: "hidden",
  },
  tourSpotlight: {
    position: "absolute",
    width: 1,
    height: 1,
    borderRadius: 9999,
  },
  simContainer: {
    marginTop: 8,
    marginBottom: 18,
  },
  simOverviewCard: {
    backgroundColor: withAlpha(BRAND_PALETTE.highlight, 0.92),
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: withAlpha(BRAND_PALETTE.border, 0.9),
  },
  simMapCanvas: {
    height: 150,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: withAlpha(BRAND_PALETTE.background, 0.92),
    marginBottom: 12,
    borderWidth: 1,
    borderColor: withAlpha(BRAND_PALETTE.border, 0.75),
  },
  simMapRoadH: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 48,
    height: 2,
    backgroundColor: withAlpha(BRAND_PALETTE.navy, 0.14),
  },
  simMapRoadLower: {
    top: 102,
  },
  simMapRoadV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 126,
    width: 2,
    backgroundColor: withAlpha(BRAND_PALETTE.navy, 0.14),
  },
  simMapRoadRight: {
    left: 236,
  },
  simMapBlockLabel: {
    position: "absolute",
    top: 14,
    left: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: withAlpha(BRAND_PALETTE.surface, 0.86),
  },
  simMapBlockLabelText: {
    color: BRAND_PALETTE.muted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  simMapZonePulse: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    left: 145,
    top: 52,
    backgroundColor: withAlpha(BRAND_PALETTE.accentBold, 0.16),
    borderWidth: 2,
    borderColor: withAlpha(BRAND_PALETTE.accentBold, 0.45),
  },
  simMapZonePin: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    left: 164,
    top: 71,
    backgroundColor: BRAND_PALETTE.accentBold,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: BRAND_PALETTE.accentBold,
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  simMapZoneTag: {
    position: "absolute",
    left: 154,
    top: 106,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: BRAND_PALETTE.surface,
    borderWidth: 1,
    borderColor: withAlpha(BRAND_PALETTE.accentBold, 0.2),
  },
  simMapZoneTagText: {
    color: BRAND_PALETTE.accentBold,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  simMapHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  simMapPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND_PALETTE.accentBold,
  },
  simMapTitle: {
    color: BRAND_PALETTE.deepNavy,
    fontSize: 15,
    fontWeight: "900",
  },
  simMapSubtitle: {
    color: BRAND_PALETTE.muted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  simMapZoneRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  simMapZonePill: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: BRAND_PALETTE.surface,
    borderWidth: 1,
    borderColor: withAlpha(BRAND_PALETTE.border, 0.92),
  },
  simMapZonePillActive: {
    borderColor: BRAND_PALETTE.accentBold,
    backgroundColor: withAlpha(BRAND_PALETTE.highlight, 0.6),
  },
  simMapZonePillTitle: {
    color: BRAND_PALETTE.deepNavy,
    fontSize: 14,
    fontWeight: "900",
  },
  simMapZonePillText: {
    color: BRAND_PALETTE.muted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },
  simMapFlowRow: {
    flexDirection: "row",
    gap: 8,
  },
  simMapFlowStep: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: withAlpha(BRAND_PALETTE.surface, 0.94),
  },
  simMapFlowStepTitle: {
    color: BRAND_PALETTE.accentBold,
    fontSize: 12,
    fontWeight: "900",
  },
  simMapFlowStepText: {
    color: BRAND_PALETTE.deepNavy,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },
  simZoneSnippet: {
    backgroundColor: BRAND_PALETTE.surface,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: withAlpha(BRAND_PALETTE.border, 0.92),
  },
  simZoneSnippetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  simZoneSnippetType: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha(BRAND_PALETTE.highlight, 0.96),
  },
  simZoneSnippetTypeText: {
    color: BRAND_PALETTE.accentBold,
    fontSize: 12,
    fontWeight: "900",
  },
  simZoneSnippetTitle: {
    color: BRAND_PALETTE.deepNavy,
    fontSize: 14,
    fontWeight: "900",
  },
  simZoneSnippetSubtitle: {
    color: BRAND_PALETTE.muted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  simZoneSnippetBody: {
    color: BRAND_PALETTE.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  simDetailCard: {
    backgroundColor: BRAND_PALETTE.surface,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: withAlpha(BRAND_PALETTE.border, 0.92),
  },
  simDetailHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  simDetailTitle: {
    color: BRAND_PALETTE.deepNavy,
    fontSize: 15,
    fontWeight: "900",
  },
  simDetailSubtitle: {
    color: BRAND_PALETTE.muted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  simDetailBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: withAlpha(BRAND_PALETTE.highlight, 0.9),
  },
  simDetailBadgeText: {
    color: BRAND_PALETTE.accentBold,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  simDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: withAlpha(BRAND_PALETTE.border, 0.52),
  },
  simDetailDescriptionBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: withAlpha(BRAND_PALETTE.highlight, 0.34),
  },
  simDetailDescriptionTitle: {
    color: BRAND_PALETTE.accentBold,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  simDetailDescriptionBody: {
    color: BRAND_PALETTE.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  simDetailLabel: {
    color: BRAND_PALETTE.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  simDetailValue: {
    flex: 1,
    color: BRAND_PALETTE.deepNavy,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
  },
  simDetailAction: {
    marginTop: 10,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND_PALETTE.accentBold,
  },
  simDetailActionText: {
    color: BRAND_PALETTE.surface,
    fontSize: 13,
    fontWeight: "900",
  },
  simClaimCard: {
    backgroundColor: BRAND_PALETTE.surface,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: withAlpha(BRAND_PALETTE.border, 0.92),
  },
  simClaimHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  simClaimTitle: {
    color: BRAND_PALETTE.deepNavy,
    fontSize: 15,
    fontWeight: "900",
  },
  simClaimBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: withAlpha(BRAND_PALETTE.navy, 0.08),
  },
  simClaimBadgeText: {
    color: BRAND_PALETTE.navy,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  simClaimSpotRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  simClaimSpotDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: BRAND_PALETTE.accentBold,
  },
  simClaimSpotTitle: {
    color: BRAND_PALETTE.deepNavy,
    fontSize: 13,
    fontWeight: "800",
  },
  simClaimSpotBody: {
    color: BRAND_PALETTE.muted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  simTimerRing: {
    alignSelf: "center",
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 8,
    borderColor: withAlpha(BRAND_PALETTE.accentBold, 0.22),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  simTimerText: {
    color: BRAND_PALETTE.deepNavy,
    fontSize: 18,
    fontWeight: "900",
  },
  simTimerLabel: {
    color: BRAND_PALETTE.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.9,
    marginTop: 2,
  },
  simClaimFooterText: {
    color: BRAND_PALETTE.muted,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  simReportCard: {
    backgroundColor: BRAND_PALETTE.surface,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: withAlpha(BRAND_PALETTE.border, 0.92),
  },
  simReportMapRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  simReportMapPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: withAlpha(BRAND_PALETTE.highlight, 0.92),
    alignItems: "center",
    justifyContent: "center",
  },
  simReportTitle: {
    color: BRAND_PALETTE.deepNavy,
    fontSize: 15,
    fontWeight: "900",
  },
  simReportBody: {
    color: BRAND_PALETTE.muted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  simReportAction: {
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND_PALETTE.deepNavy,
  },
  simReportActionText: {
    color: BRAND_PALETTE.surface,
    fontSize: 13,
    fontWeight: "900",
  },
  simAlertCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: BRAND_PALETTE.surface,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: withAlpha(BRAND_PALETTE.border, 0.92),
  },
  simAlertIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha(BRAND_PALETTE.highlight, 0.92),
  },
  simAlertTitle: {
    color: BRAND_PALETTE.deepNavy,
    fontSize: 14,
    fontWeight: "900",
  },
  simAlertBody: {
    color: BRAND_PALETTE.muted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  simAlertTime: {
    alignItems: "flex-end",
  },
  simAlertTimeText: {
    color: BRAND_PALETTE.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  simFeedCard: {
    backgroundColor: BRAND_PALETTE.surface,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: withAlpha(BRAND_PALETTE.border, 0.92),
  },
  simFeedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  simFeedStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  simFeedTitle: {
    color: BRAND_PALETTE.deepNavy,
    fontSize: 13,
    fontWeight: "900",
  },
  simFeedSubtitle: {
    color: BRAND_PALETTE.muted,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  simFeedDivider: {
    height: 1,
    backgroundColor: withAlpha(BRAND_PALETTE.border, 0.62),
    marginVertical: 10,
  },
  simLeaderboardCard: {
    backgroundColor: BRAND_PALETTE.surface,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: withAlpha(BRAND_PALETTE.border, 0.92),
  },
  simLeaderboardHeader: {
    marginBottom: 10,
  },
  simLeaderboardEyebrow: {
    color: BRAND_PALETTE.accentBold,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  simLeaderboardHeaderText: {
    color: BRAND_PALETTE.deepNavy,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 4,
  },
  simLeaderboardPodium: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  simLeaderboardLane: {
    flex: 1,
    alignItems: "center",
  },
  simLeaderboardBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  simLeaderboardBadgeText: {
    color: BRAND_PALETTE.surface,
    fontSize: 11,
    fontWeight: "900",
  },
  simLeaderboardBadgeSilver: {
    backgroundColor: "#94A3B8",
  },
  simLeaderboardBadgeGold: {
    backgroundColor: BRAND_PALETTE.gold,
  },
  simLeaderboardBadgeBronze: {
    backgroundColor: "#B45309",
  },
  simLeaderboardColumn: {
    alignItems: "center",
    gap: 2,
  },
  simLeaderboardColumnSide: {
    paddingTop: 6,
  },
  simLeaderboardColumnCenter: {
    paddingTop: 0,
  },
  simLeaderboardAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  simLeaderboardAvatarSilver: {
    backgroundColor: withAlpha("#94A3B8", 0.18),
  },
  simLeaderboardAvatarGold: {
    backgroundColor: withAlpha(BRAND_PALETTE.gold, 0.16),
  },
  simLeaderboardAvatarBronze: {
    backgroundColor: withAlpha("#B45309", 0.16),
  },
  simLeaderboardAvatarText: {
    color: BRAND_PALETTE.deepNavy,
    fontSize: 11,
    fontWeight: "900",
  },
  simLeaderboardTier: {
    color: BRAND_PALETTE.accentBold,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  simLeaderboardName: {
    color: BRAND_PALETTE.deepNavy,
    fontSize: 12,
    fontWeight: "800",
  },
  simLeaderboardPoints: {
    color: BRAND_PALETTE.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  simLeaderboardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
  },
  simLeaderboardFooterText: {
    color: BRAND_PALETTE.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  simProfileCard: {
    backgroundColor: BRAND_PALETTE.surface,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: withAlpha(BRAND_PALETTE.border, 0.92),
  },
  simProfileTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  simProfileAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha(BRAND_PALETTE.highlight, 0.92),
  },
  simProfileAvatarText: {
    color: BRAND_PALETTE.accentBold,
    fontSize: 12,
    fontWeight: "900",
  },
  simProfileName: {
    color: BRAND_PALETTE.deepNavy,
    fontSize: 14,
    fontWeight: "900",
  },
  simProfileMeta: {
    color: BRAND_PALETTE.muted,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  simProfileStatRow: {
    flexDirection: "row",
    gap: 8,
  },
  simProfileStatPill: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: withAlpha(BRAND_PALETTE.highlight, 0.86),
  },
  simProfileStatValue: {
    color: BRAND_PALETTE.deepNavy,
    fontSize: 15,
    fontWeight: "900",
  },
  simProfileStatLabel: {
    color: BRAND_PALETTE.muted,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
});
