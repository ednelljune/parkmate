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
import Slider from "@react-native-community/slider";
import fetch from "@/__create/fetch";
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
import { ShiningProBadge } from "@/components/paywall/ShiningProBadge";
import { useProAccess } from "@/hooks/useProAccess";
import useUser from "@/utils/auth/useUser";
import { BRAND_PALETTE } from "@/theme/brandColors";

const TIMER_STORAGE_KEY = "parkingTimers";
const TIMER_REMINDER_PRESET_STORAGE_KEY = "parkingTimerReminderPreset";
const MANUAL_HOUR_MIN = 1;
const MANUAL_HOUR_MAX = 12;

const ZONE_DURATIONS = {
  "1P": 60,
  "2P": 120,
  "3P": 180,
};

const ZONE_META = {
  "1P": {
    title: "Quick Stop",
    accent: "#0EA5E9",
    soft: "#DBF0FF",
  },
  "2P": {
    title: "City Cruise",
    accent: "#10B981",
    soft: "#DDF8EC",
  },
  "3P": {
    title: "Long Stay",
    accent: "#F59E0B",
    soft: "#FFF1CF",
  },
};

const DEFAULT_REMINDER_PRESET_KEY = "standard";
const REMINDER_PRESETS = [
  {
    key: DEFAULT_REMINDER_PRESET_KEY,
    label: "30m + 15m",
    shortLabel: "30/15/0 reminders",
    minutes: [30, 15],
    pro: false,
  },
  {
    key: "commuter",
    label: "20m + 10m",
    shortLabel: "20/10/0 reminders",
    minutes: [20, 10],
    pro: true,
  },
  {
    key: "tight_window",
    label: "15m + 5m",
    shortLabel: "15/5/0 reminders",
    minutes: [15, 5],
    pro: true,
  },
  {
    key: "final_warning",
    label: "Final warning only",
    shortLabel: "0 reminder only",
    minutes: [],
    pro: true,
  },
];

const formatTime = (seconds) => {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;

  return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
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

const getZoneDurationSeconds = (zone) =>
  (ZONE_DURATIONS[zone] || ZONE_DURATIONS["1P"]) * 60;

const clampManualHours = (value) =>
  Math.max(MANUAL_HOUR_MIN, Math.min(MANUAL_HOUR_MAX, Math.round(Number(value) || MANUAL_HOUR_MIN)));

const manualHoursToSeconds = (hours) => clampManualHours(hours) * 3600;

const createManualSession = (overrides = {}) => ({
  selectedHours: 1,
  durationSeconds: 3600,
  remaining: 3600,
  running: false,
  endsAt: null,
  hasReminder: false,
  notificationIds: [],
  hasManualChoice: false,
  ...overrides,
});

const createClaimedSession = (overrides = {}) => ({
  zone: "1P",
  durationSeconds: getZoneDurationSeconds("1P"),
  remaining: getZoneDurationSeconds("1P"),
  running: false,
  endsAt: null,
  hasReminder: false,
  notificationIds: [],
  isSeeded: false,
  ...overrides,
});

const getSessionRemaining = (session) => {
  const parsedRemaining = Number(session?.remaining);
  if (Number.isFinite(parsedRemaining)) {
    return Math.max(0, parsedRemaining);
  }

  const parsedDuration = Number(session?.durationSeconds);
  if (Number.isFinite(parsedDuration)) {
    return Math.max(0, parsedDuration);
  }

  return 0;
};

const getSessionDuration = (session) => {
  const parsedDuration = Number(session?.durationSeconds);
  if (Number.isFinite(parsedDuration)) {
    return Math.max(0, parsedDuration);
  }

  return getSessionRemaining(session);
};

const getSessionProgress = (session) => {
  const duration = Math.max(1, getSessionDuration(session));
  const remaining = getSessionRemaining(session);
  return Math.min(1, Math.max(0, 1 - remaining / duration));
};

const getReminderPresetByKey = (presetKey) =>
  REMINDER_PRESETS.find((preset) => preset.key === presetKey) || REMINDER_PRESETS[0];

const getReminderWarningSeconds = (presetKey) => {
  const preset = getReminderPresetByKey(presetKey);
  const warningMinutes = preset.minutes[preset.minutes.length - 1];

  return Number.isFinite(Number(warningMinutes)) ? Number(warningMinutes) * 60 : 0;
};

const getSessionStatusLabel = (session, warningSeconds = 0) => {
  const remaining = getSessionRemaining(session);
  const isWarning = warningSeconds > 0 && remaining <= warningSeconds && remaining > 0;

  if (remaining <= 0) {
    return "Expired";
  }

  if (session?.running) {
    return isWarning ? "Move soon" : "Running";
  }

  if (remaining < getSessionDuration(session)) {
    return "Paused";
  }

  return "Ready";
};

const getSessionStatusAccent = (session, warningSeconds = 0) => {
  const remaining = getSessionRemaining(session);
  const isWarning = warningSeconds > 0 && remaining <= warningSeconds && remaining > 0;

  if (remaining <= 0) {
    return "#DC2626";
  }

  if (isWarning) {
    return BRAND_PALETTE.gold;
  }

  return session?.running ? BRAND_PALETTE.success : BRAND_PALETTE.accentBold;
};

function SessionCard({
  title,
  subtitle,
  statusLabel,
  statusAccent,
  timerText,
  progress,
  progressAccent,
  hintLabel,
  badgeLabel,
  onPrimary,
  primaryLabel,
  primaryDisabled = false,
  isRunning = false,
  onSecondary,
  secondaryLabel,
}) {
  return (
    <LinearGradient
      colors={["#FFFFFF", "#F4FAFF"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.sessionCard}
    >
      <View style={styles.sessionCardHeader}>
        <View>
          <Text style={styles.sessionCardTitle}>{title}</Text>
          <Text style={styles.sessionCardSubtitle}>{subtitle}</Text>
        </View>
        <View style={styles.sessionCardHeaderRight}>
          <Text style={[styles.sessionCardStatus, { color: statusAccent }]}>{statusLabel}</Text>
          {badgeLabel ? <Text style={styles.sessionCardBadge}>{badgeLabel}</Text> : null}
        </View>
      </View>

      <View style={styles.sessionCardTimerWrap}>
        <Clock3 size={30} color={progressAccent} />
        <Text style={styles.sessionCardTimerValue}>{timerText}</Text>
      </View>

      <View style={styles.progressTrack}>
        <LinearGradient
          colors={[progressAccent, BRAND_PALETTE.accentBold]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.progressFill,
            { width: `${Math.max(progress * 100, 6)}%` },
          ]}
        />
      </View>

      <Text style={styles.sessionCardHint}>{hintLabel}</Text>

      <View style={styles.sessionCardActions}>
        <Pressable
          accessibilityRole="button"
          onPress={primaryDisabled ? undefined : onPrimary}
          disabled={primaryDisabled}
          style={({ pressed }) => [
            styles.primaryActionWrap,
            primaryDisabled && styles.primaryActionDisabledWrap,
            { opacity: pressed ? 0.95 : 1 },
          ]}
        >
          <LinearGradient
            colors={
              primaryDisabled
                ? ["#94A3B8", "#64748B"]
                : ["#10B981", "#0F9F6E"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryAction}
          >
            {isRunning ? (
              <Pause size={20} color="#FFFFFF" />
            ) : (
              <Play size={20} color="#FFFFFF" />
            )}
            <Text style={styles.primaryActionText}>{primaryLabel}</Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={onSecondary}
          style={({ pressed }) => [
            styles.secondaryAction,
            { opacity: pressed ? 0.94 : 1 },
          ]}
        >
          <RotateCcw size={18} color={BRAND_PALETTE.muted} />
          <Text style={styles.secondaryActionText}>{secondaryLabel}</Text>
        </Pressable>
      </View>
    </LinearGradient>
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
  const { hasPro, ensureProAccess } = useProAccess();

  const [timerSessions, setTimerSessions] = useState({
    manual: createManualSession(),
    claimed: createClaimedSession(),
  });
  const [selectedReminderPresetKey, setSelectedReminderPresetKey] = useState(
    DEFAULT_REMINDER_PRESET_KEY,
  );

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
  const selectedReminderPreset = useMemo(
    () => getReminderPresetByKey(selectedReminderPresetKey),
    [selectedReminderPresetKey],
  );
  const reminderWarningSeconds = useMemo(
    () => getReminderWarningSeconds(selectedReminderPresetKey),
    [selectedReminderPresetKey],
  );

  const manualSession = timerSessions.manual;
  const claimedSession = timerSessions.claimed;
  const claimedSessionVisible =
    hasPro && Boolean(claimedSession?.isSeeded) && getSessionRemaining(claimedSession) > 0;

  const manualSelectedSeconds = manualHoursToSeconds(manualSession.selectedHours);
  const manualPaused =
    !manualSession.running &&
    getSessionRemaining(manualSession) > 0 &&
    getSessionRemaining(manualSession) < getSessionDuration(manualSession);
  const manualDisplaySeconds =
    manualSession.running || manualPaused
      ? getSessionRemaining(manualSession)
      : manualSelectedSeconds;
  const manualProgress = getSessionProgress({
    ...manualSession,
    durationSeconds: Math.max(manualSelectedSeconds, getSessionDuration(manualSession), 1),
    remaining: manualDisplaySeconds,
  });
  const manualStatusLabel = getSessionStatusLabel({
    ...manualSession,
    durationSeconds: Math.max(manualSelectedSeconds, getSessionDuration(manualSession), 1),
    remaining: manualDisplaySeconds,
  }, reminderWarningSeconds);
  const manualStatusAccent = getSessionStatusAccent({
    ...manualSession,
    durationSeconds: Math.max(manualSelectedSeconds, getSessionDuration(manualSession), 1),
    remaining: manualDisplaySeconds,
  }, reminderWarningSeconds);
  const manualReminderLabel = timerNotificationsUnsupported
    ? "Dev build required"
    : manualSession.hasReminder
      ? `${selectedReminderPreset.shortLabel} ready`
      : manualSession.running
        ? "Checking reminder"
        : "Reminder idle";

  const claimedMeta = ZONE_META[claimedSession.zone] || ZONE_META["1P"];
  const claimedStatusLabel = getSessionStatusLabel(claimedSession, reminderWarningSeconds);
  const claimedStatusAccent = getSessionStatusAccent(claimedSession, reminderWarningSeconds);
  const claimedReminderLabel = timerNotificationsUnsupported
    ? "Dev build required"
    : claimedSession.hasReminder
      ? `${selectedReminderPreset.shortLabel} ready`
      : claimedSession.running
        ? "Checking reminder"
        : "Reminder idle";
  const premiumTimerHeadline = hasPro
    ? "Pro reminder mode is active"
    : "Unlock smarter reminder patterns";
  const premiumTimerCopy = hasPro
    ? "Your premium reminder setup is ready. Use the recommended presets below or jump straight into a claimed spot timer."
    : "Open ParkMate Pro to choose smarter warning patterns and unlock claimed-spot auto-start.";

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

    AsyncStorage.setItem(
      TIMER_REMINDER_PRESET_STORAGE_KEY,
      selectedReminderPresetKey,
    ).catch((error) => {
      console.error("Error saving reminder preset:", error);
    });
  }, [selectedReminderPresetKey]);

  useEffect(() => {
    if (!hasPro && getReminderPresetByKey(selectedReminderPresetKey).pro) {
      setSelectedReminderPresetKey(DEFAULT_REMINDER_PRESET_KEY);
    }
  }, [hasPro, selectedReminderPresetKey]);

  useEffect(() => {
    if (!hasHydratedTimerRef.current) {
      return;
    }

    if (manualSession.hasManualChoice || manualSession.running || getSessionRemaining(manualSession) > 0) {
      return;
    }

    const nextDuration = getZoneDurationSeconds(preferredZone);

    setTimerSessions((current) => ({
      ...current,
      manual: {
        ...current.manual,
        selectedHours: clampManualHours(nextDuration / 3600),
        durationSeconds: nextDuration,
        remaining: nextDuration,
      },
    }));
  }, [manualSession, preferredZone]);

  const cancelSessionNotifications = useCallback(async (notificationIds = []) => {
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

  const scheduleSessionNotifications = useCallback(
    async ({ titlePrefix, durationSeconds, bodyLabel }) => {
      if (timerNotificationsUnsupported) {
        return [];
      }

      const Notifications = await getNotificationsModule();
      if (!Notifications) {
        return [];
      }

      try {
        await ensureAlertsNotificationChannel();
        const notificationIds = [];

        const startNotificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: `${titlePrefix} started`,
            body: `${bodyLabel} is running. You'll get alerts at 30 minutes left, 15 minutes left, and when it expires.`,
            sound: true,
          },
          trigger: null,
        });
        notificationIds.push(startNotificationId);

        const triggerBase = {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          channelId: "alerts",
        };

        for (const reminderMinutes of selectedReminderPreset.minutes) {
          const secondsUntilReminder = durationSeconds - reminderMinutes * 60;
          if (secondsUntilReminder <= 0) {
            continue;
          }

          const reminderId = await Notifications.scheduleNotificationAsync({
            content: {
              title: `${titlePrefix} warning`,
              body: `${bodyLabel} expires in ${reminderMinutes} minutes.`,
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
            title: `${titlePrefix} expired`,
            body: `${bodyLabel} has expired. Move your vehicle to avoid a fine.`,
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
    [selectedReminderPreset.minutes, timerNotificationsUnsupported],
  );

  useEffect(() => {
    if (hasPro) {
      return;
    }

    const hasClaimedTimerState = Boolean(claimedSession?.isSeeded) || Boolean(claimedSession?.running);

    if (!hasClaimedTimerState) {
      return;
    }

    cancelSessionNotifications(claimedSession.notificationIds || []).catch(() => null);
    setTimerSessions((current) => ({
      ...current,
      claimed: createClaimedSession(),
    }));
  }, [
    cancelSessionNotifications,
    claimedSession?.isSeeded,
    claimedSession?.running,
    hasPro,
  ]);

  const loadTimerState = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem(TIMER_STORAGE_KEY);
      const legacySaved = !saved ? await AsyncStorage.getItem("parkingTimer") : null;
      const savedReminderPresetKey = await AsyncStorage.getItem(
        TIMER_REMINDER_PRESET_STORAGE_KEY,
      );
      const now = Date.now();

      const normalizeManualSession = (session) => {
        const storedDuration = Number.isFinite(Number(session?.durationSeconds))
          ? Math.max(0, Number(session.durationSeconds))
          : Number.isFinite(Number(session?.remaining))
            ? Math.max(0, Number(session.remaining))
            : session?.zone
              ? getZoneDurationSeconds(session.zone)
              : 0;
        const fallbackHours =
          Number.isFinite(Number(session?.pickerHours)) &&
          Number(session?.pickerHours) > 0
            ? Number(session.pickerHours)
            : storedDuration > 0
              ? storedDuration / 3600
              : MANUAL_HOUR_MIN;
        const selectedHours = clampManualHours(
          Number.isFinite(Number(session?.selectedHours))
            ? Number(session.selectedHours)
            : fallbackHours,
        );
        const durationSeconds = storedDuration > 0 ? storedDuration : manualHoursToSeconds(selectedHours);
        const pausedRemaining = Number.isFinite(Number(session?.remaining))
          ? Math.max(0, Math.min(durationSeconds, Number(session.remaining)))
          : durationSeconds;

        if (session?.running && Number.isFinite(Number(session?.endsAt))) {
          const adjustedRemaining = Math.max(
            0,
            Math.ceil((Number(session.endsAt) - now) / 1000),
          );

          return createManualSession({
            selectedHours,
            durationSeconds: durationSeconds || adjustedRemaining,
            remaining: adjustedRemaining,
            running: adjustedRemaining > 0,
            endsAt: adjustedRemaining > 0 ? Number(session.endsAt) : null,
            hasReminder: Boolean(session?.hasReminder),
            notificationIds: Array.isArray(session?.notificationIds) ? session.notificationIds : [],
            hasManualChoice: Boolean(session?.hasManualChoice || durationSeconds > 0),
          });
        }

        return createManualSession({
          selectedHours,
          durationSeconds,
          remaining: pausedRemaining,
          running: false,
          endsAt: null,
          hasReminder: false,
          notificationIds: [],
          hasManualChoice: Boolean(session?.hasManualChoice || durationSeconds > 0),
        });
      };

      const normalizeClaimedSession = (session) => {
        const safeZone = session?.zone && ZONE_DURATIONS[session.zone] ? session.zone : "1P";
        const durationSeconds = Number.isFinite(Number(session?.durationSeconds))
          ? Math.max(0, Number(session.durationSeconds))
          : getZoneDurationSeconds(safeZone);

        if (session?.running && Number.isFinite(Number(session?.endsAt))) {
          const adjustedRemaining = Math.max(
            0,
            Math.ceil((Number(session.endsAt) - now) / 1000),
          );

          return createClaimedSession({
            zone: safeZone,
            durationSeconds,
            remaining: adjustedRemaining,
            running: adjustedRemaining > 0,
            endsAt: adjustedRemaining > 0 ? Number(session.endsAt) : null,
            hasReminder: Boolean(session?.hasReminder),
            notificationIds: Array.isArray(session?.notificationIds) ? session.notificationIds : [],
            isSeeded: Boolean(session?.isSeeded || adjustedRemaining > 0),
          });
        }

        if (Boolean(session?.isSeeded) && Number.isFinite(Number(session?.remaining))) {
          return createClaimedSession({
            zone: safeZone,
            durationSeconds,
            remaining: Math.max(0, Number(session.remaining)),
            running: false,
            endsAt: null,
            hasReminder: false,
            notificationIds: [],
            isSeeded: Number(session.remaining) > 0,
          });
        }

        return createClaimedSession();
      };

      let nextSessions = {
        manual: createManualSession(),
        claimed: createClaimedSession(),
      };

      if (saved) {
        const parsed = JSON.parse(saved);
        nextSessions = {
          manual: normalizeManualSession(parsed?.manual || {}),
          claimed: normalizeClaimedSession(parsed?.claimed || {}),
        };
      } else if (legacySaved) {
        const parsedLegacy = JSON.parse(legacySaved);
        if (parsedLegacy && typeof parsedLegacy === "object") {
          nextSessions = {
            manual: normalizeManualSession(parsedLegacy),
            claimed: createClaimedSession(),
          };
        }
      }

      setTimerSessions(nextSessions);
      if (savedReminderPresetKey) {
        setSelectedReminderPresetKey(getReminderPresetByKey(savedReminderPresetKey).key);
      }
    } catch (error) {
      console.error("Error loading timer state:", error);
    } finally {
      hasHydratedTimerRef.current = true;
    }
  }, []);

  const handleReminderPresetSelect = useCallback(
    (presetKey) => {
      const preset = getReminderPresetByKey(presetKey);
      if (preset.pro && !ensureProAccess("custom_timer_reminders")) {
        return;
      }

      setSelectedReminderPresetKey(preset.key);
    },
    [ensureProAccess],
  );

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

      if (!timerNotificationsUnsupported) {
        const Notifications = await getNotificationsModule();
        if (Notifications) {
          const { status } = await Notifications.requestPermissionsAsync();
          if (status !== "granted") {
            Alert.alert(
              "Notification Permission",
              "Please enable notifications to receive parking timer alerts.",
            );
          }
        }
      }

      loadTimerState();
    })();

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

    if (!hasPro) {
      ensureProAccess("claimed_spot_timer");
      lastHandledAutoStartKeyRef.current = null;
      return;
    }

    const zoneType = params.zoneType;
    const autoStartKey = `${params.autoStart}:${zoneType}`;
    if (lastHandledAutoStartKeyRef.current === autoStartKey) {
      return;
    }

    lastHandledAutoStartKeyRef.current = autoStartKey;

    autoStartTimeoutRef.current = setTimeout(async () => {
      await cancelSessionNotifications(claimedSession.notificationIds || []);

      const durationSeconds = getZoneDurationSeconds(zoneType);
      const endsAt = Date.now() + durationSeconds * 1000;
      const notificationIds = await scheduleSessionNotifications({
        titlePrefix: "Claimed spot timer",
        durationSeconds,
        bodyLabel: zoneType,
      });

      setTimerSessions((current) => ({
        ...current,
        claimed: createClaimedSession({
          zone: zoneType,
          durationSeconds,
          remaining: durationSeconds,
          running: true,
          endsAt,
          hasReminder: notificationIds.length > 0,
          notificationIds,
          isSeeded: true,
        }),
      }));
    }, 450);

    return () => {
      if (autoStartTimeoutRef.current) {
        clearTimeout(autoStartTimeoutRef.current);
      }
    };
  }, [
    cancelSessionNotifications,
    claimedSession.notificationIds,
    ensureProAccess,
    hasPro,
    params.autoStart,
    params.zoneType,
    scheduleSessionNotifications,
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const expiredSessions = [];

      setTimerSessions((current) => {
        let changed = false;
        const next = { ...current };

        for (const key of ["manual", "claimed"]) {
          const session = current[key];
          if (!session.running || !Number.isFinite(Number(session.endsAt))) {
            continue;
          }

          const nextRemaining = Math.max(0, Math.ceil((Number(session.endsAt) - now) / 1000));
          if (nextRemaining <= 0) {
            expiredSessions.push({ key, session });
            next[key] = {
              ...session,
              remaining: 0,
              running: false,
              endsAt: null,
              hasReminder: false,
              notificationIds: [],
              ...(key === "claimed" ? { isSeeded: false } : {}),
            };
            changed = true;
            continue;
          }

          if (nextRemaining !== session.remaining) {
            next[key] = {
              ...session,
              remaining: nextRemaining,
            };
            changed = true;
          }
        }

        return changed ? next : current;
      });

      expiredSessions.forEach(({ key, session }) => {
        cancelSessionNotifications(session.notificationIds || []).catch(() => null);
        Alert.alert(
          "Time's up",
          key === "manual"
            ? "Your manual timer has expired."
            : "Your claimed spot timer has expired.",
        );
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [cancelSessionNotifications]);

  const handleManualHoursChange = useCallback((value) => {
    const nextHours = clampManualHours(value);
    const nextDuration = manualHoursToSeconds(nextHours);

    setTimerSessions((current) => {
      const nextManual = createManualSession({
        ...current.manual,
        selectedHours: nextHours,
        durationSeconds: nextDuration,
        remaining: nextDuration,
        running: false,
        endsAt: null,
        hasReminder: false,
        notificationIds: [],
        hasManualChoice: true,
      });

      return {
        ...current,
        manual: nextManual,
      };
    });
  }, []);

  const handleStartManual = useCallback(async () => {
    const configuredDuration = manualHoursToSeconds(timerSessions.manual.selectedHours);
    const pausedRemaining = getSessionRemaining(timerSessions.manual);
    const baseDuration = Math.max(getSessionDuration(timerSessions.manual), configuredDuration);
    const shouldResume =
      !timerSessions.manual.running &&
      pausedRemaining > 0 &&
      pausedRemaining < baseDuration;
    const countdownSeconds = shouldResume ? pausedRemaining : configuredDuration;

    await cancelSessionNotifications(timerSessions.manual.notificationIds || []);
    const endsAt = Date.now() + countdownSeconds * 1000;
    const notificationIds = await scheduleSessionNotifications({
      titlePrefix: "Manual timer",
      durationSeconds: countdownSeconds,
      bodyLabel: "Your manual timer",
    });

    setTimerSessions((current) => ({
      ...current,
      manual: {
        ...current.manual,
        durationSeconds: shouldResume ? baseDuration : configuredDuration,
        remaining: countdownSeconds,
        running: true,
        endsAt,
        hasReminder: notificationIds.length > 0,
        notificationIds,
      },
    }));
  }, [cancelSessionNotifications, scheduleSessionNotifications, timerSessions.manual]);

  const handlePauseManual = useCallback(async () => {
    await cancelSessionNotifications(timerSessions.manual.notificationIds || []);
    const remaining = getSessionRemaining(timerSessions.manual);

    setTimerSessions((current) => ({
      ...current,
      manual: {
        ...current.manual,
        remaining,
        running: false,
        endsAt: null,
        hasReminder: false,
        notificationIds: [],
      },
    }));
  }, [cancelSessionNotifications, timerSessions.manual]);

  const handleResetManual = useCallback(async () => {
    await cancelSessionNotifications(timerSessions.manual.notificationIds || []);
    const nextDuration = manualHoursToSeconds(timerSessions.manual.selectedHours);

    setTimerSessions((current) => ({
      ...current,
      manual: {
        ...current.manual,
        durationSeconds: nextDuration,
        remaining: nextDuration,
        running: false,
        endsAt: null,
        hasReminder: false,
        notificationIds: [],
      },
    }));
  }, [cancelSessionNotifications, timerSessions.manual]);

  const handlePauseClaimed = useCallback(async () => {
    await cancelSessionNotifications(timerSessions.claimed.notificationIds || []);
    setTimerSessions((current) => ({
      ...current,
      claimed: {
        ...current.claimed,
        running: false,
        endsAt: null,
        hasReminder: false,
        notificationIds: [],
      },
    }));
  }, [cancelSessionNotifications, timerSessions.claimed.notificationIds]);

  const handleResetClaimed = useCallback(async () => {
    await cancelSessionNotifications(timerSessions.claimed.notificationIds || []);
    setTimerSessions((current) => ({
      ...current,
      claimed: createClaimedSession(),
    }));
  }, [cancelSessionNotifications, timerSessions.claimed.notificationIds]);

  const handleResumeClaimed = useCallback(async () => {
    const durationSeconds = getSessionRemaining(timerSessions.claimed);
    if (durationSeconds <= 0) {
      return;
    }

    await cancelSessionNotifications(timerSessions.claimed.notificationIds || []);
    const endsAt = Date.now() + durationSeconds * 1000;
    const notificationIds = await scheduleSessionNotifications({
      titlePrefix: "Claimed spot timer",
      durationSeconds,
      bodyLabel: timerSessions.claimed.zone,
    });

    setTimerSessions((current) => ({
      ...current,
      claimed: {
        ...current.claimed,
        running: true,
        endsAt,
        hasReminder: notificationIds.length > 0,
        notificationIds,
      },
    }));
  }, [cancelSessionNotifications, scheduleSessionNotifications, timerSessions.claimed]);

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
                <Text style={styles.heroBadgeText}>Manual timer</Text>
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

            <Text style={styles.heroTitle}>Set your countdown</Text>
            <Text style={styles.heroSubtitle}>
              Set a manual parking timer with a simple hours bar. If you claim a parking spot, the claimed timer is available in Pro.
            </Text>

          </LinearGradient>

          <View style={[styles.proBanner, hasPro ? styles.proBannerActive : styles.proBannerInactive]}>
            <View style={styles.proBannerCopy}>
              <View style={styles.proBannerTopRow}>
                <ShiningProBadge label={hasPro ? "Pro active" : "Pro"} />
                <Text style={styles.proBannerHeadline}>{premiumTimerHeadline}</Text>
              </View>
              <Text style={styles.proBannerText}>{premiumTimerCopy}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/pro-center")}
              style={({ pressed }) => [
                styles.proBannerButton,
                { opacity: pressed ? 0.92 : 1 },
              ]}
            >
              <Text style={styles.proBannerButtonText}>{hasPro ? "Pro Center" : "Unlock Pro"}</Text>
            </Pressable>
          </View>

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>Manual Timer</Text>
              <Text style={styles.sectionTitle}>Set your parking hours</Text>
            </View>
            <Text style={styles.sectionHint}>Adjustable bar</Text>
          </View>

          <View style={styles.manualCard}>
            <View style={styles.manualCardTopRow}>
              <View>
                <Text style={styles.manualCardTitle}>Manual timer</Text>
                <Text style={styles.manualCardSubtitle}>
                  Pick your parking limit on the bar, then start the countdown when you park.
                </Text>
              </View>
              <Text style={[styles.manualCardStatus, { color: manualStatusAccent }]}>
                {manualStatusLabel}
              </Text>
            </View>

            <View style={styles.manualBarCard}>
              <View style={styles.manualBarHeader}>
                <Text style={styles.manualBarLabel}>Hours</Text>
                <View style={styles.manualBarValuePill}>
                  <Text style={styles.manualBarValueText}>
                    {clampManualHours(manualSession.selectedHours)}H
                  </Text>
                </View>
              </View>

              <Slider
                value={clampManualHours(manualSession.selectedHours)}
                minimumValue={MANUAL_HOUR_MIN}
                maximumValue={MANUAL_HOUR_MAX}
                step={1}
                disabled={manualSession.running}
                minimumTrackTintColor={BRAND_PALETTE.accentBold}
                maximumTrackTintColor="#D9EBF8"
                thumbTintColor={BRAND_PALETTE.gold}
                onValueChange={handleManualHoursChange}
                style={styles.manualBarSlider}
              />

              <View style={styles.manualBarTicks}>
                {[1, 3, 6, 9, 12].map((hourMark) => {
                  const selected = clampManualHours(manualSession.selectedHours) === hourMark;
                  return (
                    <Text
                      key={`manual-hour-${hourMark}`}
                      style={[styles.manualBarTickText, selected && styles.manualBarTickTextActive]}
                    >
                      {hourMark}H
                    </Text>
                  );
                })}
              </View>
            </View>

            <Text style={styles.manualTimeValue}>{formatTime(manualDisplaySeconds)}</Text>
            <Text style={styles.manualTimeHint}>
              {manualSession.running
                ? "Manual timer is running"
                : manualPaused
                  ? "Paused with time remaining"
                  : "Adjust the bar, then start"}
            </Text>

            <View style={styles.progressTrack}>
              <LinearGradient
                colors={[manualStatusAccent, BRAND_PALETTE.accentBold]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.progressFill,
                  { width: `${Math.max(manualProgress * 100, 6)}%` },
                ]}
              />
            </View>

            <View style={styles.manualMetaRow}>
              <Text style={styles.manualMetaChip}>{manualReminderLabel}</Text>
              <Text style={styles.manualMetaChip}>
                {manualSelectedSeconds > 0 ? formatTime(manualSelectedSeconds) : "0:00:00"}
              </Text>
            </View>

            <View style={styles.reminderPresetPanel}>
              <View style={styles.reminderPresetHeader}>
                <View>
                  <Text style={styles.reminderPresetEyebrow}>Reminder mode</Text>
                  <Text style={styles.reminderPresetTitle}>Choose your warning pattern</Text>
                </View>
                <Text style={styles.reminderPresetHint}>
                  {manualSession.running || claimedSession.running
                    ? "Applies next start"
                    : hasPro
                      ? "Pro active"
                      : "Standard free"}
                </Text>
              </View>

              <Text style={styles.reminderPresetCopy}>
                {hasPro
                  ? "Recommended Pro presets are tuned for shorter exits, tighter warning windows, and cleaner parking handoffs."
                  : "Free users keep the default reminder cadence. Unlock Pro to switch to tighter warning windows."}
              </Text>

              <View style={styles.reminderPresetRail}>
                {REMINDER_PRESETS.map((preset) => {
                  const isSelected = selectedReminderPresetKey === preset.key;
                  const isLocked = preset.pro && !hasPro;

                  return (
                    <Pressable
                      key={preset.key}
                      accessibilityRole="button"
                      onPress={() => handleReminderPresetSelect(preset.key)}
                      style={({ pressed }) => [
                        styles.reminderPresetChip,
                        isSelected && styles.reminderPresetChipSelected,
                        isLocked && styles.reminderPresetChipLocked,
                        { opacity: pressed ? 0.95 : 1 },
                      ]}
                    >
                      <View style={styles.reminderPresetChipRow}>
                        <Text
                          style={[
                            styles.reminderPresetChipText,
                            isSelected && styles.reminderPresetChipTextSelected,
                          ]}
                        >
                          {preset.label}
                        </Text>
                        {isLocked ? <ShiningProBadge /> : null}
                      </View>
                      <Text
                        style={[
                          styles.reminderPresetChipSubtext,
                          isSelected && styles.reminderPresetChipSubtextSelected,
                        ]}
                      >
                        {preset.shortLabel}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.sessionCardActions}>
              <Pressable
                accessibilityRole="button"
                onPress={manualSession.running ? handlePauseManual : handleStartManual}
                style={({ pressed }) => [
                  styles.primaryActionWrap,
                  manualSelectedSeconds <= 0 && !manualSession.running && styles.primaryActionDisabledWrap,
                  { opacity: pressed ? 0.95 : 1 },
                ]}
                disabled={manualSelectedSeconds <= 0 && !manualSession.running}
              >
                <LinearGradient
                  colors={
                    manualSelectedSeconds <= 0 && !manualSession.running
                      ? ["#94A3B8", "#64748B"]
                      : manualSession.running
                        ? ["#F59E0B", "#D97706"]
                        : ["#10B981", "#0F9F6E"]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryAction}
                >
                  {manualSession.running ? <Pause size={20} color="#FFFFFF" /> : <Play size={20} color="#FFFFFF" />}
                  <Text style={styles.primaryActionText}>
                    {manualSession.running ? "Pause timer" : "Start timer"}
                  </Text>
                </LinearGradient>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={handleResetManual}
                style={({ pressed }) => [
                  styles.secondaryAction,
                  { opacity: pressed ? 0.94 : 1 },
                ]}
              >
                <RotateCcw size={18} color={BRAND_PALETTE.muted} />
                <Text style={styles.secondaryActionText}>Reset</Text>
              </Pressable>
            </View>
          </View>

          {claimedSessionVisible ? (
            <>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionEyebrow}>Claimed Spot Timer</Text>
                  <Text style={styles.sectionTitle}>Auto-started from your claim</Text>
                </View>
                <Text style={styles.sectionHint}>Shown only when active</Text>
              </View>

              <SessionCard
                title="Claimed spot timer"
                subtitle={`Auto-linked to ${claimedSession.zone} parking`}
                statusLabel={claimedStatusLabel}
                statusAccent={claimedStatusAccent}
                timerText={formatTime(getSessionRemaining(claimedSession))}
                progress={getSessionProgress(claimedSession)}
                progressAccent={claimedMeta.accent}
                hintLabel={claimedReminderLabel}
                badgeLabel={`${claimedSession.zone} • ${formatShortDuration(claimedSession.durationSeconds / 60)}`}
                onPrimary={claimedSession.running ? handlePauseClaimed : handleResumeClaimed}
                primaryLabel={claimedSession.running ? "Pause claimed timer" : "Resume claimed timer"}
                primaryDisabled={getSessionRemaining(claimedSession) <= 0}
                isRunning={claimedSession.running}
                onSecondary={handleResetClaimed}
                secondaryLabel="Clear claimed timer"
              />
            </>
          ) : null}

          <View style={styles.tipCard}>
            <View style={styles.tipIconWrap}>
              <BellRing size={18} color={BRAND_PALETTE.accentBold} />
            </View>
            <View style={styles.tipCopy}>
              <Text style={styles.tipTitle}>Reminder logic</Text>
              <Text style={styles.tipText}>
                Manual and claimed timers each keep their own alerts with start, warning, and expiry notifications.
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
    maxWidth: 320,
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(255,255,255,0.76)",
  },
  proBanner: {
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    marginTop: 14,
  },
  proBannerActive: {
    backgroundColor: "#F7FFFC",
    borderColor: "rgba(16, 185, 129, 0.18)",
  },
  proBannerInactive: {
    backgroundColor: "#F8FCFF",
    borderColor: "rgba(2, 132, 199, 0.16)",
  },
  proBannerCopy: {
    flex: 1,
    gap: 4,
  },
  proBannerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  proBannerHeadline: {
    color: BRAND_PALETTE.deepNavy,
    fontSize: 14,
    fontWeight: "900",
  },
  proBannerText: {
    color: BRAND_PALETTE.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  proBannerButton: {
    backgroundColor: BRAND_PALETTE.deepNavy,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  proBannerButtonText: {
    color: BRAND_PALETTE.surface,
    fontSize: 12,
    fontWeight: "800",
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
  manualCard: {
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8EAF6",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    shadowColor: "#0B1F33",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  manualCardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  manualCardTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: BRAND_PALETTE.deepNavy,
  },
  manualCardSubtitle: {
    marginTop: 6,
    maxWidth: 240,
    fontSize: 12,
    lineHeight: 18,
    color: BRAND_PALETTE.muted,
  },
  manualCardStatus: {
    fontSize: 13,
    fontWeight: "800",
  },
  manualBarCard: {
    marginTop: 16,
    borderRadius: 24,
    backgroundColor: "#F4FAFF",
    borderWidth: 1,
    borderColor: "#D8EAF6",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
  },
  manualBarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  manualBarLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: BRAND_PALETTE.accentBold,
  },
  manualBarValuePill: {
    borderRadius: 999,
    backgroundColor: BRAND_PALETTE.deepNavy,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  manualBarValueText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  manualBarSlider: {
    width: "100%",
    height: 38,
    marginTop: 10,
  },
  manualBarTicks: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  manualBarTickText: {
    fontSize: 11,
    fontWeight: "700",
    color: BRAND_PALETTE.muted,
  },
  manualBarTickTextActive: {
    color: BRAND_PALETTE.accentBold,
  },
  manualTimeValue: {
    marginTop: 18,
    textAlign: "center",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1,
    color: BRAND_PALETTE.deepNavy,
  },
  manualTimeHint: {
    marginTop: 6,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    color: BRAND_PALETTE.muted,
  },
  manualMetaRow: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  manualMetaChip: {
    borderRadius: 999,
    backgroundColor: "#EEF7FD",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 11,
    fontWeight: "800",
    color: BRAND_PALETTE.navy,
  },
  reminderPresetPanel: {
    marginTop: 16,
    borderRadius: 22,
    backgroundColor: "#F7FBFF",
    borderWidth: 1,
    borderColor: "#D8EAF6",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 10,
  },
  reminderPresetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  reminderPresetEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: BRAND_PALETTE.accentBold,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  reminderPresetTitle: {
    marginTop: 4,
    color: BRAND_PALETTE.deepNavy,
    fontSize: 14,
    fontWeight: "800",
  },
  reminderPresetCopy: {
    color: BRAND_PALETTE.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  reminderPresetHint: {
    color: BRAND_PALETTE.muted,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "right",
  },
  reminderPresetRail: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  reminderPresetChip: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D7E6F2",
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 4,
  },
  reminderPresetChipSelected: {
    backgroundColor: "#E7F4FF",
    borderColor: BRAND_PALETTE.accentBold,
  },
  reminderPresetChipLocked: {
    backgroundColor: "#F8FBFE",
  },
  reminderPresetChipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reminderPresetChipText: {
    color: BRAND_PALETTE.navy,
    fontSize: 12,
    fontWeight: "700",
  },
  reminderPresetChipTextSelected: {
    color: BRAND_PALETTE.accentBold,
  },
  reminderPresetChipSubtext: {
    color: BRAND_PALETTE.muted,
    fontSize: 10,
    lineHeight: 13,
  },
  reminderPresetChipSubtextSelected: {
    color: BRAND_PALETTE.navy,
  },
  sessionCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#D8EAF6",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    shadowColor: "#0B1F33",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  sessionCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  sessionCardHeaderRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  sessionCardTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: BRAND_PALETTE.deepNavy,
  },
  sessionCardSubtitle: {
    marginTop: 6,
    maxWidth: 240,
    fontSize: 12,
    lineHeight: 18,
    color: BRAND_PALETTE.muted,
  },
  sessionCardStatus: {
    fontSize: 13,
    fontWeight: "800",
  },
  sessionCardBadge: {
    borderRadius: 999,
    backgroundColor: "#EEF7FD",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 11,
    fontWeight: "800",
    color: BRAND_PALETTE.navy,
  },
  sessionCardTimerWrap: {
    marginTop: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  sessionCardTimerValue: {
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1,
    color: BRAND_PALETTE.deepNavy,
  },
  sessionCardHint: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "700",
    color: BRAND_PALETTE.muted,
  },
  progressTrack: {
    marginTop: 14,
    height: 12,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#DFEEF8",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  sessionCardActions: {
    marginTop: 16,
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
