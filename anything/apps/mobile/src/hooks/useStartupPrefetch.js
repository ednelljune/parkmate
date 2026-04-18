import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import fetch from "@/__create/fetch";
import { useAuthStore } from "@/utils/auth/store";
import { useLocation } from "@/hooks/useLocation";
import {
  ACTIVITY_NOTIFICATIONS_QUERY_KEY,
  fetchActivityNotificationsQuery,
} from "@/hooks/useActivityNotifications";
import {
  ACTIVITY_MAILBOX_QUERY_KEY,
  fetchActivityMailboxQuery,
} from "@/hooks/useActivityMailbox";
import {
  fetchLeaderboardQuery,
  fetchLeaderboardVersionQuery,
  LEADERBOARD_QUERY_KEY,
  LEADERBOARD_VERSION_QUERY_KEY,
} from "@/hooks/useLeaderboardVersion";
import {
  fetchCurrentZoneQuery,
  fetchNearbyReportsQuery,
  fetchParkingZonesQuery,
  getCurrentZoneQueryKey,
  getNearbyReportsQueryKey,
  getParkingZonesQueryKey,
  getQueryLocation,
} from "@/hooks/useParkingData";
import { PARKING_ALERT_RADIUS_METERS } from "@/constants/detectionRadius";
import { resolveBackendUrl } from "@/utils/backend";

const DEFAULT_ACTIVITY_LIMIT = 100;
const DEFAULT_ACTIVITY_MAILBOX_LIMIT = 50;
const DEFAULT_LEADERBOARD_LIMIT = 50;
const STARTUP_PREFETCH_TIMEOUT_MS = 45000;
const DEFAULT_STARTUP_ZONE_RADIUS = PARKING_ALERT_RADIUS_METERS;
const STARTUP_RETRY_DELAY_MS = 1500;
const LOCATION_WARM_STEP_COUNT = 3;

const STARTUP_STEP_LABELS = {
  backend_connection: "Connecting to ParkMate",
  activity_notifications: "Loading activity",
  activity_mailbox: "Loading updates",
  leaderboard: "Loading leaderboard",
  leaderboard_version: "Checking live changes",
  parking_zones: "Loading parking zones",
  current_zone: "Checking your area",
  nearby_reports: "Loading recent spot reports",
};

const sleep = (durationMs) =>
  new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });

const warmQueryUntilSuccess = async ({
  queryClient,
  queryKey,
  queryFn,
  staleTime,
  deadlineMs,
  label,
}) => {
  let lastError = null;

  while (Date.now() < deadlineMs) {
    try {
      const data = await queryClient.fetchQuery({
        queryKey,
        queryFn,
        staleTime,
        retry: false,
      });

      return data;
    } catch (error) {
      lastError = error;
      console.warn("[startup.prefetch] Warm-up attempt failed", {
        label,
        message: error?.message || String(error),
      });

      if (Date.now() + STARTUP_RETRY_DELAY_MS >= deadlineMs) {
        break;
      }

      await sleep(STARTUP_RETRY_DELAY_MS);
    }
  }

  throw (
    lastError ||
    new Error(`Timed out while warming startup query: ${label}`)
  );
};

const warmBackendConnection = async () => {
  const leaderboardVersionUrl = resolveBackendUrl(
    `/api/users/leaderboard/version?limit=${DEFAULT_LEADERBOARD_LIMIT}`,
  );

  if (!leaderboardVersionUrl) {
    return;
  }

  await fetch(leaderboardVersionUrl, {
    method: "GET",
  });
};

export const useStartupPrefetch = () => {
  const queryClient = useQueryClient();
  const { isReady, session } = useAuthStore();
  const { location, status } = useLocation();
  const warmedSessionRef = useRef(null);
  const [startupReady, setStartupReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [startupProgress, setStartupProgress] = useState(0);
  const [startupStatusLabel, setStartupStatusLabel] = useState(
    STARTUP_STEP_LABELS.backend_connection,
  );
  const queryLocation = useMemo(() => getQueryLocation(location), [location]);
  const nonLocationWarmDoneRef = useRef(false);
  const locationWarmKeyRef = useRef(null);
  const locationWarmDoneRef = useRef(false);
  const totalStepsRef = useRef(LOCATION_WARM_STEP_COUNT);
  const completedStepsRef = useRef(new Set());

  const updateProgress = (completedCount, totalCount) => {
    const safeTotal = Math.max(totalCount, 1);
    const ratio = Math.max(0, Math.min(completedCount / safeTotal, 1));
    setStartupProgress(Math.round(ratio * 100));
  };

  const markStepComplete = (stepKey) => {
    if (!stepKey || completedStepsRef.current.has(stepKey)) {
      return;
    }

    completedStepsRef.current.add(stepKey);
    setStartupStatusLabel(
      STARTUP_STEP_LABELS[stepKey] || STARTUP_STEP_LABELS.backend_connection,
    );
    updateProgress(completedStepsRef.current.size, totalStepsRef.current);
  };

  const resetProgressState = (stepCount) => {
    totalStepsRef.current = Math.max(stepCount, 1);
    completedStepsRef.current = new Set();
    setStartupProgress(0);
    setStartupStatusLabel(STARTUP_STEP_LABELS.backend_connection);
  };

  useEffect(() => {
    if (!isReady) {
      setStartupReady(false);
      setTimedOut(false);
      nonLocationWarmDoneRef.current = false;
      locationWarmKeyRef.current = null;
      locationWarmDoneRef.current = false;
      warmedSessionRef.current = null;
      resetProgressState(LOCATION_WARM_STEP_COUNT);
      return;
    }

    const timeoutId = setTimeout(() => {
      setTimedOut(true);
      setStartupProgress(100);
      setStartupReady(true);
    }, STARTUP_PREFETCH_TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [isReady, session?.access_token]);

  useEffect(() => {
    const accessToken = session?.access_token || null;

    if (!isReady) {
      return;
    }

    if (warmedSessionRef.current === accessToken && nonLocationWarmDoneRef.current) {
      return;
    }

    warmedSessionRef.current = accessToken;
    nonLocationWarmDoneRef.current = false;
    locationWarmDoneRef.current = false;
    locationWarmKeyRef.current = null;
    setStartupReady(false);
    setTimedOut(false);
    resetProgressState(accessToken ? 8 : 6);

    const deadlineMs = Date.now() + STARTUP_PREFETCH_TIMEOUT_MS;

    void (async () => {
      try {
        await warmBackendConnection();
        markStepComplete("backend_connection");

        if (accessToken) {
          await Promise.all([
            warmQueryUntilSuccess({
              queryClient,
              queryKey: [...ACTIVITY_NOTIFICATIONS_QUERY_KEY, DEFAULT_ACTIVITY_LIMIT],
              queryFn: () => fetchActivityNotificationsQuery(DEFAULT_ACTIVITY_LIMIT),
              staleTime: Infinity,
              deadlineMs,
              label: "activity_notifications",
            }).then(() => markStepComplete("activity_notifications")),
            warmQueryUntilSuccess({
              queryClient,
              queryKey: [...ACTIVITY_MAILBOX_QUERY_KEY, DEFAULT_ACTIVITY_MAILBOX_LIMIT],
              queryFn: () => fetchActivityMailboxQuery(DEFAULT_ACTIVITY_MAILBOX_LIMIT),
              staleTime: Infinity,
              deadlineMs,
              label: "activity_mailbox",
            }).then(() => markStepComplete("activity_mailbox")),
          ]);
        }

        await Promise.all([
          warmQueryUntilSuccess({
            queryClient,
            queryKey: [...LEADERBOARD_QUERY_KEY, DEFAULT_LEADERBOARD_LIMIT],
            queryFn: () => fetchLeaderboardQuery(DEFAULT_LEADERBOARD_LIMIT),
            staleTime: Infinity,
            deadlineMs,
            label: "leaderboard",
          }).then(() => markStepComplete("leaderboard")),
          warmQueryUntilSuccess({
            queryClient,
            queryKey: [...LEADERBOARD_VERSION_QUERY_KEY, DEFAULT_LEADERBOARD_LIMIT],
            queryFn: () => fetchLeaderboardVersionQuery(DEFAULT_LEADERBOARD_LIMIT),
            staleTime: 0,
            deadlineMs,
            label: "leaderboard_version",
          }).then(() => markStepComplete("leaderboard_version")),
        ]);

        nonLocationWarmDoneRef.current = true;

        if (status === "denied" || status === "error") {
          markStepComplete("parking_zones");
          markStepComplete("current_zone");
          markStepComplete("nearby_reports");
          setStartupReady(true);
        }
      } catch (error) {
        console.warn("[startup.prefetch] Non-location warm-up failed", {
          message: error?.message || String(error),
        });
      }
    })();
  }, [isReady, queryClient, session?.access_token, status]);

  useEffect(() => {
    if (!isReady || !nonLocationWarmDoneRef.current) {
      return;
    }

    if (status === "denied" || status === "error") {
      locationWarmDoneRef.current = true;
      markStepComplete("parking_zones");
      markStepComplete("current_zone");
      markStepComplete("nearby_reports");
      setStartupReady(true);
      return;
    }

    if (status !== "ready" || !queryLocation) {
      return;
    }

    const nextLocationWarmKey = [
      session?.access_token || "guest",
      queryLocation.latitude,
      queryLocation.longitude,
    ].join(":");

    if (locationWarmKeyRef.current === nextLocationWarmKey) {
      locationWarmDoneRef.current = true;
      setStartupReady(true);
      return;
    }

    locationWarmKeyRef.current = nextLocationWarmKey;
    locationWarmDoneRef.current = false;

    const deadlineMs = Date.now() + STARTUP_PREFETCH_TIMEOUT_MS;

    void (async () => {
      try {
        await Promise.all([
          warmQueryUntilSuccess({
            queryClient,
            queryKey: getParkingZonesQueryKey(queryLocation, DEFAULT_STARTUP_ZONE_RADIUS),
            queryFn: () =>
              fetchParkingZonesQuery(queryLocation, DEFAULT_STARTUP_ZONE_RADIUS),
            staleTime: 30000,
            deadlineMs,
            label: "parking_zones",
          }).then(() => markStepComplete("parking_zones")),
          warmQueryUntilSuccess({
            queryClient,
            queryKey: getCurrentZoneQueryKey(queryLocation),
            queryFn: () => fetchCurrentZoneQuery(queryLocation),
            staleTime: 30000,
            deadlineMs,
            label: "current_zone",
          }).then(() => markStepComplete("current_zone")),
          warmQueryUntilSuccess({
            queryClient,
            queryKey: getNearbyReportsQueryKey(
              queryLocation,
              DEFAULT_STARTUP_ZONE_RADIUS,
            ),
            queryFn: () =>
              fetchNearbyReportsQuery(queryLocation, DEFAULT_STARTUP_ZONE_RADIUS),
            staleTime: 15000,
            deadlineMs,
            label: "nearby_reports",
          }).then(() => markStepComplete("nearby_reports")),
        ]);

        locationWarmDoneRef.current = true;
        setStartupReady(true);
      } catch (error) {
        console.warn("[startup.prefetch] Location warm-up failed", {
          message: error?.message || String(error),
        });
      }
    })();
  }, [isReady, queryClient, queryLocation, session?.access_token, status]);

  return {
    isStartupReady: startupReady || timedOut,
    isStartupTimedOut: timedOut,
    startupProgress,
    startupStatusLabel,
  };
};

export const StartupPrefetch = () => {
  useStartupPrefetch();
  return null;
};
