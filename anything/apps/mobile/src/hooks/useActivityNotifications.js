import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import fetch from "@/__create/fetch";
import { resolveBackendUrl } from "@/utils/backend";
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

    return readActivityResponse(response);
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

export const useActivityNotifications = (limit = 100, enabled = true) => {
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
    refetchInterval: 30000,
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
    const seenIds = new Set();
    const merged = [];

    localEntries.forEach((item) => {
      const id = String(item?.id || "");
      if (!id || seenIds.has(id)) return;
      seenIds.add(id);
      merged.push(item);
    });

    remoteEntries.forEach((item) => {
      const id = String(item?.id || "");
      if (!id || seenIds.has(id)) return;
      seenIds.add(id);
      merged.push(item);
    });

    return merged.sort((a, b) => {
      const aTime = new Date(a?.sent_at || a?.occurred_at || 0).getTime();
      const bTime = new Date(b?.sent_at || b?.occurred_at || 0).getTime();
      return bTime - aTime;
    }).filter((item) => !deletedIds.has(String(item?.id || "")));
  }, [localReportsVersion, activityReadStateVersion, query.data]);

  return {
    ...query,
    data,
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
