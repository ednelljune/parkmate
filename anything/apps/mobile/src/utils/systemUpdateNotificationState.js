import AsyncStorage from "@react-native-async-storage/async-storage";

const getStorageKey = (userId) => `systemUpdates:notifiedIds:${String(userId || "")}`;
const MAX_STORED_IDS = 250;

const normalizeIds = (items = []) =>
  items
    .map((item) => String(item?.id || "").trim())
    .filter(Boolean);

export const hydrateSystemUpdateNotificationState = async (userId) => {
  if (!userId) {
    return {
      initialized: false,
      notifiedIds: new Set(),
    };
  }

  try {
    const storedValue = await AsyncStorage.getItem(getStorageKey(userId));
    if (!storedValue) {
      return {
        initialized: false,
        notifiedIds: new Set(),
      };
    }

    const parsedIds = JSON.parse(storedValue);
    const normalizedIds = Array.isArray(parsedIds) ? parsedIds.map(String).filter(Boolean) : [];

    return {
      initialized: true,
      notifiedIds: new Set(normalizedIds),
    };
  } catch {
    return {
      initialized: false,
      notifiedIds: new Set(),
    };
  }
};

export const markSystemUpdatesNotified = async (userId, items = []) => {
  if (!userId) {
    return;
  }

  const nextIds = normalizeIds(items);
  if (nextIds.length === 0) {
    return;
  }

  const currentState = await hydrateSystemUpdateNotificationState(userId);
  const mergedIds = [...new Set([...nextIds, ...currentState.notifiedIds])].slice(0, MAX_STORED_IDS);

  try {
    await AsyncStorage.setItem(
      getStorageKey(userId),
      JSON.stringify(mergedIds),
    );
  } catch {
    // Ignore persistence failures; notification delivery should not fail because of storage.
  }
};

export const primeSystemUpdatesNotified = async (userId, items = []) =>
  markSystemUpdatesNotified(userId, items);
