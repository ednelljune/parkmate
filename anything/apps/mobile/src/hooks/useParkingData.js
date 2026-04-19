import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";
import fetch from "@/__create/fetch";
import { getResolvedBaseUrl, resolveBackendUrl } from "@/utils/backend";
import useUser from "@/utils/auth/useUser";
import { useAuthStore } from "@/utils/auth/store";
import { getDistanceMeters } from "@/utils/geo";
import {
  getNearbyLocalReports,
  addLocalReport,
  addLocalNotification,
  removeLocalReport,
  isLocalReportWithinSyncGrace,
  upsertLocalReport,
  getLocalReportsVersion,
  subscribeToLocalReports,
} from "@/utils/localReports";
import { ACTIVITY_NOTIFICATIONS_QUERY_KEY } from "@/hooks/useActivityNotifications";
import { ACTIVITY_MAILBOX_QUERY_KEY } from "@/hooks/useActivityMailbox";

const CLAIM_SPOT_MAX_DISTANCE_METERS = 5;
const REPORT_TTL_MS = 3 * 60 * 1000;
const DEFAULT_NEARBY_REPORTS_STALE_TIME_MS = 15000;
const DEFAULT_NEARBY_REPORTS_REFETCH_INTERVAL_MS = 15000;
const DEFAULT_NEARBY_REPORTS_VERSION_REFETCH_INTERVAL_MS = 10000;
const DEFAULT_PARKING_ZONES_REFETCH_INTERVAL_MS = 15000;
const DEFAULT_CURRENT_ZONE_REFETCH_INTERVAL_MS = 10000;
const NEARBY_REPORTS_VERSION_TIMEOUT_MS = 8000;
const PARKING_QUERY_TIMEOUT_MS = 15000;
const PARKING_QUERY_RETRY_DELAY_MS = 1200;
const PARKING_QUERY_ATTEMPTS = 3;

export const NEARBY_REPORTS_QUERY_KEY = ["nearby_reports"];
export const NEARBY_REPORTS_VERSION_QUERY_KEY = ["nearby_reports_version"];

const normalizeCoordinate = (value) => {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getEffectiveExpiresAt = (report) => {
  const createdAtMs = Date.parse(report?.created_at ?? "");
  const expiresAtMs = Date.parse(report?.expires_at ?? "");
  const createdExpiryMs = Number.isFinite(createdAtMs)
    ? createdAtMs + REPORT_TTL_MS
    : Number.NaN;

  if (Number.isFinite(createdExpiryMs) && Number.isFinite(expiresAtMs)) {
    return new Date(Math.min(createdExpiryMs, expiresAtMs)).toISOString();
  }

  if (Number.isFinite(createdExpiryMs)) {
    return new Date(createdExpiryMs).toISOString();
  }

  if (Number.isFinite(expiresAtMs)) {
    return new Date(expiresAtMs).toISOString();
  }

  return report?.expires_at ?? null;
};

const isReportActive = (report, nowMs = Date.now()) => {
  if (!report) return false;

  const normalizedStatus = String(report.status || "available").toLowerCase();
  if (["claimed", "expired", "reported false"].includes(normalizedStatus)) {
    return false;
  }

  const expiresAtMs = Date.parse(report?.expires_at ?? "");
  if (!Number.isFinite(expiresAtMs)) {
    return true;
  }

  return expiresAtMs > nowMs;
};

const safeJsonParse = (value) => {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

const normalizeParkingTypeLabel = (value) => {
  if (typeof value !== "string") return null;

  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  switch (trimmedValue.toLowerCase()) {
    case "full hour":
      return "Full Hour";
    default:
      return trimmedValue;
  }
};

const roundCoordinate = (value, precision = 4) => {
  const normalizedValue = normalizeCoordinate(value);
  if (normalizedValue === null) return null;

  return Number(normalizedValue.toFixed(precision));
};

export const getQueryLocation = (location, precision = 4) => {
  if (!location) return null;

  const latitude = roundCoordinate(location.latitude, precision);
  const longitude = roundCoordinate(location.longitude, precision);

  if (latitude === null || longitude === null) {
    return null;
  }

  return { latitude, longitude };
};

export const getNearbyReportsQueryKey = (queryLocation, radiusMeters) => [
  ...NEARBY_REPORTS_QUERY_KEY,
  queryLocation?.latitude,
  queryLocation?.longitude,
  radiusMeters,
];

export const getParkingZonesQueryKey = (queryLocation, radiusMeters) => [
  "parking_zones",
  queryLocation?.latitude,
  queryLocation?.longitude,
  radiusMeters,
];

export const getCurrentZoneQueryKey = (queryLocation) => [
  "current_zone",
  queryLocation?.latitude,
  queryLocation?.longitude,
];

const sleep = (durationMs) =>
  new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });

const readJsonResponse = async (response, fallbackMessage) => {
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(responseText || fallbackMessage);
  }

  try {
    return responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new Error(
      `${fallbackMessage}: ${responseText.slice(0, 120) || "empty response"}`,
    );
  }
};

const fetchParkingEndpoint = async ({
  label,
  path,
  payload,
  fallbackResult,
  timeoutMs = PARKING_QUERY_TIMEOUT_MS,
  attempts = PARKING_QUERY_ATTEMPTS,
}) => {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let timeoutId;

    try {
      const response = await Promise.race([
        fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(
              new Error(
                `${label} request timed out after ${Math.round(timeoutMs / 1000)}s`,
              ),
            );
          }, timeoutMs);
        }),
      ]);

      return await readJsonResponse(response, `Failed to fetch ${label}`);
    } catch (error) {
      lastError = error;
      const canRetry = attempt < attempts;

      console.warn("[parking.fetch] Request failed", {
        label,
        attempt,
        attempts,
        message: error?.message || String(error),
        payload,
        canRetry,
      });

      if (canRetry) {
        await sleep(PARKING_QUERY_RETRY_DELAY_MS);
      }
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  if (fallbackResult) {
    return fallbackResult();
  }

  throw lastError || new Error(`Failed to fetch ${label}`);
};

const readNearbyReportsVersionResponse = async (response) => {
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(responseText || "Failed to check nearby report updates");
  }

  try {
    return responseText ? JSON.parse(responseText) : { version: "empty" };
  } catch {
    throw new Error(
      `Nearby reports update check returned invalid JSON: ${responseText.slice(0, 120) || "empty response"}`,
    );
  }
};

export const fetchParkingZonesQuery = async (location, radiusMeters = 500) => {
  const queryLocation = getQueryLocation(location);
  if (!queryLocation) {
    return { zones: [] };
  }

  return fetchParkingEndpoint({
    label: "parking zones",
    path: "/api/zones/list",
    payload: {
      latitude: queryLocation.latitude,
      longitude: queryLocation.longitude,
      radiusMeters,
      includeGeometry: true,
    },
    fallbackResult: () => ({ zones: [] }),
  });
};

export const fetchCurrentZoneQuery = async (location) => {
  const queryLocation = getQueryLocation(location);
  if (!queryLocation) {
    return { zone: null };
  }

  return fetchParkingEndpoint({
    label: "current parking zone",
    path: "/api/zones/at-location",
    payload: {
      latitude: queryLocation.latitude,
      longitude: queryLocation.longitude,
    },
    fallbackResult: () => ({ zone: null }),
  });
};

export const fetchNearbyReportsQuery = async (location, radiusMeters = 500) => {
  const queryLocation = getQueryLocation(location);
  if (!queryLocation) {
    return { success: false, spots: [] };
  }

  return fetchParkingEndpoint({
    label: "nearby reports",
    path: "/api/reports/nearby",
    payload: {
      latitude: queryLocation.latitude,
      longitude: queryLocation.longitude,
      radiusMeters,
    },
    fallbackResult: () => ({ success: false, spots: [] }),
  });
};

const fetchNearbyReportsVersion = async (nearbyReportsVersionUrl, payload) => {
  let timeoutId;

  try {
    const response = await Promise.race([
      fetch(nearbyReportsVersionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(
              `Nearby reports update check timed out after ${Math.round(NEARBY_REPORTS_VERSION_TIMEOUT_MS / 1000)}s`,
            ),
          );
        }, NEARBY_REPORTS_VERSION_TIMEOUT_MS);
      }),
    ]);

    return readNearbyReportsVersionResponse(response);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const expandAndRoundRegion = (region, paddingFactor = 0.2, precision = 3) => {
  if (!region) return null;

  const latitudeDelta = Math.max(region.latitudeDelta || 0, 0.002);
  const longitudeDelta = Math.max(region.longitudeDelta || 0, 0.002);
  const latitudePadding = latitudeDelta * paddingFactor;
  const longitudePadding = longitudeDelta * paddingFactor;

  return {
    minLat: Number((region.latitude - latitudeDelta / 2 - latitudePadding).toFixed(precision)),
    maxLat: Number((region.latitude + latitudeDelta / 2 + latitudePadding).toFixed(precision)),
    minLng: Number((region.longitude - longitudeDelta / 2 - longitudePadding).toFixed(precision)),
    maxLng: Number((region.longitude + longitudeDelta / 2 + longitudePadding).toFixed(precision)),
  };
};

const normalizeReport = (report, zone) => {
  if (!report) return null;

  const latitude = normalizeCoordinate(report.latitude);
  const longitude = normalizeCoordinate(report.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  return {
    status: "available",
    distance_meters: 0,
    ...report,
    expires_at: getEffectiveExpiresAt(report),
    latitude,
    longitude,
    zone_name: zone?.name || report.zone_name || "Reported spot",
    zone_type: zone?.zone_type || report.zone_type || report.parking_type,
  };
};

const createNotificationEntry = ({ report, parkingType, quantity, userId }) => {
  const resolvedParkingType =
    report.parking_type || parkingType || report.zone_type || "1P";
  const resolvedQuantity = quantity || report.quantity || 1;
  const zoneName = report.zone_name || "Reported spot";
  const occurredAt = new Date().toISOString();

  return {
    id: `reported-${report.id}`,
    activity_type: "reported",
    user_id: userId || report.user_id,
    report_id: report.id,
    message: `You reported ${resolvedQuantity > 1 ? `${resolvedQuantity} ${resolvedParkingType} spots` : `${resolvedParkingType} spot`} in ${zoneName}.`,
    sent_at: occurredAt,
    occurred_at: occurredAt,
    spot_status: report.status,
    display_status: "Available",
    longitude: report.longitude,
    latitude: report.latitude,
    zone_type: report.zone_type || resolvedParkingType,
    zone_name: zoneName,
    distance_meters: report.distance_meters || 0,
    parking_type: resolvedParkingType,
    quantity: resolvedQuantity,
    expires_at: report.expires_at,
  };
};

const createActivityEntry = ({
  activityType,
  report,
  parkingType,
  quantity,
  userId,
}) => {
  const baseEntry = createNotificationEntry({
    report,
    parkingType,
    quantity,
    userId,
  });
  const resolvedParkingType =
    baseEntry.parking_type || baseEntry.zone_type || "Parking";
  const resolvedQuantity = Number(baseEntry.quantity) || 1;
  const quantityLabel =
    resolvedQuantity > 1
      ? `${resolvedQuantity} ${resolvedParkingType} spots`
      : `${resolvedParkingType} spot`;
  const zoneLabel = baseEntry.zone_name ? ` in ${baseEntry.zone_name}` : "";

  let message = `You reported ${quantityLabel}${zoneLabel}.`;
  let idPrefix = "reported";

  if (activityType === "claimed") {
    message = `You claimed ${quantityLabel}${zoneLabel}.`;
    idPrefix = "claimed";
  } else if (activityType === "false_reported") {
    message = `You reported ${quantityLabel}${zoneLabel} as a false report.`;
    idPrefix = "false";
  }

  return {
    ...baseEntry,
    id: `${idPrefix}-${report.id}`,
    activity_type: activityType,
    message,
  };
};

const appendActivityCache = (queryClient, notification) => {
  queryClient
    .getQueryCache()
    .findAll(({ queryKey }) => queryKey?.[0] === ACTIVITY_NOTIFICATIONS_QUERY_KEY[0])
    .forEach((query) => {
      queryClient.setQueryData(query.queryKey, (prev) => {
        const existing = Array.isArray(prev) ? prev : [];
        return [
          notification,
          ...existing.filter((item) => String(item?.id) !== String(notification.id)),
        ];
      });
    });
};

const findReportSnapshot = (queryClient, reportId) => {
  const normalizedReportId = String(reportId);

  for (const query of queryClient
    .getQueryCache()
    .findAll(({ queryKey }) => queryKey?.[0] === "nearby_reports")) {
    const spots = queryClient.getQueryData(query.queryKey)?.spots || [];
    const match = spots.find((spot) => String(spot?.id) === normalizedReportId);
    if (match) {
      return normalizeReport(match);
    }
  }

  return null;
};

const removeReportFromNearbyQueries = (queryClient, reportId) => {
  if (reportId == null) return;

  const normalizedReportId = String(reportId);
  queryClient
    .getQueryCache()
    .findAll(({ queryKey }) => queryKey[0] === "nearby_reports")
    .forEach((query) => {
      queryClient.setQueryData(query.queryKey, (prev) => {
        const existing = prev?.spots || [];
        return {
          ...prev,
          spots: existing.filter((item) => String(item?.id) !== normalizedReportId),
        };
      });
    });
};

const upsertReportInNearbyQueries = (queryClient, report) => {
  if (!report?.id) return;

  const normalizedReportId = String(report.id);
  queryClient
    .getQueryCache()
    .findAll(({ queryKey }) => queryKey[0] === "nearby_reports")
    .forEach((query) => {
      queryClient.setQueryData(query.queryKey, (prev) => {
        const existing = prev?.spots || [];
        const withoutDuplicate = existing.filter(
          (item) => String(item?.id) !== normalizedReportId,
        );
        return {
          ...prev,
          spots: [report, ...withoutDuplicate],
        };
      });
    });
};

const persistLocalReport = ({
  report,
  parkingType,
  quantity,
  userId,
  queryClient,
  appendNotificationCache,
}) => {
  if (!report?.id) {
    throw new Error("Cannot persist a report without an id");
  }

  queryClient
    .getQueryCache()
    .findAll(({ queryKey }) => queryKey[0] === "nearby_reports")
    .forEach((query) => {
      queryClient.setQueryData(query.queryKey, (prev) => {
        const existing = prev?.spots || [];
        const withoutDuplicate = existing.filter(
          (item) => String(item?.id) !== String(report.id),
        );
        return { ...prev, spots: [report, ...withoutDuplicate] };
      });
    });

  const notificationEntry = createNotificationEntry({
    report,
    parkingType,
    quantity,
    userId,
  });

  appendNotificationCache(notificationEntry);
  appendActivityCache(queryClient, { ...notificationEntry, id: `${notificationEntry.id}-local` });
  addLocalReport(report);
  addLocalNotification(notificationEntry);
};

export const useVisibleParkingZones = (region, enabled = true) => {
  const viewport = useMemo(() => expandAndRoundRegion(region), [region]);
  const { data: zonesData } = useQuery({
    queryKey: [
      "visible_parking_zones",
      viewport?.minLat,
      viewport?.maxLat,
      viewport?.minLng,
      viewport?.maxLng,
    ],
    queryFn: async () => {
      if (!viewport) return { zones: [] };

      const response = await fetch("/api/zones/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...viewport,
          includeGeometry: false,
        }),
      });

      if (!response.ok) return { zones: [] };
      return response.json();
    },
    enabled: enabled && !!viewport,
    staleTime: 30000,
    refetchInterval: false,
  });

  if (!enabled || !viewport) {
    return [];
  }

  return zonesData?.zones || [];
};

export const useParkingZones = (location, radiusMeters = 500) => {
  const queryLocation = useMemo(() => getQueryLocation(location), [location]);
  const { data: zonesData } = useQuery({
    queryKey: getParkingZonesQueryKey(queryLocation, radiusMeters),
    queryFn: async () => fetchParkingZonesQuery(queryLocation, radiusMeters),
    enabled: !!queryLocation,
    placeholderData: (previousData) => previousData,
    staleTime: 30000,
    refetchOnMount: true,
    refetchInterval: DEFAULT_PARKING_ZONES_REFETCH_INTERVAL_MS,
    retry: false,
  });

  return zonesData?.zones || [];
};

export const useNearbyReportsBackendVersion = (
  location,
  radiusMeters = 500,
  enabled = true,
  options = {},
) => {
  const { refetchIntervalMs = DEFAULT_NEARBY_REPORTS_VERSION_REFETCH_INTERVAL_MS } = options;
  const queryClient = useQueryClient();
  const previousVersionRef = useRef(null);
  const scopeKeyRef = useRef(null);
  const queryLocation = useMemo(() => getQueryLocation(location), [location]);
  const nearbyReportsVersionUrl = resolveBackendUrl("/api/reports/nearby/version");
  const nearbyReportsQueryKey = useMemo(
    () => getNearbyReportsQueryKey(queryLocation, radiusMeters),
    [queryLocation, radiusMeters],
  );
  const scopeKey = `${queryLocation?.latitude ?? "none"}:${queryLocation?.longitude ?? "none"}:${radiusMeters}`;

  const query = useQuery({
    queryKey: [
      ...NEARBY_REPORTS_VERSION_QUERY_KEY,
      queryLocation?.latitude,
      queryLocation?.longitude,
      radiusMeters,
    ],
    queryFn: async () => {
      if (!nearbyReportsVersionUrl) {
        throw new Error("Nearby reports update backend URL is not configured");
      }

      if (!queryLocation) {
        return { version: "empty" };
      }

      return fetchNearbyReportsVersion(nearbyReportsVersionUrl, {
        latitude: queryLocation.latitude,
        longitude: queryLocation.longitude,
        radiusMeters,
      });
    },
    enabled: enabled && !!queryLocation,
    refetchInterval:
      enabled && refetchIntervalMs !== false
        ? Math.max(
            1000,
            Number(refetchIntervalMs) || DEFAULT_NEARBY_REPORTS_VERSION_REFETCH_INTERVAL_MS,
          )
        : false,
    retry: false,
    staleTime: 0,
    refetchOnMount: true,
  });

  useEffect(() => {
    if (scopeKeyRef.current === scopeKey) {
      return;
    }

    scopeKeyRef.current = scopeKey;
    previousVersionRef.current = null;
  }, [scopeKey]);

  useEffect(() => {
    if (!enabled || !queryLocation) {
      previousVersionRef.current = null;
      return;
    }

    const nextVersion = query.data?.version ? String(query.data.version) : null;
    if (!nextVersion) {
      return;
    }

    if (previousVersionRef.current == null) {
      previousVersionRef.current = nextVersion;
      return;
    }

    if (previousVersionRef.current === nextVersion) {
      return;
    }

    previousVersionRef.current = nextVersion;
    queryClient.invalidateQueries({ queryKey: nearbyReportsQueryKey, exact: true });
    queryClient
      .refetchQueries({
        queryKey: nearbyReportsQueryKey,
        exact: true,
        type: "active",
      })
      .catch(() => {});
  }, [enabled, nearbyReportsQueryKey, query.data?.version, queryClient, queryLocation]);

  return query;
};

export const useCurrentZone = (location) => {
  const queryLocation = useMemo(() => getQueryLocation(location), [location]);
  const { data: currentZoneData } = useQuery({
    queryKey: getCurrentZoneQueryKey(queryLocation),
    queryFn: async () => fetchCurrentZoneQuery(queryLocation),
    enabled: !!queryLocation,
    placeholderData: (previousData) => previousData,
    staleTime: 15000,
    refetchOnMount: true,
    refetchInterval: DEFAULT_CURRENT_ZONE_REFETCH_INTERVAL_MS,
    retry: false,
  });

  return currentZoneData?.zone || null;
};

export const useNearbyReports = (location, radiusMeters = 500, options = {}) => {
  const {
    refetchIntervalMs = DEFAULT_NEARBY_REPORTS_REFETCH_INTERVAL_MS,
    refetchOnMount = true,
    staleTimeMs = DEFAULT_NEARBY_REPORTS_STALE_TIME_MS,
  } = options;
  const queryLocation = useMemo(() => getQueryLocation(location), [location]);
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const localReportsVersion = useSyncExternalStore(
    subscribeToLocalReports,
    getLocalReportsVersion,
    getLocalReportsVersion,
  );

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 1000);

    return () => clearInterval(intervalId);
  }, []);

  const queryResult = useQuery({
    queryKey: getNearbyReportsQueryKey(queryLocation, radiusMeters),
    queryFn: async () => fetchNearbyReportsQuery(queryLocation, radiusMeters),
    enabled: !!queryLocation,
    placeholderData: (previousData) => previousData,
    staleTime:
      staleTimeMs === Infinity
        ? Infinity
        : Math.max(0, Number(staleTimeMs) || DEFAULT_NEARBY_REPORTS_STALE_TIME_MS),
    refetchOnMount,
    refetchInterval:
      refetchIntervalMs === false
        ? false
        : Math.max(
            1000,
            Number(refetchIntervalMs) || DEFAULT_NEARBY_REPORTS_REFETCH_INTERVAL_MS,
          ),
  });

  const localReports = useMemo(
    () =>
      getNearbyLocalReports(location, radiusMeters)
        .map((report) => normalizeReport(report))
        .filter(Boolean)
        .filter((report) => isReportActive(report, currentTimeMs)),
    [location?.latitude, location?.longitude, radiusMeters, localReportsVersion, currentTimeMs],
  );
  const remoteReports = useMemo(
    () =>
      (queryResult.data?.spots || [])
        .map((report) => normalizeReport(report))
        .filter(Boolean)
        .filter((report) => isReportActive(report, currentTimeMs)),
    [queryResult.data, currentTimeMs],
  );
  const reportIdsFromRemote = useMemo(
    () => new Set(remoteReports.map((report) => report.id)),
    [remoteReports],
  );
  const localOnlyReports = useMemo(
    () =>
      localReports.filter((report) => {
        if (reportIdsFromRemote.has(report.id)) {
          return false;
        }

        return isLocalReportWithinSyncGrace(report, currentTimeMs);
      }),
    [currentTimeMs, localReports, reportIdsFromRemote],
  );

  useEffect(() => {
    if (!queryResult.isSuccess || queryResult.data?.success !== true) {
      return;
    }

    localReports.forEach((report) => {
      if (reportIdsFromRemote.has(report.id)) {
        return;
      }

      if (isLocalReportWithinSyncGrace(report, currentTimeMs)) {
        return;
      }

      removeLocalReport(report.id);
    });
  }, [currentTimeMs, localReports, queryResult.data?.success, queryResult.isSuccess, reportIdsFromRemote]);

  const mergedReports = useMemo(() => {
    return [...remoteReports, ...localOnlyReports];
  }, [localOnlyReports, remoteReports]);

  return {
    reports: mergedReports,
    refetch: queryResult.refetch,
    isLoading: queryResult.isLoading,
    isRefetching: queryResult.isRefetching,
  };
};

export const useReportSpot = (location, onSuccess) => {
  const queryClient = useQueryClient();
  const { data: user } = useUser();
  const baseUrl = getResolvedBaseUrl();
    const reportSpotUrl = resolveBackendUrl("/api/reports/create");
    const resolvedReportRequestUrl = reportSpotUrl || "/api/reports/create";

  const appendNotificationCache = (notification) => {
    queryClient
      .getQueryCache()
      .findAll(({ queryKey }) =>
        ["notifications", "notifications_count", ACTIVITY_NOTIFICATIONS_QUERY_KEY[0]].includes(
          queryKey?.[0],
        ),
      )
      .forEach((query) => {
        queryClient.setQueryData(query.queryKey, (prev) => {
          const localEntry = { ...notification, id: `${notification.id}-local` };

          if (query.queryKey?.[0] === ACTIVITY_NOTIFICATIONS_QUERY_KEY[0]) {
            const existing = Array.isArray(prev) ? prev : [];
            return [
              localEntry,
              ...existing.filter((item) => String(item?.id) !== String(localEntry.id)),
            ];
          }

          const existing = prev?.notifications || [];
          return {
            ...prev,
            notifications: [localEntry, ...existing],
          };
        });
      });
  };

  return useMutation({
    mutationFn: async ({ coords, userCoords, parkingType, quantity, zoneId }) => {
      const session = useAuthStore.getState().session;

      if (!user?.id) {
        console.error("[report.create] Cannot report without an authenticated user", {
          hasSession: !!session,
          hasAccessToken: !!session?.access_token,
        });
        throw new Error("Please sign in to report parking spots");
      }

      console.log("[report.create] Reporting spot", {
        userId: user.id,
        latitude: coords.latitude,
        longitude: coords.longitude,
        userLatitude: userCoords?.latitude ?? null,
        userLongitude: userCoords?.longitude ?? null,
        parkingType,
        quantity,
        zoneId,
        apiBaseUrl: baseUrl || "relative fetch",
        reportSpotUrl,
        hasSession: !!session,
        hasAccessToken: !!session?.access_token,
      });

      try {
        const response = await fetch(resolvedReportRequestUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: coords.latitude,
            longitude: coords.longitude,
            userLatitude: userCoords?.latitude ?? coords.latitude,
            userLongitude: userCoords?.longitude ?? coords.longitude,
            parkingType: parkingType || "1P",
            quantity: quantity || 1,
            zoneId: zoneId || null,
          }),
        });

        const responseText = await response.text().catch(() => "");
        const responseJson = safeJsonParse(responseText);

        console.log("[report.create] Report response received", {
          status: response.status,
          ok: response.ok,
          requestUrl: resolvedReportRequestUrl,
          resolvedBackendUrl: reportSpotUrl,
          body: responseJson || responseText || null,
        });

        if (!response.ok) {
          let errorMessage = `Server error: ${response.status}`;
          if (response.status === 404) {
            errorMessage = `Reporting API not found at ${resolvedReportRequestUrl}. Verify EXPO_PUBLIC_BASE_URL points to a deployed ParkMate server.`;
          }
          const errorData = responseJson;
          errorMessage =
            errorData?.message ||
            errorData?.error ||
            responseText ||
            errorMessage;
          throw new Error(errorMessage);
        }

        const data = responseJson ?? safeJsonParse(responseText);
        console.log("[report.create] Report success payload", data);
        return data;
      } catch (networkError) {
        console.error("[report.create] Report request failed", {
          message: networkError?.message || String(networkError),
          apiBaseUrl: baseUrl || null,
          reportSpotUrl,
        });
        throw networkError;
      }
    },
    onSuccess: async (data) => {
      try {
        if (data?.report) {
          const normalizedReport = normalizeReport(data.report, data.zone);
          console.log("[report.create] Normalized reported spot", normalizedReport);
          if (!normalizedReport) {
            throw new Error("Reported spot did not include valid coordinates");
          }

          persistLocalReport({
            report: normalizedReport,
            parkingType: normalizedReport.parking_type,
            quantity: normalizedReport.quantity,
            userId: normalizedReport.user_id,
            queryClient,
            appendNotificationCache,
          });
          data.report = normalizedReport;
          console.log("[report.create] Report persisted locally", {
            reportId: normalizedReport.id,
            latitude: normalizedReport.latitude,
            longitude: normalizedReport.longitude,
          });
        }

        Alert.alert(
          "Spot Reported Successfully!",
          `You've reported ${data.report?.quantity || 1} spot${data.report?.quantity > 1 ? "s" : ""} in the ${data.zone?.zone_type || "Unknown"} zone.\n\n+${data.pointsAwarded || 5} points earned!`,
          [{ text: "OK" }],
        );

        queryClient.invalidateQueries({ queryKey: ["nearby_reports"] });
        queryClient.invalidateQueries({ queryKey: ["spots_count"] });
        queryClient.invalidateQueries({ queryKey: ["notifications_count"] });
        queryClient.invalidateQueries({ queryKey: ACTIVITY_NOTIFICATIONS_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: ACTIVITY_MAILBOX_QUERY_KEY });
        console.log("[report.create] Invalidated report-related queries");
        if (onSuccess) onSuccess(data);
      } catch (successError) {
        console.error("[report.create] Report success handling failed", {
          message: successError?.message || String(successError),
          data,
        });
        Alert.alert(
          "Spot Saved Locally",
          "The spot was recorded, but part of the success flow failed. Check the map and spots list.",
          [{ text: "OK" }],
        );
      }
    },
      onError: (error) => {
        console.error("[report.create] Report error", {
          message: error?.message || String(error),
          location,
          reportSpotUrl,
          requestUrl: resolvedReportRequestUrl,
        });
      Alert.alert(
        "Report Failed",
        error?.message || "Unable to report parking spot. Please try again.",
        [{ text: "OK" }],
      );
    },
  });
};

export const useClaimSpot = (location, onSuccess, onTimerStart) => {
  const qc = useQueryClient();
  const { data: user } = useUser();

  return useMutation({
    mutationFn: async (claimInput) => {
      if (!user?.id) {
        throw new Error("Please sign in to claim parking spots");
      }

      const reportId =
        claimInput && typeof claimInput === "object" ? claimInput.reportId : claimInput;
      const selectedParkingType =
        claimInput && typeof claimInput === "object"
          ? normalizeParkingTypeLabel(claimInput.parkingType)
          : null;
      const currentLocation =
        claimInput &&
        typeof claimInput === "object" &&
        claimInput.currentLocation &&
        normalizeCoordinate(claimInput.currentLocation.latitude) !== null &&
        normalizeCoordinate(claimInput.currentLocation.longitude) !== null
          ? {
              latitude: normalizeCoordinate(claimInput.currentLocation.latitude),
              longitude: normalizeCoordinate(claimInput.currentLocation.longitude),
            }
          : getQueryLocation(location, 6);

      const reportSnapshot = findReportSnapshot(qc, reportId);
      const claimTarget =
        claimInput && typeof claimInput === "object" ? claimInput.spot || null : null;
      const normalizedClaimTarget = normalizeReport(claimTarget);
      let parkingType =
        selectedParkingType ||
        normalizeParkingTypeLabel(reportSnapshot?.parking_type) ||
        normalizeParkingTypeLabel(reportSnapshot?.zone_type) ||
        "1P";
      if (!selectedParkingType) {
        const spotResponse = await fetch("/api/reports/nearby", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: 0,
            longitude: 0,
            radiusMeters: 999999,
          }),
        });

        if (spotResponse.ok) {
          const spotsData = await spotResponse.json();
          const spot = spotsData.spots?.find((s) => s.id === reportId);
          if (spot) {
            parkingType =
              normalizeParkingTypeLabel(spot.parking_type) ||
              normalizeParkingTypeLabel(spot.zone_type) ||
              "1P";
          }
        }
      }

      const targetLocation = normalizedClaimTarget || reportSnapshot;
      const claimDistanceMeters = currentLocation
        ? getDistanceMeters(currentLocation, targetLocation)
        : null;

      if (!currentLocation) {
        throw new Error(
          "Current location is required to confirm you are within 5m of the reported spot",
        );
      }

      if (
        claimDistanceMeters !== null &&
        claimDistanceMeters > CLAIM_SPOT_MAX_DISTANCE_METERS
      ) {
        throw new Error(
          `Move closer to the reported spot coordinates before claiming it. You must be within ${CLAIM_SPOT_MAX_DISTANCE_METERS}m.`,
        );
      }

      const response = await fetch("/api/reports/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId,
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to claim spot");
      }
      const result = await response.json();
      return { ...result, parkingType, reportId, reportSnapshot, currentLocation };
    },
    onSuccess: ({
      parkingType,
      reportId,
      reportSnapshot,
      report,
      claimedQuantity,
      remainingQuantity,
      wasExhausted,
    }) => {
      const normalizedClaimedQuantity = Math.max(
        1,
        Number.isFinite(Number(claimedQuantity))
          ? Math.floor(Number(claimedQuantity))
          : 1,
      );
      const normalizedRemainingQuantity = Math.max(
        0,
        Number.isFinite(Number(remainingQuantity))
          ? Math.floor(Number(remainingQuantity))
          : Math.max((Number(reportSnapshot?.quantity) || 1) - normalizedClaimedQuantity, 0),
      );

      if (reportSnapshot) {
        const activityEntry = {
          ...createActivityEntry({
            activityType: "claimed",
            report: reportSnapshot,
            parkingType,
            quantity: normalizedClaimedQuantity,
            userId: user?.id,
          }),
          id: `claimed-${reportId}-local`,
        };
        appendActivityCache(qc, activityEntry);
        addLocalNotification(activityEntry);
      }

      if (wasExhausted || normalizedRemainingQuantity <= 0) {
        removeLocalReport(reportId);
        removeReportFromNearbyQueries(qc, reportId);
      } else if (reportSnapshot) {
        const updatedReport = normalizeReport({
          ...reportSnapshot,
          ...report,
          id: reportId,
          quantity: normalizedRemainingQuantity,
          status: "available",
        });

        if (updatedReport) {
          upsertLocalReport(updatedReport);
          upsertReportInNearbyQueries(qc, updatedReport);
        }
      }

      qc.invalidateQueries({ queryKey: ["nearby_reports"] });
      qc.invalidateQueries({ queryKey: ["spots_count"] });
      qc.invalidateQueries({ queryKey: ["notifications_count"] });
      qc.invalidateQueries({ queryKey: ACTIVITY_NOTIFICATIONS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: ACTIVITY_MAILBOX_QUERY_KEY });
      if (onSuccess) {
        onSuccess({
          parkingType,
          reportId,
          reportSnapshot,
          report,
          claimedQuantity: normalizedClaimedQuantity,
          remainingQuantity: normalizedRemainingQuantity,
          wasExhausted,
          onTimerStart,
        });
      }
    },
    onError: (error) => {
      Alert.alert("Error", error.message);
    },
  });
};

export const useSuggestParkingZone = (location, onSuccess) => {
  const { data: user } = useUser();
  const suggestZoneUrl = resolveBackendUrl("/api/zones/suggest");

  return useMutation({
    mutationFn: async ({ coords }) => {
      const session = useAuthStore.getState().session;

      if (!user?.id) {
        throw new Error("Please sign in to suggest parking zones");
      }

      const response = await fetch(suggestZoneUrl || "/api/zones/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: coords?.latitude,
          longitude: coords?.longitude,
        }),
      });

      const responseText = await response.text().catch(() => "");
      const payload = safeJsonParse(responseText);

      console.log("[zones.suggest] Suggest zone response received", {
        requestUrl: suggestZoneUrl || "/api/zones/suggest",
        status: response.status,
        ok: response.ok,
        hasSession: !!session,
        hasAccessToken: !!session?.access_token,
        body: payload || responseText || null,
      });

      if (!response.ok) {
        throw new Error(
          payload?.message ||
            payload?.error ||
            responseText ||
            "Failed to suggest parking zone",
        );
      }

      return payload || {};
    },
    onSuccess: (data) => {
      if (onSuccess) {
        onSuccess(data);
      }
    },
    onError: (error) => {
      Alert.alert("Unable to suggest zone", error.message);
    },
  });
};

export const useReportFalseSpot = (onSuccess) => {
  const queryClient = useQueryClient();
  const { data: user } = useUser();
  const reportFalseUrl = resolveBackendUrl("/api/reports/report-false");

  return useMutation({
    mutationFn: async (reportInput) => {
      if (!user?.id) throw new Error("User not authenticated");
      const reportId =
        reportInput && typeof reportInput === "object"
          ? reportInput.id ?? reportInput.reportId
          : reportInput;
      const normalizedReportInput =
        reportInput && typeof reportInput === "object" ? normalizeReport(reportInput) : null;
      const reportSnapshot = findReportSnapshot(queryClient, reportId);
      const resolvedReportSnapshot = reportSnapshot || normalizedReportInput;

      console.log("[report.false] Submitting false-report request", {
        reportId,
        requestUrl: reportFalseUrl || "/api/reports/report-false",
        hasUser: !!user?.id,
      });

      const response = await fetch(reportFalseUrl || "/api/reports/report-false", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId,
        }),
      });

      if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      const error = safeJsonParse(responseText);
      console.log("[report.false] False-report response received", {
        reportId,
        requestUrl: reportFalseUrl || "/api/reports/report-false",
        status: response.status,
        ok: response.ok,
        body: error || responseText || null,
      });
      throw new Error(
        error?.message ||
          error?.error ||
          responseText ||
          "Failed to report false spot",
        );
      }
      const responseText = await response.text().catch(() => "");
      const result = safeJsonParse(responseText) || {};
      console.log("[report.false] False-report success payload", {
        reportId,
        requestUrl: reportFalseUrl || "/api/reports/report-false",
        body: result,
      });
      return { ...result, reportId, reportSnapshot: resolvedReportSnapshot };
    },
    onSuccess: ({
      reportId,
      reportSnapshot,
      falseReportCount,
      trustScoreThreshold,
      trustScoreAffected,
    }) => {
      if (reportSnapshot) {
        const activityEntry = {
          ...createActivityEntry({
            activityType: "false_reported",
            report: reportSnapshot,
            parkingType: reportSnapshot.parking_type,
            quantity: reportSnapshot.quantity,
            userId: user?.id,
          }),
          id: `false-${reportId}-local`,
        };
        appendActivityCache(queryClient, activityEntry);
        addLocalNotification(activityEntry);
      }

      removeLocalReport(reportId);
      removeReportFromNearbyQueries(queryClient, reportId);
      const threshold = Number(trustScoreThreshold) || 3;
      const count = Number(falseReportCount) || 0;
      const remainingReports = Math.max(0, threshold - count);
      const successMessage = trustScoreAffected
        ? "Three users have now flagged this spot as false, so the reporter's trust score has been reduced."
        : remainingReports === 1
          ? "Thanks for helping keep the map accurate. One more false report on this spot will affect the reporter's trust score."
          : `Thanks for helping keep the map accurate. ${remainingReports} more false reports on this spot are needed before the reporter's trust score changes.`;
      Alert.alert(
        "Report Submitted",
        successMessage,
      );
      queryClient.invalidateQueries({ queryKey: ["nearby_reports"] });
      queryClient.invalidateQueries({ queryKey: ACTIVITY_NOTIFICATIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ACTIVITY_MAILBOX_QUERY_KEY });
      if (onSuccess) onSuccess();
    },
    onError: (error) => {
      Alert.alert("Error", error.message);
    },
  });
};

export const useDeleteReportSpot = (onSuccess) => {
  const queryClient = useQueryClient();
  const deleteReportUrl = resolveBackendUrl("/api/reports/delete");

  return useMutation({
    mutationFn: async (reportId) => {
      if (!reportId) {
        throw new Error("reportId is required");
      }

      const response = await fetch(deleteReportUrl || "/api/reports/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId,
        }),
      });

      const responseText = await response.text().catch(() => "");
      const responseJson = safeJsonParse(responseText);

      if (!response.ok) {
        throw new Error(
          responseJson?.error ||
            responseJson?.message ||
            responseText ||
            "Failed to delete report",
        );
      }

      return responseJson || { success: true, reportId };
    },
    onSuccess: ({ reportId }) => {
      removeLocalReport(reportId);
      removeReportFromNearbyQueries(queryClient, reportId);
      queryClient.invalidateQueries({ queryKey: ["nearby_reports"] });
      queryClient.invalidateQueries({ queryKey: ["spots_count"] });
      queryClient.invalidateQueries({ queryKey: ["notifications_count"] });
      queryClient.invalidateQueries({ queryKey: ACTIVITY_NOTIFICATIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ACTIVITY_MAILBOX_QUERY_KEY });

      if (onSuccess) {
        onSuccess({ reportId });
      }
    },
    onError: (error) => {
      Alert.alert("Error", error?.message || "Failed to delete report");
    },
  });
};
