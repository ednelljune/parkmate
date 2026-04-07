import { useSyncExternalStore } from "react";
import * as Location from "expo-location";

const LOCATION_CHANGE_THRESHOLD_METERS = 4;
const HEADING_CHANGE_THRESHOLD_DEGREES = 8;

const listeners = new Set();

let locationSubscription = null;
let headingSubscription = null;
let trackingPromise = null;
let trackingRunId = 0;
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

const getPositionWithTimeout = async (options, timeoutMs = 8000) => {
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

const startTracking = async () => {
  if (trackingPromise) {
    return trackingPromise;
  }

  const runId = trackingRunId + 1;
  trackingRunId = runId;
  trackingPromise = (async () => {
    try {
      if (!locationSnapshot.location) {
        setStatusState("loading", null);
      }

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

      if (lastKnown?.coords) {
        setLocationState(lastKnown.coords, locationSnapshot.location?.heading);
      }

      try {
        const currentPosition = await getPositionWithTimeout(
          {
            accuracy: Location.Accuracy.Balanced,
          },
          8000,
        );

        if (currentPosition?.coords) {
          setLocationState(
            currentPosition.coords,
            locationSnapshot.location?.heading,
          );
        }
      } catch (currentPositionError) {
        if (!lastKnown?.coords) {
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
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 5,
        },
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
    startTracking();
  }

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0) {
      stopTracking();
    }
  };
};

const getSnapshot = () => locationSnapshot;

export const useLocation = () =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
