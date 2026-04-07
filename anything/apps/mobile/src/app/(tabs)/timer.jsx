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

const ZONE_DURATIONS = {
  "1P": 60,
  "2P": 120,
  "3P": 180,
};

const ZONE_ORDER = ["1P", "2P", "3P"];

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

export default function TimerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const autoStartTimeoutRef = useRef(null);
  const hasHydratedTimerRef = useRef(false);

  const { data: user } = useUser();
  const userId = user?.id;

  const [selectedZone, setSelectedZone] = useState("1P");
  const [timeRemaining, setTimeRemaining] = useState(ZONE_DURATIONS["1P"] * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [hasReminder, setHasReminder] = useState(false);
  const [hasManualZoneChoice, setHasManualZoneChoice] = useState(false);

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
  const totalDurationSeconds = ZONE_DURATIONS[selectedZone] * 60;
  const progress = Math.min(
    1,
    Math.max(0, 1 - timeRemaining / Math.max(totalDurationSeconds, 1)),
  );
  const timerNotificationsUnsupported =
    notificationsUnsupportedInCurrentRuntime || (isExpoGo && Platform.OS === "ios");
  const percentRemaining = Math.round((timeRemaining / Math.max(totalDurationSeconds, 1)) * 100);
  const isWarning = timeRemaining <= 600 && timeRemaining > 0;
  const zoneMeta = ZONE_META[selectedZone];
  const statusLabel = timeRemaining <= 0
    ? "Expired"
    : isRunning
      ? isWarning
        ? "Move soon"
        : "Live session"
      : startTime
        ? "Paused"
        : "Ready";
  const statusAccent = timeRemaining <= 0
    ? "#DC2626"
    : isWarning
      ? BRAND_PALETTE.gold
      : isRunning
        ? BRAND_PALETTE.success
        : BRAND_PALETTE.accentBold;
  const reminderLabel = timerNotificationsUnsupported
    ? "Dev build required"
    : hasReminder
      ? "10 min warning ready"
      : isRunning
        ? "Checking reminder"
        : "Reminder idle";

  useEffect(() => {
    if (!hasHydratedTimerRef.current || hasManualZoneChoice || isRunning || startTime) {
      return;
    }

    if (!preferredZone || preferredZone === selectedZone) {
      return;
    }

    setSelectedZone(preferredZone);
    setTimeRemaining(ZONE_DURATIONS[preferredZone] * 60);
  }, [hasManualZoneChoice, isRunning, preferredZone, selectedZone, startTime]);

  const saveTimerState = useCallback(async (zone, remaining, running, start) => {
    try {
      await AsyncStorage.setItem(
        "parkingTimer",
        JSON.stringify({ zone, remaining, running, start }),
      );
    } catch (error) {
      console.error("Error saving timer state:", error);
    }
  }, []);

  const cancelTimerNotifications = useCallback(async () => {
    const Notifications = await getNotificationsModule();
    if (!Notifications) {
      return;
    }

    await Notifications.cancelAllScheduledNotificationsAsync();
  }, []);

  const scheduleTimerNotifications = useCallback(async (durationSeconds) => {
    if (timerNotificationsUnsupported) {
      return false;
    }

    const Notifications = await getNotificationsModule();
    if (!Notifications) {
      return false;
    }

    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      await ensureAlertsNotificationChannel();

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Parking Timer Started",
          body: "Your timer is running. You'll get a 10-minute warning before expiry.",
          sound: true,
        },
        trigger: null,
      });

      const triggerBase = {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        channelId: "alerts",
      };
      const tenMinutesBeforeExpiry = durationSeconds - 600;

      if (tenMinutesBeforeExpiry > 0) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Parking Time Warning",
            body: "Your parking expires in 10 minutes!",
            sound: true,
          },
          trigger: {
            ...triggerBase,
            seconds: tenMinutesBeforeExpiry,
          },
        });
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Parking Time Expired",
          body: "Your parking time has expired. Move your vehicle to avoid a fine.",
          sound: true,
        },
        trigger: {
          ...triggerBase,
          seconds: durationSeconds,
        },
      });

      return true;
    } catch (error) {
      console.error("Error scheduling timer notifications:", error);
      return false;
    }
  }, [timerNotificationsUnsupported]);

  const handleReset = useCallback(async () => {
    setIsRunning(false);
    setStartTime(null);
    setTimeRemaining(ZONE_DURATIONS[selectedZone] * 60);
    setHasReminder(false);
    await cancelTimerNotifications();
    await AsyncStorage.removeItem("parkingTimer");
  }, [cancelTimerNotifications, selectedZone]);

  const handleTimerExpired = useCallback(async () => {
    setIsRunning(false);
    setHasReminder(false);
    await AsyncStorage.removeItem("parkingTimer");
    Alert.alert(
      "Time's up",
      "Your parking time has expired. Move your vehicle to avoid a fine.",
      [{ text: "Reset", onPress: handleReset }],
    );
  }, [handleReset]);

  const loadTimerState = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem("parkingTimer");

      if (!saved) {
        hasHydratedTimerRef.current = true;
        return;
      }

      const { zone, remaining, running, start } = JSON.parse(saved);
      const safeZone = ZONE_DURATIONS[zone] ? zone : "1P";
      const baseRemaining = Number(remaining) || ZONE_DURATIONS[safeZone] * 60;
      const safeStart = Number(start) || null;

      setSelectedZone(safeZone);
      setHasManualZoneChoice(true);

      if (running && safeStart) {
        const elapsedSeconds = Math.max(
          0,
          Math.floor((Date.now() - safeStart) / 1000),
        );
        const adjustedRemaining = Math.max(0, baseRemaining - elapsedSeconds);

        if (adjustedRemaining <= 0) {
          setTimeRemaining(0);
          setStartTime(null);
          setIsRunning(false);
          setHasReminder(false);
          await AsyncStorage.removeItem("parkingTimer");
        } else {
          setTimeRemaining(adjustedRemaining);
          setStartTime(safeStart);
          setIsRunning(true);
          setHasReminder(!timerNotificationsUnsupported);
        }
      } else {
        setTimeRemaining(baseRemaining);
        setStartTime(safeStart);
        setIsRunning(false);
        setHasReminder(false);
      }
    } catch (error) {
      console.error("Error loading timer state:", error);
    } finally {
      hasHydratedTimerRef.current = true;
    }
  }, []);

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
      return;
    }

    const zoneType = params.zoneType;
    const duration = ZONE_DURATIONS[zoneType] * 60;

    setSelectedZone(zoneType);
    setHasManualZoneChoice(true);
    setTimeRemaining(duration);

    autoStartTimeoutRef.current = setTimeout(async () => {
      const now = Date.now();
      setIsRunning(true);
      setStartTime(now);
      const notificationsScheduled = await scheduleTimerNotifications(duration);
      await saveTimerState(zoneType, duration, true, now);
      setHasReminder(notificationsScheduled);
      router.setParams({ autoStart: undefined, zoneType: undefined });
    }, 450);

    return () => {
      if (autoStartTimeoutRef.current) {
        clearTimeout(autoStartTimeoutRef.current);
      }
    };
  }, [params.autoStart, params.zoneType, router, saveTimerState, scheduleTimerNotifications]);

  useEffect(() => {
    let interval;

    if (isRunning && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((previousTime) => {
          const nextTime = previousTime - 1;

          if (nextTime <= 0) {
            handleTimerExpired();
            return 0;
          }

          if (nextTime % 10 === 0) {
            saveTimerState(selectedZone, nextTime, true, startTime);
          }

          return nextTime;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [handleTimerExpired, isRunning, saveTimerState, selectedZone, startTime, timeRemaining]);

  const handleStart = useCallback(async () => {
    const now = Date.now();
    setIsRunning(true);
    setStartTime(now);

    const notificationsScheduled = await scheduleTimerNotifications(timeRemaining);
    await saveTimerState(selectedZone, timeRemaining, true, now);
    setHasReminder(notificationsScheduled);

    if (!notificationsScheduled && timerNotificationsUnsupported) {
      Alert.alert(
        "Timer Started",
        "The parking timer is running, but reminder notifications are unavailable in Expo Go. Use a development build to test alerts.",
      );
    }
  }, [saveTimerState, scheduleTimerNotifications, selectedZone, timeRemaining, timerNotificationsUnsupported]);

  const handlePause = useCallback(async () => {
    setIsRunning(false);
    setHasReminder(false);
    await cancelTimerNotifications();
    await saveTimerState(selectedZone, timeRemaining, false, startTime);
  }, [cancelTimerNotifications, saveTimerState, selectedZone, startTime, timeRemaining]);

  const handleZoneSelect = useCallback(
    (zone) => {
      if (zone === selectedZone) {
        return;
      }

      if (isRunning) {
        Alert.alert(
          "Timer running",
          "Pause or reset the timer before switching to another parking zone.",
        );
        return;
      }

      setHasManualZoneChoice(true);
      setSelectedZone(zone);
      setStartTime(null);
      setTimeRemaining(ZONE_DURATIONS[zone] * 60);
      setHasReminder(false);
      saveTimerState(zone, ZONE_DURATIONS[zone] * 60, false, null);
    },
    [isRunning, saveTimerState, selectedZone],
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
                <Text style={styles.heroBadgeText}>Parking session</Text>
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
              Lock in the right public parking zone, keep your session visible, and move before your time limit runs out.
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
                label="Reminder"
                value={hasReminder ? "On" : "Off"}
                accent={BRAND_PALETTE.success}
                tone="dark"
              />
            </View>
          </LinearGradient>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>Zone Setup</Text>
              <Text style={styles.sectionTitle}>Pick your parking limit</Text>
            </View>
            <Text style={styles.sectionHint}>
              {isRunning ? "Locked while timer is live" : "Tap to change"}
            </Text>
          </View>

          <View style={styles.zoneGrid}>
            {ZONE_ORDER.map((zone) => (
              <ZoneCard
                key={zone}
                zone={zone}
                selected={selectedZone === zone}
                disabled={isRunning}
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
                <Text style={styles.zoneCapsuleText}>{selectedZone}</Text>
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
                  {isRunning ? "time remaining" : "session length"}
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
                onPress={handleStart}
                style={({ pressed }) => [
                  styles.primaryActionWrap,
                  { opacity: pressed ? 0.95 : 1 },
                ]}
              >
                <LinearGradient
                  colors={["#10B981", "#0F9F6E"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryAction}
                >
                  <Play size={20} color="#FFFFFF" />
                  <Text style={styles.primaryActionText}>
                    {startTime ? "Resume session" : "Start timer"}
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
                The timer sends a start alert, then a 10-minute warning before expiry, then a final expiry alert.
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
    maxWidth: 280,
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
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
    color: BRAND_PALETTE.muted,
  },
});
