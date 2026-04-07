import AsyncStorage from "@react-native-async-storage/async-storage";

const ACTIVITY_LAST_VIEWED_AT_KEY = "activityNotifications:lastViewedAt";
const ACTIVITY_MANUAL_UNREAD_IDS_KEY = "activityNotifications:manualUnreadIds";
const ACTIVITY_DELETED_IDS_KEY = "activityNotifications:deletedIds";

let lastViewedAt = 0;
let hasHydrated = false;
let hydrationPromise = null;
let version = 0;
let manualUnreadIds = new Set();
let deletedIds = new Set();
const listeners = new Set();

const emitChange = () => {
  version += 1;
  listeners.forEach((listener) => listener());
};

const normalizeTimestamp = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const getNotificationTimestamp = (notification) =>
  Math.max(
    normalizeTimestamp(notification?.sent_at),
    normalizeTimestamp(notification?.occurred_at),
  );

const getLatestNotificationTimestamp = (notifications = []) =>
  notifications.reduce((latest, notification) => {
    const nextTimestamp = Math.max(
      normalizeTimestamp(notification?.sent_at),
      normalizeTimestamp(notification?.occurred_at),
    );
    return Math.max(latest, nextTimestamp);
  }, 0);

export const hydrateActivityReadState = async () => {
  if (hasHydrated) {
    return {
      lastViewedAt,
      manualUnreadIds,
      deletedIds,
    };
  }

  if (!hydrationPromise) {
    hydrationPromise = Promise.all([
      AsyncStorage.getItem(ACTIVITY_LAST_VIEWED_AT_KEY),
      AsyncStorage.getItem(ACTIVITY_MANUAL_UNREAD_IDS_KEY),
      AsyncStorage.getItem(ACTIVITY_DELETED_IDS_KEY),
    ])
      .then(([storedViewedAt, storedUnreadIds, storedDeletedIds]) => {
        const parsedValue = Number.parseInt(storedViewedAt || "0", 10);
        lastViewedAt = Number.isFinite(parsedValue) ? parsedValue : 0;
        manualUnreadIds = new Set(JSON.parse(storedUnreadIds || "[]"));
        deletedIds = new Set(JSON.parse(storedDeletedIds || "[]"));
        hasHydrated = true;
        emitChange();
        return {
          lastViewedAt,
          manualUnreadIds,
          deletedIds,
        };
      })
      .catch(() => {
        hasHydrated = true;
        emitChange();
        return {
          lastViewedAt,
          manualUnreadIds,
          deletedIds,
        };
      })
      .finally(() => {
        hydrationPromise = null;
      });
  }

  return hydrationPromise;
};

export const markActivityNotificationsViewed = async (notifications = []) => {
  const latestSeenAt = getLatestNotificationTimestamp(notifications);
  const nextViewedAt = Math.max(Date.now(), latestSeenAt);
  let hasChanged = false;

  notifications.forEach((notification) => {
    const notificationId = String(notification?.id || "");
    if (notificationId && manualUnreadIds.has(notificationId)) {
      manualUnreadIds.delete(notificationId);
      hasChanged = true;
    }
  });

  if (nextViewedAt <= lastViewedAt && !hasChanged) {
    return lastViewedAt;
  }

  lastViewedAt = nextViewedAt;
  emitChange();

  try {
    await Promise.all([
      AsyncStorage.setItem(
        ACTIVITY_LAST_VIEWED_AT_KEY,
        String(nextViewedAt),
      ),
      AsyncStorage.setItem(
        ACTIVITY_MANUAL_UNREAD_IDS_KEY,
        JSON.stringify([...manualUnreadIds]),
      ),
    ]);
  } catch {
    // Ignore persistence failures; the in-memory state still avoids stale badges.
  }

  return lastViewedAt;
};

export const markAllActivityNotificationsRead = async (notifications = []) =>
  markActivityNotificationsViewed(notifications);

export const getActivityLastViewedAt = () => lastViewedAt;
export const getActivityManualUnreadIds = () => manualUnreadIds;
export const getDeletedActivityIds = () => deletedIds;

export const getActivityReadStateVersion = () => version;

export const subscribeToActivityReadState = (listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const countUnreadActivityNotifications = (
  notifications = [],
  viewedAt = 0,
) =>
  notifications.filter((notification) => {
    const notificationId = String(notification?.id || "");
    if (notificationId && manualUnreadIds.has(notificationId)) {
      return true;
    }
    const notificationTimestamp = Math.max(
      normalizeTimestamp(notification?.sent_at),
      normalizeTimestamp(notification?.occurred_at),
    );
    return notificationTimestamp > viewedAt;
  }).length;

export const isActivityNotificationUnread = (
  notification,
  viewedAt = 0,
) => {
  const notificationId = String(notification?.id || "");
  if (notificationId && manualUnreadIds.has(notificationId)) {
    return true;
  }

  const notificationTimestamp = Math.max(
    normalizeTimestamp(notification?.sent_at),
    normalizeTimestamp(notification?.occurred_at),
  );
  return notificationTimestamp > viewedAt;
};

export const markActivityNotificationUnread = async (notification) => {
  const notificationId = String(notification?.id || "");
  if (!notificationId || manualUnreadIds.has(notificationId)) {
    return;
  }

  manualUnreadIds.add(notificationId);
  emitChange();

  try {
    await AsyncStorage.setItem(
      ACTIVITY_MANUAL_UNREAD_IDS_KEY,
      JSON.stringify([...manualUnreadIds]),
    );
  } catch {
    // Ignore persistence failures; in-memory state is still updated.
  }
};

export const markActivityNotificationRead = async (notification) => {
  const notificationId = String(notification?.id || "");
  const notificationTimestamp = getNotificationTimestamp(notification);
  let hasChanged = false;

  if (notificationId && manualUnreadIds.has(notificationId)) {
    manualUnreadIds.delete(notificationId);
    hasChanged = true;
  }

  if (notificationTimestamp > lastViewedAt) {
    lastViewedAt = notificationTimestamp;
    hasChanged = true;
  }

  if (!hasChanged) {
    return;
  }

  emitChange();

  try {
    await Promise.all([
      AsyncStorage.setItem(
        ACTIVITY_LAST_VIEWED_AT_KEY,
        String(lastViewedAt),
      ),
      AsyncStorage.setItem(
        ACTIVITY_MANUAL_UNREAD_IDS_KEY,
        JSON.stringify([...manualUnreadIds]),
      ),
    ]);
  } catch {
    // Ignore persistence failures; in-memory state is still updated.
  }
};

export const deleteActivityNotification = async (notification) => {
  const notificationId = String(notification?.id || "");
  if (!notificationId || deletedIds.has(notificationId)) {
    return;
  }

  deletedIds.add(notificationId);
  manualUnreadIds.delete(notificationId);
  emitChange();

  try {
    await Promise.all([
      AsyncStorage.setItem(
        ACTIVITY_DELETED_IDS_KEY,
        JSON.stringify([...deletedIds]),
      ),
      AsyncStorage.setItem(
        ACTIVITY_MANUAL_UNREAD_IDS_KEY,
        JSON.stringify([...manualUnreadIds]),
      ),
    ]);
  } catch {
    // Ignore persistence failures; in-memory state is still updated.
  }
};

export const deleteAllActivityNotifications = async (notifications = []) => {
  let hasChanged = false;

  notifications.forEach((notification) => {
    const notificationId = String(notification?.id || "");
    if (!notificationId) {
      return;
    }

    if (!deletedIds.has(notificationId)) {
      deletedIds.add(notificationId);
      hasChanged = true;
    }

    if (manualUnreadIds.has(notificationId)) {
      manualUnreadIds.delete(notificationId);
      hasChanged = true;
    }
  });

  if (!hasChanged) {
    return;
  }

  emitChange();

  try {
    await Promise.all([
      AsyncStorage.setItem(
        ACTIVITY_DELETED_IDS_KEY,
        JSON.stringify([...deletedIds]),
      ),
      AsyncStorage.setItem(
        ACTIVITY_MANUAL_UNREAD_IDS_KEY,
        JSON.stringify([...manualUnreadIds]),
      ),
    ]);
  } catch {
    // Ignore persistence failures; in-memory state is still updated.
  }
};
