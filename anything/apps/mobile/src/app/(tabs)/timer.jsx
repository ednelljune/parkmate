import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import {
  BellRing,
  Clock3,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react-native";

import {
  configureNotificationHandler,
  ensureAlertsNotificationChannel,
  getNotificationsModule,
  isExpoGo,
  notificationsUnsupportedInCurrentRuntime,
} from "@/lib/notifications";
import useUser from "@/utils/auth/useUser";
import { BRAND_PALETTE } from "@/theme/brandColors";

const TIMER_STORAGE_KEY = "parkingTimers";

const ZONE_DURATIONS = {
  "1P": 60,
  "2P": 120,
  "3P": 180,
};

const ZONE_ORDER = ["1P", "2P", "3P"];
const TIMER_KIND_ORDER = ["manual", "claimed"];

const ZONE_META = {
  "1P": {
    title: "Quick Stop",
    subtitle: "Fast errands and pickups",
    accent: "#0EA5E9",
    soft: "#DBF0FF",
  },
  "2P": {
    title: "City Cruise",
    subtitle: "Balanced for shopping runs",
    accent: "#10B981",
    soft: "#DDF8EC",
  },
  "3P": {
    title: "Long Stay",
    subtitle: "Best for deep sessions downtown",
    accent: "#F59E0B",
    soft: "#FFF1CF",
  },
};

const TIMER_KIND_META = {
  manual: {
    label: "Manual Timer",
    eyebrow: "Your own session",
    badge: "Manual",
    description: "Pick a zone limit and run your own parking countdown any time.",
  },
  claimed: {
    label: "Claimed Spot Timer",
    eyebrow: "Auto-start ready",
    badge: "Claimed",
    description: "Starts from a claimed parking spot and stays separate from your manual timer.",
  },
};

const REMINDER_MINUTES = [30, 15];
const REMINDER_WARNING_SECONDS = REMINDER_MINUTES[REMINDER_MINUTES.length - 1] * 60;

const formatTime = (seconds) => {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${secs.toString().padStart(2, "0")}`;
};

const formatShortDuration = (minutes) => {
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h` : `${minutes}m`;
};

const getPreferredZone = (claims) => {
  if (claims >= 10) return "3P";
  if (claims >= 5) return "2P";
  return "1P";
};

const createDefaultTimerSession = (zone = "1P", overrides = {}) => ({
  zone,
  remaining: ZONE_DURATIONS[zone] * 60,
  running: false,
  endsAt: null,
  hasReminder: false,
  hasManualZoneChoice: false,
  notificationIds: [],
  ...overrides,
});

const isLegacyTimerState = (value) =>
  value &&
  typeof value === "object" &&
  ("zone" in value || "remaining" in value || "running" in value);

const getSessionTotalDuration = (session) => {
  const zone = session?.zone && ZONE_DURATIONS[session.zone] ? session.zone : "1P";
  return ZONE_DURATIONS[zone] * 60;
};

const getSessionRemaining = (session) => {
  const parsedRemaining = Number(session?.remaining);
  if (Number.isFinite(parsedRemaining)) {
    return Math.max(0, parsedRemaining);
  }

  return getSessionTotalDuration(session);
};

const getSessionHasStarted = (session) => {
  const totalDuration = getSessionTotalDuration(session);
  return Boolean(session?.running) || getSessionRemaining(session) < totalDuration;
};

const getSessionStatusLabel = (session, kind) => {
  const remaining = getSessionRemaining(session);
  const isWarning = remaining <= REMINDER_WARNING_SECONDS && remaining > 0;

  if (remaining <= 0) {
    return "Expired";
  }

  if (session?.running) {
    return isWarning ? "Move soon" : "Live session";
  }

  if (getSessionHasStarted(session)) {
    return "Paused";
  }

  return kind === "claimed" ? "Waiting for claim" : "Ready";
};

const getSessionStatusAccent = (session) => {
  const remaining = getSessionRemaining(session);
  const isWarning = remaining <= REMINDER_WARNING_SECONDS && remaining > 0;

  if (remaining <= 0) {
    return "#DC2626";
  }

  if (isWarning) {
    return BRAND_PALETTE.gold;
  }

  return session?.running ? BRAND_PALETTE.success : BRAND_PALETTE.accentBold;
};

function ZoneCard({ zone, selected, disabled, onPress }) {
  const meta = ZONE_META[zone];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(zone)}
      style={({ pressed }) => [
        styles.zoneCard,
        selected && styles.zoneCardSelected,
        disabled && styles.zoneCardDisabled,
        { opacity: pressed ? 0.96 : 1 },
      ]}
    >
      <View
        style={[
          styles.zoneCardAccent,
          { backgroundColor: selected ? meta.accent : meta.soft },
        ]}
      />
      <Text style={[styles.zoneCardZone, selected && styles.zoneCardZoneSelected]}>
        {zone}
      </Text>
      <Text style={styles.zoneCardTitle}>{meta.title}</Text>
      <Text style={styles.zoneCardSubtitle}>{meta.subtitle}</Text>
      <Text style={[styles.zoneCardDuration, { color: meta.accent }]}>
        {formatShortDuration(ZONE_DURATIONS[zone])}
      </Text>
    </Pressable>
  );
}

function StatTile({ label, value, accent, tone = "light" }) {
  return (
    <View
      style={[
        styles.statTile,
        tone === "dark" ? styles.statTileDark : styles.statTileLight,
      ]}
    >
      <View style={[styles.statTileAccent, { backgroundColor: accent }]} />
      <Text style={[styles.statTileValue, tone === "dark" && styles.statTileValueDark]}>
        {value}
      </Text>
      <Text style={[styles.statTileLabel, tone === "dark" && styles.statTileLabelDark]}>
        {label}
      </Text>
    </View>
  );
}

function TimerModeCard({
  kind,
  active,
  session,
  onPress,
}) {
  const meta = TIMER_KIND_META[kind];
  const zone = session?.zone || "1P";
  const zoneMeta = ZONE_META[zone] || ZONE_META["1P"];
  const statusLabel = getSessionStatusLabel(session, kind);
  const remaining = getSessionRemaining(session);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(kind)}
      style={({ pressed }) => [
        styles.modeCard,
        active && styles.modeCardActive,
        { opacity: pressed ? 0.96 : 1 },
      ]}
    >
      <View style={styles.modeCardTopRow}>
        <Text style={styles.modeCardEyebrow}>{meta.eyebrow}</Text>
        <View
          style={[
            styles.modeBadge,
            { backgroundColor: active ? zoneMeta.accent : zoneMeta.soft },
          ]}
        >
          <Text
            style={[
              styles.modeBadgeText,
              { color: active ? "#FFFFFF" : zoneMeta.accent },
            ]}
          >
            {meta.badge}
          </Text>
        </View>
      </View>
      <Text style={styles.modeCardTitle}>{meta.label}</Text>
      <Text style={styles.modeCardDescription}>{meta.description}</Text>
      <View style={styles.modeCardMetaRow}>
        <Text style={styles.modeCardMeta}>{zone}</Text>
        <Text style={styles.modeCardMeta}>{statusLabel}</Text>
        <Text style={styles.modeCardMeta}>{formatTime(remaining)}</Text>
      </View>
    </Pressable>
  );
}

export default function TimerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const autoStartTimeoutRef = useRef(null);
  const hasHydratedTimerRef = useRef(false);
  const lastHandledAutoStartKeyRef = useRef(null);

  const { data: user } = useUser();
  const userId = user?.id;

  const [activeTimerKind, setActiveTimerKind] = useState("manual");
  const [timerSessions, setTimerSessions] = useState({
    manual: createDefaultTimerSession("1P"),
    claimed: createDefaultTimerSession("1P"),
  });

  const { data: profileData } = useQuery({
    queryKey: ["user_profile", userId],
    queryFn: async () => {
      const response = await fetch("/api/users/profile");
      if (!response.ok) throw new Error("Failed to fetch profile");
      const result = await response.json();
      return result.user;
    },
    enabled: Boolean(userId),
    cacheTime: 1000 * 60,
    staleTime: 1000 * 60,
  });

  const claimCount = profileData?.total_claims || 0;
  const preferredZone = useMemo(() => getPreferredZone(claimCount), [claimCount]);
  const timerNotificationsUnsupported =
    notificationsUnsupportedInCurrentRuntime || (isExpoGo && Platform.OS === "ios");

  const activeSession = timerSessions[activeTimerKind];
  const selectedZone = activeSession.zone;
  const timeRemaining = getSessionRemaining(activeSession);
  const isRunning = activeSession.running;
  const zoneMeta = ZONE_META[selectedZone] || ZONE_META["1P"];
  const totalDurationSeconds = getSessionTotalDuration(activeSession);
  const progress = Math.min(
    1,
    Math.max(0, 1 - timeRemaining / Math.max(totalDurationSeconds, 1)),
  );
  const percentRemaining = Math.round((timeRemaining / Math.max(totalDurationSeconds, 1)) * 100);
  const isWarning = timeRemaining <= REMINDER_WARNING_SECONDS && timeRemaining > 0;
  const statusLabel = getSessionStatusLabel(activeSession, activeTimerKind);
  const statusAccent = getSessionStatusAccent(activeSession);
  const reminderLabel = timerNotificationsUnsupported
    ? "Dev build required"
    : activeSession.hasReminder
      ? "30/15/0 reminders ready"
      : activeSession.running
        ? "Checking reminder"
        : "Reminder idle";
  const sessionHasStarted = getSessionHasStarted(activeSession);
  const canStartActiveSession =
    activeTimerKind === "manual" || activeSession.hasManualZoneChoice || sessionHasStarted;
  const heroActiveLabel = TIMER_KIND_META[activeTimerKind].label;

  useEffect(() => {
    if (!hasHydratedTimerRef.current) {
      return;
    }

    AsyncStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(timerSessions)).catch((error) => {
      console.error("Error saving timer sessions:", error);
    });
  }, [timerSessions]);

  useEffect(() => {
    if (!hasHydratedTimerRef.current) {
      return;
    }

    const manualSession = timerSessions.manual;
    if (
      manualSession.hasManualZoneChoice ||
      manualSession.running ||
      getSessionHasStarted(manualSession)
    ) {
      return;
    }

    if (!preferredZone || preferredZone === manualSession.zone) {
      return;
    }

    setTimerSessions((current) => ({
      ...current,
      manual: {
        ...current.manual,
        zone: preferredZone,
        remaining: ZONE_DURATIONS[preferredZone] * 60,
      },
    }));
  }, [preferredZone, timerSessions.manual]);

  const cancelTimerNotifications = useCallback(async (notificationIds = []) => {
    const Notifications = await getNotificationsModule();
    if (!Notifications || !Array.isArray(notificationIds) || notificationIds.length === 0) {
      return;
    }

    await Promise.all(
      notificationIds.map((notificationId) =>
        Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => null),
      ),
    );
  }, []);

  const scheduleTimerNotifications = useCallback(
    async (kind, durationSeconds, zone) => {
      if (timerNotificationsUnsupported) {
        return [];
      }

      const Notifications = await getNotificationsModule();
      if (!Notifications) {
        return [];
      }

      try {
        await ensureAlertsNotificationChannel();

        const kindLabel =
          kind === "manual" ? "Manual parking timer" : "Claimed spot timer";
        const zoneLabel = zone || "parking";
        const notificationIds = [];

        const startNotificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: `${kindLabel} started`,
            body: `${zoneLabel} is running. You'll get alerts at 30 minutes left, 15 minutes left, and when it expires.`,
            sound: true,
          },
          trigger: null,
        });
        notificationIds.push(startNotificationId);

        const triggerBase = {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          channelId: "alerts",
        };

        for (const reminderMinutes of REMINDER_MINUTES) {
          const secondsUntilReminder = durationSeconds - reminderMinutes * 60;

          if (secondsUntilReminder <= 0) {
            continue;
          }

          const reminderId = await Notifications.scheduleNotificationAsync({
            content: {
              title: `${kindLabel} warning`,
              body: `${zoneLabel} expires in ${reminderMinutes} minutes.`,
              sound: true,
            },
            trigger: {
              ...triggerBase,
              seconds: secondsUntilReminder,
            },
          });

          notificationIds.push(reminderId);
        }

        const expiryId = await Notifications.scheduleNotificationAsync({
          content: {
            title: `${kindLabel} expired`,
            body: `${zoneLabel} has expired. Move your vehicle to avoid a fine.`,
            sound: true,
          },
          trigger: {
            ...triggerBase,
            seconds: durationSeconds,
          },
        });
        notificationIds.push(expiryId);

        return notificationIds;
      } catch (error) {
        console.error("Error scheduling timer notifications:", error);
        return [];
      }
    },
    [timerNotificationsUnsupported],
  );

  const handleTimerExpired = useCallback(
    async (kind, expiredSession) => {
      await cancelTimerNotifications(expiredSession?.notificationIds || []);

      const timerLabel =
        kind === "manual" ? "Manual timer" : "Claimed spot timer";

      Alert.alert(
        "Time's up",
        `${timerLabel} has expired. Move your vehicle to avoid a fine.`,
      );
    },
    [cancelTimerNotifications],
  );

  const loadTimerState = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem(TIMER_STORAGE_KEY);
      const legacySaved = !saved ? await AsyncStorage.getItem("parkingTimer") : null;
      const now = Date.now();

      const normalizeSession = (session, fallbackZone = "1P") => {
        const safeZone = ZONE_DURATIONS[session?.zone] ? session.zone : fallbackZone;
        const defaultRemaining = ZONE_DURATIONS[safeZone] * 60;
        const notificationIds = Array.isArray(session?.notificationIds)
          ? session.notificationIds.filter(Boolean)
          : [];

        if (session?.running && Number.isFinite(Number(session?.endsAt))) {
          const adjustedRemaining = Math.max(
            0,
            Math.ceil((Number(session.endsAt) - now) / 1000),
          );

          if (adjustedRemaining > 0) {
            return createDefaultTimerSession(safeZone, {
              zone: safeZone,
              remaining: adjustedRemaining,
              running: true,
              endsAt: Number(session.endsAt),
              hasReminder: !timerNotificationsUnsupported && notificationIds.length > 0,
              hasManualZoneChoice: Boolean(session?.hasManualZoneChoice),
              notificationIds,
            });
          }
        }

        return createDefaultTimerSession(safeZone, {
          zone: safeZone,
          remaining: Number.isFinite(Number(session?.remaining))
            ? Math.max(0, Number(session.remaining))
            : defaultRemaining,
          running: false,
          endsAt: null,
          hasReminder: false,
          hasManualZoneChoice: Boolean(session?.hasManualZoneChoice),
          notificationIds: [],
        });
      };

      let nextSessions = {
        manual: createDefaultTimerSession("1P"),
        claimed: createDefaultTimerSession("1P"),
      };

      if (saved) {
        const parsed = JSON.parse(saved);
        nextSessions = {
          manual: normalizeSession(parsed?.manual, "1P"),
          claimed: normalizeSession(parsed?.claimed, "1P"),
        };
      } else if (legacySaved) {
        const parsedLegacy = JSON.parse(legacySaved);
        if (isLegacyTimerState(parsedLegacy)) {
          nextSessions = {
            manual: normalizeSession(
              {
                zone: parsedLegacy.zone,
                remaining: parsedLegacy.remaining,
                running: parsedLegacy.running,
                endsAt:
                  parsedLegacy.running && Number(parsedLegacy.start)
                    ? Number(parsedLegacy.start) + (Number(parsedLegacy.remaining) || 0) * 1000
                    : null,
                hasManualZoneChoice: true,
              },
              "1P",
            ),
            claimed: createDefaultTimerSession("1P"),
          };
        }
      }

      setTimerSessions(nextSessions);
    } catch (error) {
      console.error("Error loading timer state:", error);
    } finally {
      hasHydratedTimerRef.current = true;
    }
  }, [timerNotificationsUnsupported]);

  useEffect(() => {
    (async () => {
      await configureNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: !(isExpoGo && Platform.OS === "ios"),
          shouldShowList: !(isExpoGo && Platform.OS === "ios"),
          shouldPlaySound: !(isExpoGo && Platform.OS === "ios"),
          shouldSetBadge: false,
        }),
      });

      if (timerNotificationsUnsupported) {
        return;
      }

      const Notifications = await getNotificationsModule();
      if (!Notifications) {
        return;
      }

      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Notification Permission",
          "Please enable notifications to receive parking timer alerts.",
        );
      }
    })();

    loadTimerState();

    return () => {
      if (autoStartTimeoutRef.current) {
        clearTimeout(autoStartTimeoutRef.current);
      }
    };
  }, [loadTimerState, timerNotificationsUnsupported]);

  useEffect(() => {
    if (params.autoStart !== "true" || !params.zoneType || !ZONE_DURATIONS[params.zoneType]) {
      lastHandledAutoStartKeyRef.current = null;
      return;
    }

    const zoneType = params.zoneType;
    const autoStartKey = `${params.autoStart}:${zoneType}`;

    if (lastHandledAutoStartKeyRef.current === autoStartKey) {
      return;
    }

    lastHandledAutoStartKeyRef.current = autoStartKey;
    setActiveTimerKind("claimed");

    autoStartTimeoutRef.current = setTimeout(async () => {
      const existingClaimedSession = timerSessions.claimed;
      await cancelTimerNotifications(existingClaimedSession?.notificationIds || []);

      const duration = ZONE_DURATIONS[zoneType] * 60;
      const endsAt = Date.now() + duration * 1000;
      const notificationIds = await scheduleTimerNotifications("claimed", duration, zoneType);

      setTimerSessions((current) => ({
        ...current,
        claimed: {
          zone: zoneType,
          remaining: duration,
          running: true,
          endsAt,
          hasReminder: notificationIds.length > 0,
          hasManualZoneChoice: true,
          notificationIds,
        },
      }));
    }, 450);

    return () => {
      if (autoStartTimeoutRef.current) {
        clearTimeout(autoStartTimeoutRef.current);
      }
    };
  }, [
    cancelTimerNotifications,
    params.autoStart,
    params.zoneType,
    scheduleTimerNotifications,
    timerSessions.claimed,
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const expiredSessions = [];

      setTimerSessions((current) => {
        let didChange = false;
        const next = { ...current };

        for (const kind of TIMER_KIND_ORDER) {
          const session = current[kind];
          if (!session.running || !Number.isFinite(Number(session.endsAt))) {
            continue;
          }

          const nextRemaining = Math.max(
            0,
            Math.ceil((Number(session.endsAt) - now) / 1000),
          );

          if (nextRemaining <= 0) {
            expiredSessions.push({ kind, session });
            next[kind] = {
              ...session,
              remaining: 0,
              running: false,
              endsAt: null,
              hasReminder: false,
              notificationIds: [],
            };
            didChange = true;
            continue;
          }

          if (nextRemaining !== session.remaining) {
            next[kind] = {
              ...session,
              remaining: nextRemaining,
            };
            didChange = true;
          }
        }

        return didChange ? next : current;
      });

      if (expiredSessions.length > 0) {
        expiredSessions.forEach(({ kind, session }) => {
          handleTimerExpired(kind, session);
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [handleTimerExpired]);

  const handleReset = useCallback(async () => {
    const sessionToReset = timerSessions[activeTimerKind];
    await cancelTimerNotifications(sessionToReset.notificationIds || []);

    setTimerSessions((current) => ({
      ...current,
      [activeTimerKind]: {
        ...createDefaultTimerSession(current[activeTimerKind].zone),
        zone: current[activeTimerKind].zone,
        hasManualZoneChoice: current[activeTimerKind].hasManualZoneChoice,
      },
    }));
  }, [activeTimerKind, cancelTimerNotifications, timerSessions]);

  const handleStart = useCallback(async () => {
    const currentSession = timerSessions[activeTimerKind];
    await cancelTimerNotifications(currentSession.notificationIds || []);

    const endsAt = Date.now() + currentSession.remaining * 1000;
    const notificationIds = await scheduleTimerNotifications(
      activeTimerKind,
      currentSession.remaining,
      currentSession.zone,
    );

    setTimerSessions((current) => ({
      ...current,
      [activeTimerKind]: {
        ...current[activeTimerKind],
        running: true,
        endsAt,
        hasReminder: notificationIds.length > 0,
        notificationIds,
      },
    }));

    if (notificationIds.length === 0 && timerNotificationsUnsupported) {
      Alert.alert(
        "Timer Started",
        "The parking timer is running, but reminder notifications are unavailable in Expo Go. Use a development build to test alerts.",
      );
    }
  }, [
    activeTimerKind,
    cancelTimerNotifications,
    scheduleTimerNotifications,
    timerNotificationsUnsupported,
    timerSessions,
  ]);

  const handlePause = useCallback(async () => {
    const currentSession = timerSessions[activeTimerKind];
    await cancelTimerNotifications(currentSession.notificationIds || []);

    setTimerSessions((current) => ({
      ...current,
      [activeTimerKind]: {
        ...current[activeTimerKind],
        running: false,
        endsAt: null,
        hasReminder: false,
        notificationIds: [],
      },
    }));
  }, [activeTimerKind, cancelTimerNotifications, timerSessions]);

  const handleZoneSelect = useCallback(
    (zone) => {
      if (activeTimerKind !== "manual") {
        Alert.alert(
          "Claimed timer is automatic",
          "The claimed spot timer follows the zone type from the parking spot you claimed.",
        );
        return;
      }

      if (zone === selectedZone) {
        return;
      }

      if (isRunning) {
        Alert.alert(
          "Timer running",
          "Pause or reset the manual timer before switching to another parking zone.",
        );
        return;
      }

      setTimerSessions((current) => ({
        ...current,
        manual: {
          ...current.manual,
          zone,
          remaining: ZONE_DURATIONS[zone] * 60,
          running: false,
          endsAt: null,
          hasReminder: false,
          hasManualZoneChoice: true,
          notificationIds: [],
        },
      }));
    },
    [activeTimerKind, isRunning, selectedZone],
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 10,
          paddingBottom: insets.bottom + 104,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.shell}>
          <LinearGradient
            colors={["#082032", "#0B1F33", "#0D5A87"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroGlowLarge} />
            <View style={styles.heroGlowSmall} />

            <View style={styles.heroTopRow}>
              <View style={styles.heroBadge}>
                <Sparkles size={14} color="#FFFFFF" />
                <Text style={styles.heroBadgeText}>{heroActiveLabel}</Text>
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={() => router.navigate("/")}
                style={({ pressed }) => [
                  styles.mapButton,
                  { opacity: pressed ? 0.92 : 1 },
                ]}
              >
                <MapPin size={15} color="#FFFFFF" />
                <Text style={styles.mapButtonText}>Map</Text>
              </Pressable>
            </View>

            <Text style={styles.heroTitle}>Stay ahead of the limit</Text>
            <Text style={styles.heroSubtitle}>
              Run a manual parking timer whenever you need one, while keeping the claimed spot timer separate for auto-start sessions.
            </Text>

            <View style={styles.heroStatsRow}>
              <StatTile
                label="Recommended"
                value={preferredZone}
                accent={zoneMeta.accent}
                tone="dark"
              />
              <StatTile
                label="Claims"
                value={String(claimCount)}
                accent={BRAND_PALETTE.gold}
                tone="dark"
              />
              <StatTile
                label="Active Mode"
                value={TIMER_KIND_META[activeTimerKind].badge}
                accent={BRAND_PALETTE.success}
                tone="dark"
              />
            </View>
          </LinearGradient>

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>Timer Mode</Text>
              <Text style={styles.sectionTitle}>Choose your timer lane</Text>
            </View>
            <Text style={styles.sectionHint}>Both timers save separately</Text>
          </View>

          <View style={styles.modeCardGrid}>
            {TIMER_KIND_ORDER.map((kind) => (
              <TimerModeCard
                key={kind}
                kind={kind}
                active={activeTimerKind === kind}
                session={timerSessions[kind]}
                onPress={setActiveTimerKind}
              />
            ))}
          </View>

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>Zone Setup</Text>
              <Text style={styles.sectionTitle}>
                {activeTimerKind === "manual" ? "Pick your parking limit" : "Claimed spot zone"}
              </Text>
            </View>
            <Text style={styles.sectionHint}>
              {activeTimerKind === "manual"
                ? isRunning
                  ? "Locked while timer is live"
                  : "Tap to change"
                : "Auto-set from claim"}
            </Text>
          </View>

          <View style={styles.zoneGrid}>
            {ZONE_ORDER.map((zone) => (
              <ZoneCard
                key={zone}
                zone={zone}
                selected={selectedZone === zone}
                disabled={activeTimerKind !== "manual" || isRunning}
                onPress={handleZoneSelect}
              />
            ))}
          </View>

          <LinearGradient
            colors={isWarning ? ["#FFF6DB", "#FFFDF6"] : ["#FFFFFF", "#F4FAFF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.timerStage}
          >
            <View style={styles.timerStageHeader}>
              <View style={[styles.statusPill, { backgroundColor: zoneMeta.soft }]}>
                <View style={[styles.statusDot, { backgroundColor: statusAccent }]} />
                <Text style={[styles.statusPillText, { color: statusAccent }]}>
                  {statusLabel}
                </Text>
              </View>

              <View style={styles.zoneCapsule}>
                <Text style={styles.zoneCapsuleText}>
                  {selectedZone} • {TIMER_KIND_META[activeTimerKind].badge}
                </Text>
              </View>
            </View>

            <View style={styles.timerOrbWrap}>
              <View
                style={[
                  styles.timerOrbShadow,
                  {
                    backgroundColor: isWarning
                      ? "rgba(245, 158, 11, 0.18)"
                      : "rgba(2, 132, 199, 0.16)",
                  },
                ]}
              />
              <LinearGradient
                colors={isWarning ? ["#FFF7E1", "#FFFFFF"] : ["#F7FCFF", "#FFFFFF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.timerOrb, isWarning && styles.timerOrbWarning]}
              >
                <Clock3
                  size={34}
                  color={isWarning ? BRAND_PALETTE.gold : zoneMeta.accent}
                />
                <Text style={[styles.timerValue, isWarning && styles.timerValueWarning]}>
                  {formatTime(timeRemaining)}
                </Text>
                <Text style={styles.timerCaption}>
                  {isRunning ? "time remaining" : sessionHasStarted ? "paused session" : "session length"}
                </Text>
              </LinearGradient>
            </View>

            <View style={styles.progressMeta}>
              <Text style={styles.progressLabel}>Session progress</Text>
              <Text style={styles.progressPercent}>
                {progress === 0 ? "Fresh start" : `${percentRemaining}% left`}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={
                  isWarning
                    ? ["#FBBF24", "#F59E0B"]
                    : [zoneMeta.accent, BRAND_PALETTE.accentBold]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.progressFill,
                  { width: `${Math.max(progress * 100, 6)}%` },
                ]}
              />
            </View>

            <View style={styles.timerFactsRow}>
              <StatTile
                label="Reminder"
                value={reminderLabel}
                accent={BRAND_PALETTE.accentBold}
              />
              <StatTile
                label="Zone mood"
                value={zoneMeta.title}
                accent={zoneMeta.accent}
              />
            </View>
          </LinearGradient>

          <View style={styles.actionRow}>
            {!isRunning ? (
              <Pressable
                accessibilityRole="button"
                onPress={canStartActiveSession ? handleStart : undefined}
                style={({ pressed }) => [
                  styles.primaryActionWrap,
                  !canStartActiveSession && styles.primaryActionDisabledWrap,
                  { opacity: pressed ? 0.95 : 1 },
                ]}
                disabled={!canStartActiveSession}
              >
                <LinearGradient
                  colors={
                    canStartActiveSession
                      ? ["#10B981", "#0F9F6E"]
                      : ["#94A3B8", "#64748B"]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryAction}
                >
                  <Play size={20} color="#FFFFFF" />
                  <Text style={styles.primaryActionText}>
                    {canStartActiveSession
                      ? sessionHasStarted
                        ? "Resume session"
                        : "Start timer"
                      : "Claim a spot first"}
                  </Text>
                </LinearGradient>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={handlePause}
                style={({ pressed }) => [
                  styles.primaryActionWrap,
                  { opacity: pressed ? 0.95 : 1 },
                ]}
              >
                <LinearGradient
                  colors={["#F59E0B", "#D97706"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryAction}
                >
                  <Pause size={20} color="#FFFFFF" />
                  <Text style={styles.primaryActionText}>Pause session</Text>
                </LinearGradient>
              </Pressable>
            )}

            <Pressable
              accessibilityRole="button"
              onPress={handleReset}
              style={({ pressed }) => [
                styles.secondaryAction,
                { opacity: pressed ? 0.94 : 1 },
              ]}
            >
              <RotateCcw size={18} color={BRAND_PALETTE.muted} />
              <Text style={styles.secondaryActionText}>Reset</Text>
            </Pressable>
          </View>

          <View style={styles.tipCard}>
            <View style={styles.tipIconWrap}>
              <BellRing size={18} color={BRAND_PALETTE.accentBold} />
            </View>
            <View style={styles.tipCopy}>
              <Text style={styles.tipTitle}>Reminder logic</Text>
              <Text style={styles.tipText}>
                Each timer keeps its own reminder schedule: a start alert, then warnings at 30 minutes left and 15 minutes left, then a final expiry alert.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#EAF6FF",
  },
  shell: {
    paddingHorizontal: 16,
  },
  heroCard: {
    overflow: "hidden",
    borderRadius: 32,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    shadowColor: "#082032",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
  heroGlowLarge: {
    position: "absolute",
    top: -26,
    right: -34,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: "rgba(125, 211, 252, 0.18)",
  },
  heroGlowSmall: {
    position: "absolute",
    left: -14,
    bottom: -24,
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },
  mapButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  mapButtonText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  heroTitle: {
    marginTop: 16,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  heroSubtitle: {
    marginTop: 8,
    maxWidth: 300,
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(255,255,255,0.76)",
  },
  heroStatsRow: {
    marginTop: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statTile: {
    flex: 1,
    minWidth: 88,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  statTileDark: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  statTileLight: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8EAF6",
  },
  statTileAccent: {
    width: 20,
    height: 4,
    borderRadius: 999,
    marginBottom: 8,
  },
  statTileValue: {
    fontSize: 14,
    lineHeight: 17,
    fontWeight: "900",
    color: BRAND_PALETTE.deepNavy,
  },
  statTileValueDark: {
    color: "#FFFFFF",
  },
  statTileLabel: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "700",
    color: BRAND_PALETTE.muted,
  },
  statTileLabelDark: {
    color: "rgba(255,255,255,0.72)",
  },
  sectionHeader: {
    marginTop: 18,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: BRAND_PALETTE.accentBold,
  },
  sectionTitle: {
    marginTop: 4,
    fontSize: 19,
    fontWeight: "900",
    color: BRAND_PALETTE.deepNavy,
  },
  sectionHint: {
    fontSize: 11,
    fontWeight: "700",
    color: BRAND_PALETTE.muted,
  },
  modeCardGrid: {
    gap: 10,
  },
  modeCard: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8EAF6",
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: "#0B1F33",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  modeCardActive: {
    borderColor: BRAND_PALETTE.accentBold,
    backgroundColor: "#F4FAFF",
  },
  modeCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  modeCardEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: BRAND_PALETTE.accentBold,
  },
  modeBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: "900",
  },
  modeCardTitle: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: "900",
    color: BRAND_PALETTE.deepNavy,
  },
  modeCardDescription: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    color: BRAND_PALETTE.muted,
  },
  modeCardMetaRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  modeCardMeta: {
    borderRadius: 999,
    backgroundColor: "#EEF7FD",
    color: BRAND_PALETTE.navy,
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  zoneGrid: {
    flexDirection: "row",
    gap: 8,
  },
  zoneCard: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8EAF6",
    paddingHorizontal: 12,
    paddingVertical: 12,
    shadowColor: "#0B1F33",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  zoneCardSelected: {
    borderColor: BRAND_PALETTE.accentBold,
    backgroundColor: "#F4FAFF",
  },
  zoneCardDisabled: {
    opacity: 0.68,
  },
  zoneCardAccent: {
    width: 22,
    height: 4,
    borderRadius: 999,
    marginBottom: 10,
  },
  zoneCardZone: {
    fontSize: 19,
    fontWeight: "900",
    color: BRAND_PALETTE.deepNavy,
  },
  zoneCardZoneSelected: {
    color: BRAND_PALETTE.accentBold,
  },
  zoneCardTitle: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: "800",
    color: BRAND_PALETTE.navy,
  },
  zoneCardSubtitle: {
    marginTop: 4,
    fontSize: 10,
    lineHeight: 14,
    color: BRAND_PALETTE.muted,
    minHeight: 28,
  },
  zoneCardDuration: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  timerStage: {
    marginTop: 18,
    borderRadius: 32,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 20,
    borderWidth: 1,
    borderColor: "#D8EAF6",
    shadowColor: "#0B1F33",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 5,
  },
  timerStageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "800",
  },
  zoneCapsule: {
    borderRadius: 999,
    backgroundColor: BRAND_PALETTE.deepNavy,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  zoneCapsuleText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  timerOrbWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    marginBottom: 16,
  },
  timerOrbShadow: {
    position: "absolute",
    width: 244,
    height: 244,
    borderRadius: 122,
  },
  timerOrb: {
    width: 228,
    height: 228,
    borderRadius: 114,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 8,
    borderColor: "#CBEAFC",
  },
  timerOrbWarning: {
    borderColor: "#FBD38D",
  },
  timerValue: {
    marginTop: 12,
    fontSize: 42,
    fontWeight: "900",
    color: BRAND_PALETTE.deepNavy,
    letterSpacing: -1.2,
  },
  timerValueWarning: {
    color: "#B45309",
  },
  timerCaption: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "700",
    color: BRAND_PALETTE.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  progressMeta: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: BRAND_PALETTE.muted,
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: "800",
    color: BRAND_PALETTE.navy,
  },
  progressTrack: {
    marginTop: 10,
    height: 12,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#DFEEF8",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  timerFactsRow: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  actionRow: {
    marginTop: 18,
    gap: 12,
  },
  primaryActionWrap: {
    borderRadius: 20,
    overflow: "hidden",
  },
  primaryActionDisabledWrap: {
    opacity: 0.76,
  },
  primaryAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
    borderRadius: 20,
  },
  primaryActionText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  secondaryAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8EAF6",
    paddingVertical: 16,
  },
  secondaryActionText: {
    fontSize: 15,
    fontWeight: "800",
    color: BRAND_PALETTE.muted,
  },
  tipCard: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8EAF6",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  tipIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  tipCopy: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: BRAND_PALETTE.deepNavy,
  },
  tipText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: BRAND_PALETTE.muted,
  },
});
