import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import fetch from "@/__create/fetch";
import { resolveBackendUrl } from "@/utils/backend";
import { useActivityBackendVersion } from "@/hooks/useActivityBackendVersion";
import {
  getLocalNotifications,
  getLocalReportsVersion,
  subscribeToLocalReports,
} from "@/utils/localReports";
import {
  countUnreadActivityNotifications,
  getDeletedActivityIds,
  getActivityLastViewedAt,
  getActivityReadStateVersion,
  hydrateActivityReadState,
  subscribeToActivityReadState,
} from "@/utils/activityReadState";

export const ACTIVITY_NOTIFICATIONS_QUERY_KEY = ["activity_notifications"];
const ACTIVITY_FEED_TIMEOUT_MS = 15000;
const DEFAULT_ACTIVITY_FEED_REFETCH_INTERVAL_MS = 10000;

const readActivityResponse = async (response) => {
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(responseText || "Failed to fetch activity");
  }

  let result;
  try {
    result = responseText ? JSON.parse(responseText) : { notifications: [] };
  } catch {
    throw new Error(
      `Activity feed returned invalid JSON: ${responseText.slice(0, 120) || "empty response"}`,
    );
  }

  return result.notifications || [];
};

const fetchActivityNotifications = async (activityFeedUrl) => {
  let timeoutId;

  try {
    const response = await Promise.race([
      fetch(activityFeedUrl),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(
              `Activity feed request timed out after ${Math.round(ACTIVITY_FEED_TIMEOUT_MS / 1000)}s`,
            ),
          );
        }, ACTIVITY_FEED_TIMEOUT_MS);
      }),
    ]);

    const notifications = await readActivityResponse(response);
    console.log("[activity.fetch] Activity received", {
      count: notifications.length,
      systemUpdates: notifications.filter(
        (item) => Boolean(item?.is_system_update),
      ).length,
    });

    return notifications;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const normalizeActivityItem = (item) => {
  const id = String(item?.id || "").trim();
  if (!id) {
    return null;
  }

  const sentAt = item?.sent_at || item?.occurred_at || new Date().toISOString();
  const occurredAt = item?.occurred_at || item?.sent_at || sentAt;
  const quantity = Math.max(
    1,
    Number.isFinite(Number(item?.quantity)) ? Math.floor(Number(item.quantity)) : 1,
  );

  return {
    ...item,
    id,
    activity_type: String(item?.activity_type || "reported"),
    sent_at: String(sentAt),
    occurred_at: String(occurredAt),
    zone_name: String(item?.zone_name || "Reported spot"),
    zone_type: item?.zone_type ? String(item.zone_type) : null,
    parking_type: item?.parking_type ? String(item.parking_type) : null,
    quantity,
  };
};

const getCanonicalActivityId = (value) => String(value || "").replace(/-local$/, "");

export const useActivityNotifications = (
  limit = 100,
  enabled = true,
  options = {},
) => {
  const {
    refetchIntervalMs = false,
    refetchOnMount = false,
    staleTimeMs = Infinity,
  } = options;
  const activityVersionQuery = useActivityBackendVersion(enabled);
  const localReportsVersion = useSyncExternalStore(
    subscribeToLocalReports,
    getLocalReportsVersion,
    getLocalReportsVersion,
  );
  const activityReadStateVersion = useSyncExternalStore(
    subscribeToActivityReadState,
    getActivityReadStateVersion,
    getActivityReadStateVersion,
  );
  const activityFeedUrl = resolveBackendUrl(`/api/notifications/activity?limit=${limit}`);

  const query = useQuery({
    queryKey: [...ACTIVITY_NOTIFICATIONS_QUERY_KEY, limit],
    queryFn: async () => {
      if (!activityFeedUrl) {
        throw new Error("Activity feed backend URL is not configured");
      }

      return fetchActivityNotifications(activityFeedUrl);
    },
    enabled,
    staleTime: staleTimeMs === Infinity ? Infinity : Math.max(0, Number(staleTimeMs) || 0),
    refetchOnMount,
    refetchInterval:
      enabled && refetchIntervalMs !== false
        ? Math.max(1000, Number(refetchIntervalMs) || DEFAULT_ACTIVITY_FEED_REFETCH_INTERVAL_MS)
        : false,
    retry: false,
  });

  const data = useMemo(() => {
    const localNotifications = getLocalNotifications();
    const deletedIds = getDeletedActivityIds();
    const localEntries = Array.isArray(localNotifications)
      ? localNotifications
          .filter((item) => item?.activity_type)
          .map(normalizeActivityItem)
          .filter(Boolean)
      : [];
    const remoteEntries = Array.isArray(query.data)
      ? query.data.map(normalizeActivityItem).filter(Boolean)
      : [];
    const mergedByCanonicalId = new Map();

    localEntries.forEach((item) => {
      const canonicalId = getCanonicalActivityId(item?.id);
      if (!canonicalId || mergedByCanonicalId.has(canonicalId)) {
        return;
      }

      mergedByCanonicalId.set(canonicalId, item);
    });

    remoteEntries.forEach((item) => {
      const canonicalId = getCanonicalActivityId(item?.id);
      if (!canonicalId) {
        return;
      }

      mergedByCanonicalId.set(canonicalId, item);
    });

    return [...mergedByCanonicalId.values()].sort((a, b) => {
      const aTime = new Date(a?.sent_at || a?.occurred_at || 0).getTime();
      const bTime = new Date(b?.sent_at || b?.occurred_at || 0).getTime();
      return bTime - aTime;
    }).filter((item) => {
      const itemId = String(item?.id || "");
      const canonicalId = getCanonicalActivityId(itemId);
      return !deletedIds.has(itemId) && !deletedIds.has(canonicalId);
    });
  }, [localReportsVersion, activityReadStateVersion, query.data]);

  return {
    ...query,
    data,
    activityVersion: activityVersionQuery.data,
    refetchActivityVersion: activityVersionQuery.refetch,
    isActivityVersionRefetching: activityVersionQuery.isRefetching,
  };
};

export const useUnreadActivityCount = (limit = 100, enabled = true) => {
  const activityReadStateVersion = useSyncExternalStore(
    subscribeToActivityReadState,
    getActivityReadStateVersion,
    getActivityReadStateVersion,
  );
  const activityQuery = useActivityNotifications(limit, enabled);

  useEffect(() => {
    hydrateActivityReadState().catch(() => {});
  }, []);

  const unreadCount = useMemo(() => {
    const viewedAt = getActivityLastViewedAt();
    return countUnreadActivityNotifications(activityQuery.data, viewedAt);
  }, [activityQuery.data, activityReadStateVersion]);

  return {
    ...activityQuery,
    unreadCount,
  };
};
