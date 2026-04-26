import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const FIRST_LOGIN_TUTORIAL_KEY_PREFIX = "parkmate-first-login-tutorial-complete";

const getFirstLoginTutorialStorageKey = (userId) =>
  `${FIRST_LOGIN_TUTORIAL_KEY_PREFIX}:${userId}`;

export const hasCompletedFirstLoginTutorial = async (userId) => {
  if (!userId) {
    return true;
  }

  try {
    const storedValue = await AsyncStorage.getItem(
      getFirstLoginTutorialStorageKey(userId),
    );
    return storedValue === "true";
  } catch (error) {
    console.warn("[first-login-tutorial] Failed to read tutorial state", {
      userId,
      message: error?.message || String(error),
    });
    return false;
  }
};

export const markFirstLoginTutorialComplete = async (userId) => {
  if (!userId) {
    return;
  }

  await AsyncStorage.setItem(
    getFirstLoginTutorialStorageKey(userId),
    "true",
  );
};

export const useFirstLoginTutorial = (userId) => {
  const [isLoading, setIsLoading] = useState(Boolean(userId));
  const [hasCompleted, setHasCompleted] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    if (!userId) {
      setHasCompleted(true);
      setIsLoading(false);
      return () => {
        isCancelled = true;
      };
    }

    setIsLoading(true);

    hasCompletedFirstLoginTutorial(userId)
      .then((completed) => {
        if (isCancelled) {
          return;
        }

        setHasCompleted(completed);
        setIsLoading(false);
      })
      .catch(() => {
        if (isCancelled) {
          return;
        }

        setHasCompleted(false);
        setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [userId]);

  const completeTutorial = useCallback(async () => {
    if (!userId) {
      return;
    }

    await markFirstLoginTutorialComplete(userId);
    setHasCompleted(true);
  }, [userId]);

  return {
    isLoading,
    hasCompleted,
    shouldShowTutorial: Boolean(userId) && !isLoading && !hasCompleted,
    completeTutorial,
  };
};

export default useFirstLoginTutorial;
