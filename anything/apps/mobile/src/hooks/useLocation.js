import { useSyncExternalStore } from "react";
import { AppState } from "react-native";
import * as Location from "expo-location";

const LOCATION_CHANGE_THRESHOLD_METERS = 2;
const HEADING_CHANGE_THRESHOLD_DEGREES = 5;
const CURRENT_POSITION_TIMEOUT_MS = 8000;
const LAST_KNOWN_POSITION_MAX_AGE_MS = 30000;
const WATCH_POSITION_OPTIONS = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 250,
  distanceInterval: 1,
};

const listeners = new Set();

let locationSubscription = null;
let headingSubscription = null;
let trackingPromise = null;
let restartPromise = null;
let trackingRunId = 0;
let appStateSubscription = null;
let locationSnapshot = {
  location: null,
  errorMsg: null,
  status: "loading",
};

const toRad = (value) => (value * Math.PI) / 180;

const getDistanceMeters = (origin, target) => {
  if (!origin || !target) return null;

  const earthRadius = 6371000;
  const dLat = toRad(target.latitude - origin.latitude);
  const dLon = toRad(target.longitude - origin.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(origin.latitude)) *
      Math.cos(toRad(target.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getPositionWithTimeout = async (
  options,
  timeoutMs = CURRENT_POSITION_TIMEOUT_MS,
) => {
  return Promise.race([
    Location.getCurrentPositionAsync(options),
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("Timed out while fetching current location"));
      }, timeoutMs);
    }),
  ]);
};

const normalizeHeading = (value) => {
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  return ((value % 360) + 360) % 360;
};

const mergeHeadingIntoCoords = (coords, headingOverride) => {
  if (!coords) return null;

  const resolvedHeading =
    normalizeHeading(headingOverride) ?? normalizeHeading(coords.heading);

  return resolvedHeading === null
    ? coords
    : {
        ...coords,
        heading: resolvedHeading,
      };
};

const getHeadingDelta = (previousHeading, nextHeading) => {
  const previous = normalizeHeading(previousHeading);
  const next = normalizeHeading(nextHeading);

  if (previous === null || next === null) {
    return null;
  }

  const delta = Math.abs(next - previous);
  return Math.min(delta, 360 - delta);
};

const isRecentPosition = (
  position,
  maxAgeMs = LAST_KNOWN_POSITION_MAX_AGE_MS,
) => {
  const timestamp = Number(position?.timestamp);
  if (!Number.isFinite(timestamp)) {
    return false;
  }

  return Date.now() - timestamp <= maxAgeMs;
};

const emitSnapshot = () => {
  listeners.forEach((listener) => listener());
};

const updateSnapshot = (nextState) => {
  const statusChanged = locationSnapshot.status !== nextState.status;
  const errorChanged = locationSnapshot.errorMsg !== nextState.errorMsg;
  const locationChanged = (() => {
    if (!locationSnapshot.location || !nextState.location) {
      return locationSnapshot.location !== nextState.location;
    }

    const distance = getDistanceMeters(
      locationSnapshot.location,
      nextState.location,
    );
    const headingDelta = getHeadingDelta(
      locationSnapshot.location.heading,
      nextState.location.heading,
    );

    return (
      distance === null ||
      distance >= LOCATION_CHANGE_THRESHOLD_METERS ||
      (headingDelta !== null &&
        headingDelta >= HEADING_CHANGE_THRESHOLD_DEGREES)
    );
  })();

  if (!statusChanged && !errorChanged && !locationChanged) {
    return;
  }

  locationSnapshot = nextState;
  emitSnapshot();
};

const setLocationState = (coords, headingOverride) => {
  const nextLocation = mergeHeadingIntoCoords(coords, headingOverride);

  if (!nextLocation) {
    return;
  }

  updateSnapshot({
    ...locationSnapshot,
    location: nextLocation,
    status: "ready",
    errorMsg: null,
  });
};

const setStatusState = (status, errorMsg = null) => {
  updateSnapshot({
    ...locationSnapshot,
    status,
    errorMsg,
  });
};

const resetLocationState = () => {
  updateSnapshot({
    location: null,
    errorMsg: null,
    status: "loading",
  });
};

const removeSubscription = async (subscription) => {
  if (!subscription) return;

  try {
    await subscription.remove();
  } catch (error) {
    // Safe to ignore on unsupported platforms.
  }
};

const isTrackingRunActive = (runId) =>
  runId === trackingRunId && listeners.size > 0;

const stopTracking = async () => {
  trackingRunId += 1;
  const subscriptions = [locationSubscription, headingSubscription];
  locationSubscription = null;
  headingSubscription = null;
  trackingPromise = null;

  await Promise.all(subscriptions.map(removeSubscription));
};

const restartTracking = async () => {
  if (restartPromise) {
    return restartPromise;
  }

  restartPromise = (async () => {
    await stopTracking();

    if (listeners.size > 0) {
      await startTracking();
    }
  })();

  try {
    await restartPromise;
  } finally {
    restartPromise = null;
  }
};

const ensureAppStateSubscription = () => {
  if (appStateSubscription) {
    return;
  }

  appStateSubscription = AppState.addEventListener("change", (nextAppState) => {
    if (nextAppState === "active" && listeners.size > 0) {
      restartTracking().catch(() => {});
    }
  });
};

const removeAppStateSubscription = () => {
  if (!appStateSubscription) {
    return;
  }

  appStateSubscription.remove();
  appStateSubscription = null;
};

const startTracking = async () => {
  if (trackingPromise) {
    return trackingPromise;
  }

  const runId = trackingRunId + 1;
  trackingRunId = runId;
  trackingPromise = (async () => {
    try {
      resetLocationState();

      const { status: permissionStatus } =
        await Location.requestForegroundPermissionsAsync();

      if (!isTrackingRunActive(runId)) {
        return;
      }

      if (permissionStatus !== "granted") {
        setStatusState("denied", "Permission to access location was denied");
        return;
      }

      const lastKnown = await Location.getLastKnownPositionAsync();

      if (!isTrackingRunActive(runId)) {
        return;
      }

      const lastKnownIsRecent = isRecentPosition(lastKnown);

      if (lastKnownIsRecent && lastKnown?.coords) {
        setLocationState(lastKnown.coords, locationSnapshot.location?.heading);
      }

      try {
        const currentPosition = await getPositionWithTimeout(
          {
            accuracy: Location.Accuracy.High,
          },
          CURRENT_POSITION_TIMEOUT_MS,
        );

        if (currentPosition?.coords) {
          setLocationState(
            currentPosition.coords,
            locationSnapshot.location?.heading,
          );
        }
      } catch (currentPositionError) {
        if (!lastKnownIsRecent || !lastKnown?.coords) {
          setStatusState(
            "error",
            currentPositionError?.message ||
              "Unable to determine your current location",
          );
        }
      }

      if (!isTrackingRunActive(runId)) {
        return;
      }

      const nextLocationSubscription = await Location.watchPositionAsync(
        WATCH_POSITION_OPTIONS,
        (nextLocation) => {
          setLocationState(
            nextLocation?.coords,
            locationSnapshot.location?.heading,
          );
        },
      );

      if (!isTrackingRunActive(runId)) {
        await removeSubscription(nextLocationSubscription);
        return;
      }

      locationSubscription = nextLocationSubscription;

      try {
        const nextHeadingSubscription = await Location.watchHeadingAsync(
          (headingUpdate) => {
            const nextHeading =
              normalizeHeading(headingUpdate?.trueHeading) ??
              normalizeHeading(headingUpdate?.magHeading);

            if (nextHeading === null || !locationSnapshot.location) {
              return;
            }

            setLocationState(locationSnapshot.location, nextHeading);
          },
        );

        if (!isTrackingRunActive(runId)) {
          await removeSubscription(nextHeadingSubscription);
          return;
        }

        headingSubscription = nextHeadingSubscription;
      } catch (headingError) {
        console.log(
          "Heading updates unavailable:",
          headingError?.message || String(headingError),
        );
      }
    } catch (error) {
      if (isTrackingRunActive(runId)) {
        setStatusState(
          "error",
          error?.message || "Unable to access your location",
        );
      }
    }
  })();

  return trackingPromise;
};

const subscribe = (listener) => {
  listeners.add(listener);

  if (listeners.size === 1) {
    ensureAppStateSubscription();
    startTracking();
  }

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0) {
      removeAppStateSubscription();
      stopTracking();
    }
  };
};

const getSnapshot = () => locationSnapshot;

export const useLocation = () =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
