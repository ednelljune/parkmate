import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";
import { getResolvedBaseUrl, resolveBackendUrl } from "@/utils/backend";
import useUser from "@/utils/auth/useUser";
import { useAuthStore } from "@/utils/auth/store";
import { getDistanceMeters } from "@/utils/geo";
import {
  getNearbyLocalReports,
  addLocalReport,
  addLocalNotification,
  removeLocalReport,
  upsertLocalReport,
  getLocalReportsVersion,
  subscribeToLocalReports,
} from "@/utils/localReports";
import { ACTIVITY_NOTIFICATIONS_QUERY_KEY } from "@/hooks/useActivityNotifications";

const CLAIM_SPOT_MAX_DISTANCE_METERS = 75;
const REPORT_TTL_MS = 3 * 60 * 1000;

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

const getQueryLocation = (location, precision = 4) => {
  if (!location) return null;

  const latitude = roundCoordinate(location.latitude, precision);
  const longitude = roundCoordinate(location.longitude, precision);

  if (latitude === null || longitude === null) {
    return null;
  }

  return { latitude, longitude };
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
    queryKey: [
      "parking_zones",
      queryLocation?.latitude,
      queryLocation?.longitude,
      radiusMeters,
    ],
    queryFn: async () => {
      if (!queryLocation) return { zones: [] };

      const response = await fetch("/api/zones/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: queryLocation.latitude,
          longitude: queryLocation.longitude,
          radiusMeters,
          includeGeometry: false,
        }),
      });

      if (!response.ok) return { zones: [] };
      return response.json();
    },
    enabled: !!queryLocation,
    placeholderData: (previousData) => previousData,
    staleTime: 30000,
  });

  return zonesData?.zones || [];
};

export const useCurrentZone = (location) => {
  const queryLocation = useMemo(() => getQueryLocation(location), [location]);
  const { data: currentZoneData } = useQuery({
    queryKey: ["current_zone", queryLocation?.latitude, queryLocation?.longitude],
    queryFn: async () => {
      if (!queryLocation) return { zone: null };

      const response = await fetch("/api/zones/at-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: queryLocation.latitude,
          longitude: queryLocation.longitude,
        }),
      });

      if (!response.ok) return { zone: null };
      return response.json();
    },
    enabled: !!queryLocation,
    placeholderData: (previousData) => previousData,
    staleTime: 30000,
  });

  return currentZoneData?.zone || null;
};

export const useNearbyReports = (location, radiusMeters = 500) => {
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
    queryKey: [
      "nearby_reports",
      queryLocation?.latitude,
      queryLocation?.longitude,
      radiusMeters,
    ],
    queryFn: async () => {
      if (!queryLocation) return { spots: [] };

      const response = await fetch("/api/reports/nearby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: queryLocation.latitude,
          longitude: queryLocation.longitude,
          radiusMeters,
        }),
      });

      if (!response.ok) {
        return { spots: [] };
      }

      return response.json();
    },
    enabled: !!queryLocation,
    placeholderData: (previousData) => previousData,
    staleTime: 15000,
    refetchInterval: 15000,
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
  const mergedReports = useMemo(() => {
    if (queryResult.isSuccess) {
      return remoteReports;
    }

    const localIds = new Set(localReports.map((report) => report.id));
    return [
      ...localReports,
      ...remoteReports.filter((report) => !localIds.has(report.id)),
    ];
  }, [localReports, remoteReports, queryResult.isSuccess]);

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
    mutationFn: async ({ coords, parkingType, quantity, zoneId }) => {
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
        parkingType,
        quantity,
        zoneId,
        apiBaseUrl: baseUrl || "relative fetch",
        reportSpotUrl,
        hasSession: !!session,
        hasAccessToken: !!session?.access_token,
      });

      try {
        const response = await fetch("/api/reports/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: coords.latitude,
            longitude: coords.longitude,
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
          requestPath: "/api/reports/create",
          resolvedBackendUrl: reportSpotUrl,
          body: responseJson || responseText || null,
        });

        if (!response.ok) {
          let errorMessage = `Server error: ${response.status}`;
          if (response.status === 404) {
            errorMessage = `Reporting API not found at ${reportSpotUrl || baseUrl || "configured backend"}. Verify EXPO_PUBLIC_BASE_URL points to a deployed ParkMate server.`;
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
        throw new Error("Current location is required to claim a parking spot");
      }

      if (
        claimDistanceMeters !== null &&
        claimDistanceMeters > CLAIM_SPOT_MAX_DISTANCE_METERS
      ) {
        throw new Error(
          `Move closer to the reported spot before claiming it. You must be within ${CLAIM_SPOT_MAX_DISTANCE_METERS}m.`,
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

export const useReportFalseSpot = (onSuccess) => {
  const queryClient = useQueryClient();
  const { data: user } = useUser();

  return useMutation({
    mutationFn: async (reportId) => {
      if (!user?.id) throw new Error("User not authenticated");
      const reportSnapshot = findReportSnapshot(queryClient, reportId);

      const response = await fetch("/api/reports/report-false", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId,
        }),
      });

      if (!response.ok) {
        const responseText = await response.text().catch(() => "");
        const error = safeJsonParse(responseText);
        throw new Error(
          error?.message ||
            error?.error ||
            responseText ||
            "Failed to report false spot",
        );
      }
      const responseText = await response.text().catch(() => "");
      const result = safeJsonParse(responseText) || {};
      return { ...result, reportId, reportSnapshot };
    },
    onSuccess: ({ reportId, reportSnapshot }) => {
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
      Alert.alert(
        "Report Submitted",
        "Thank you for helping keep our data accurate. The reporter's trust score has been updated.",
      );
      queryClient.invalidateQueries({ queryKey: ["nearby_reports"] });
      queryClient.invalidateQueries({ queryKey: ACTIVITY_NOTIFICATIONS_QUERY_KEY });
      if (onSuccess) onSuccess();
    },
    onError: (error) => {
      Alert.alert("Error", error.message);
    },
  });
};
