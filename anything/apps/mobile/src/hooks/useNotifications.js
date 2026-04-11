import { useEffect, useRef } from "react";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { useQueryClient } from "@tanstack/react-query";
import {
  androidPushNotificationsConfigured,
  ensureAlertsNotificationChannel,
  getNotificationsModule,
  notificationsUnsupportedInCurrentRuntime,
  remotePushRegistrationUnsupportedInCurrentRuntime,
  warnMissingAndroidPushConfigOnce,
} from "@/lib/notifications";
import {
  addSentryBreadcrumb,
  captureError,
  captureMessage,
  normalizeForSentry,
  setSentryUser,
} from "@/monitoring/sentry";
import fetch from "@/__create/fetch";
import { ACTIVITY_MAILBOX_QUERY_KEY } from "@/hooks/useActivityMailbox";
import { ACTIVITY_NOTIFICATIONS_QUERY_KEY } from "@/hooks/useActivityNotifications";
import { resolveBackendUrl } from "@/utils/backend";
import useUser from "@/utils/auth/useUser";

let lastCompletedPushRegistrationKey = null;
let inFlightPushRegistrationKey = null;
let inFlightPushRegistrationPromise = null;

export const useNotifications = (onNotificationResponse) => {
  const { data: user } = useUser();
  const queryClient = useQueryClient();
  const notificationResponseHandlerRef = useRef(onNotificationResponse);
  const lastHandledNotificationResponseIdRef = useRef(null);

  useEffect(() => {
    notificationResponseHandlerRef.current = onNotificationResponse;
  }, [onNotificationResponse]);

  const handleNotificationResponse = (response, source = "listener") => {
    const responseIdentifier =
      response?.notification?.request?.identifier ||
      `${source}-${Date.now()}`;

    if (lastHandledNotificationResponseIdRef.current === responseIdentifier) {
      return;
    }

    lastHandledNotificationResponseIdRef.current = responseIdentifier;

    queryClient.invalidateQueries({ queryKey: ["nearby_reports"] });
    queryClient.invalidateQueries({ queryKey: ["parking_zones"] });
    queryClient.invalidateQueries({ queryKey: ["notifications_count"] });
    queryClient.invalidateQueries({ queryKey: ACTIVITY_NOTIFICATIONS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: ACTIVITY_MAILBOX_QUERY_KEY });

    addSentryBreadcrumb({
      category: "notifications.response",
      message: "Notification response received",
      data: normalizeForSentry({
        source,
        actionIdentifier: response?.actionIdentifier,
        identifier: response?.notification?.request?.identifier,
        data: response?.notification?.request?.content?.data,
        title: response?.notification?.request?.content?.title,
      }),
    });

    if (notificationResponseHandlerRef.current) {
      try {
        notificationResponseHandlerRef.current(response);
      } catch (error) {
        captureError(error, {
          handled: true,
          level: "error",
          tags: {
            notifications_stage: `response_${source}_callback`,
          },
          extras: {
            response: normalizeForSentry({
              actionIdentifier: response?.actionIdentifier,
              identifier: response?.notification?.request?.identifier,
              data: response?.notification?.request?.content?.data,
            }),
          },
        });
        throw error;
      }
    }
  };

  const clearLastNotificationResponse = async (Notifications, source) => {
    if (typeof Notifications?.clearLastNotificationResponseAsync !== "function") {
      return;
    }

    try {
      await Notifications.clearLastNotificationResponseAsync();
      addSentryBreadcrumb({
        category: "notifications.response",
        message: "Cleared last notification response after handling",
        data: {
          source,
        },
      });
    } catch (error) {
      captureError(error, {
        handled: true,
        level: "warning",
        tags: {
          notifications_stage: `clear_last_response_${source}`,
        },
      });
    }
  };

  useEffect(() => {
    setSentryUser(
      user?.id
        ? {
            id: String(user.id),
            email: user.email || null,
            username: user.username || null,
          }
        : null,
    );
  }, [user?.email, user?.id, user?.username]);

  useEffect(() => {
    let notificationSubscription;
    let responseSubscription;
    let isActive = true;

    if (notificationsUnsupportedInCurrentRuntime) {
      addSentryBreadcrumb({
        category: "notifications.lifecycle",
        level: "warning",
        message: "Notifications setup skipped in unsupported runtime",
        data: {
          appOwnership: Constants.appOwnership || "unknown",
          executionEnvironment: Constants.executionEnvironment || "unknown",
          platform: Constants.platform?.ios ? "ios" : Constants.platform?.android ? "android" : "unknown",
        },
      });
      console.log(
        "Skipping unsupported expo-notifications runtime. Use a development build for full notification support.",
      );
      return;
    }

    (async () => {
      const Notifications = await getNotificationsModule();
      if (!Notifications || !isActive) {
        return;
      }

      // Request permissions
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      if (!isActive) {
        return;
      }
      let finalStatus = existingStatus;
      addSentryBreadcrumb({
        category: "notifications.permissions",
        message: "Loaded existing notification permission status",
        data: {
          existingStatus,
          userId: user?.id || null,
        },
      });

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        if (!isActive) {
          return;
        }
        finalStatus = status;
        addSentryBreadcrumb({
          category: "notifications.permissions",
          message: "Requested notification permission",
          data: {
            finalStatus,
            previousStatus: existingStatus,
            userId: user?.id || null,
          },
        });
      }

      if (finalStatus !== "granted") {
        captureMessage("Notification permissions not granted during notifications setup", {
          handled: true,
          level: "warning",
          tags: {
            notifications_stage: "permissions",
          },
          extras: {
            finalStatus,
            userId: user?.id || null,
          },
        });
        console.log("Notification permissions not granted");
        return;
      }

      await ensureAlertsNotificationChannel();
      if (!isActive) {
        return;
      }

      if (!Device.isDevice) {
        addSentryBreadcrumb({
          category: "notifications.registration",
          message: "Push token registration skipped on simulator or emulator",
          data: {
            userId: user?.id || null,
          },
        });
        console.log("Skipping push token fetch on simulator/emulator");
        return;
      }

      if (remotePushRegistrationUnsupportedInCurrentRuntime) {
        addSentryBreadcrumb({
          category: "notifications.registration",
          level: "warning",
          message: "Remote push token registration skipped in unsupported runtime",
          data: {
            appOwnership: Constants.appOwnership || "unknown",
            executionEnvironment: Constants.executionEnvironment || "unknown",
            platform:
              Constants.platform?.ios ? "ios" : Constants.platform?.android ? "android" : "unknown",
            userId: user?.id || null,
          },
        });
        console.log(
          "Skipping remote push token registration in Expo Go. Use a development build for remote push notifications.",
        );
        return;
      }

      if (!androidPushNotificationsConfigured) {
        warnMissingAndroidPushConfigOnce(
          "Skipping push token fetch on Android because Firebase is not configured. Add apps/mobile/google-services.json and rebuild the development build.",
        );
        return;
      }

      if (!user?.id) {
        addSentryBreadcrumb({
          category: "notifications.registration",
          message: "Push token registration deferred until user is signed in",
        });
        console.log("Skipping push token registration until user is signed in");
        return;
      }

      // Get Expo push token
      try {
        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ||
          Constants.easConfig?.projectId ||
          Constants.expoConfig?.projectId ||
          process.env.EXPO_PUSH_PROJECT_ID;

        if (!projectId) {
          captureMessage("Push token registration skipped because no Expo project id is configured", {
            handled: true,
            level: "warning",
            tags: {
              notifications_stage: "push_token_project_id",
            },
            extras: {
              userId: user?.id || null,
            },
          });
          console.log("Skipping push token fetch because no projectId is configured");
          return;
        }

        const registrationKey = `${user.id}:${projectId}`;
        if (lastCompletedPushRegistrationKey === registrationKey) {
          addSentryBreadcrumb({
            category: "notifications.registration",
            message: "Skipping duplicate Expo push token registration",
            data: {
              projectId,
              userId: user.id,
            },
          });
          return;
        }

        if (
          inFlightPushRegistrationKey === registrationKey &&
          inFlightPushRegistrationPromise
        ) {
          await inFlightPushRegistrationPromise;
          return;
        }

        inFlightPushRegistrationKey = registrationKey;
        inFlightPushRegistrationPromise = (async () => {
          const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId,
          });
          if (!isActive) {
            return;
          }

          const expoPushToken = tokenData.data;
          console.log("Expo Push Token:", expoPushToken);
          addSentryBreadcrumb({
            category: "notifications.registration",
            message: "Expo push token fetched",
            data: {
              projectId,
              tokenSuffix:
                typeof expoPushToken === "string" && expoPushToken.length > 8
                  ? expoPushToken.slice(-8)
                  : expoPushToken,
              userId: user.id,
            },
          });
          const registerTokenUrl = resolveBackendUrl("/api/notifications/register-token");

          if (!registerTokenUrl) {
            console.warn("Skipping push token registration because no backend URL is configured");
            return;
          }

          const response = await fetch(registerTokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              expoPushToken,
              deviceId: Constants.sessionId || null,
            }),
          });
          if (!isActive) {
            return;
          }

          if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            captureMessage("Failed to register Expo push token", {
              handled: true,
              level: "warning",
              tags: {
                notifications_stage: "register_token_response",
              },
              extras: {
                errorText,
                registerTokenUrl,
                status: response.status,
                userId: user.id,
              },
            });
            console.error("Failed to register push token", errorText);
            return;
          }

          lastCompletedPushRegistrationKey = registrationKey;
          addSentryBreadcrumb({
            category: "notifications.registration",
            message: "Expo push token registered with backend",
            data: {
              registerTokenUrl,
              userId: user.id,
            },
          });
        })();

        await inFlightPushRegistrationPromise;
      } catch (error) {
        const message = error?.message || String(error);
        if (!isActive) {
          return;
        }
        if (
          message.includes("Fetch request has been canceled") ||
          message.includes("fetch request has been canceled")
        ) {
          console.log("Push token registration canceled before completion");
          return;
        }
        if (message.includes("EXPERIENCE_NOT_FOUND")) {
          console.warn("Push token registration skipped: Expo project id is not registered for push tokens.");
          return;
        }
        if (
          message.includes("Default FirebaseApp is not initialized") ||
          message.includes("fcm-credentials")
        ) {
          warnMissingAndroidPushConfigOnce(
            "Push token registration skipped: Android Firebase/FCM is not configured for this build. Add google-services.json, rebuild the app, and try again.",
          );
          return;
        }
        captureError(error, {
          handled: true,
          level: "error",
          tags: {
            notifications_stage: "push_token_registration",
          },
          extras: {
            message,
            userId: user?.id || null,
          },
        });
        console.error("Error getting push token:", message);
      } finally {
        inFlightPushRegistrationKey = null;
        inFlightPushRegistrationPromise = null;
      }
    })();

    // Listener for notifications received while app is in foreground
    getNotificationsModule().then((Notifications) => {
      if (!Notifications || !isActive) {
        return;
      }

      Promise.resolve(Notifications.getLastNotificationResponseAsync?.())
        .then((response) => {
          if (!isActive || !response) {
            return;
          }

          handleNotificationResponse(response, "initial");
          return clearLastNotificationResponse(Notifications, "initial");
        })
        .catch((error) => {
          captureError(error, {
            handled: true,
            level: "error",
            tags: {
              notifications_stage: "initial_response_lookup",
            },
          });
        });

      notificationSubscription = Notifications.addNotificationReceivedListener(
        (notification) => {
          queryClient.invalidateQueries({ queryKey: ["nearby_reports"] });
          queryClient.invalidateQueries({ queryKey: ["parking_zones"] });
          queryClient.invalidateQueries({ queryKey: ["notifications_count"] });
          queryClient.invalidateQueries({ queryKey: ACTIVITY_NOTIFICATIONS_QUERY_KEY });
          queryClient.invalidateQueries({ queryKey: ACTIVITY_MAILBOX_QUERY_KEY });

          addSentryBreadcrumb({
            category: "notifications.received",
            message: "Notification received while app was running",
            data: normalizeForSentry({
              date: notification?.date,
              identifier: notification?.request?.identifier,
              trigger: notification?.request?.trigger,
              data: notification?.request?.content?.data,
              title: notification?.request?.content?.title,
            }),
          });
          console.log("Notification received:", notification);
        },
      );

      // Listener for when user taps on notification
      responseSubscription =
        Notifications.addNotificationResponseReceivedListener((response) => {
          handleNotificationResponse(response, "listener");
          void clearLastNotificationResponse(Notifications, "listener");
        });
    }).catch((error) => {
      captureError(error, {
        handled: true,
        level: "error",
        tags: {
          notifications_stage: "listeners_setup",
        },
      });
      console.log("Skipping notifications setup:", error?.message || String(error));
    });

    return () => {
      isActive = false;

      // Safely remove notification subscriptions
      if (
        notificationSubscription &&
        typeof notificationSubscription.remove === "function"
      ) {
        try {
          notificationSubscription.remove();
        } catch (e) {
          console.log("Error removing notification subscription:", e);
        }
      }
      if (
        responseSubscription &&
        typeof responseSubscription.remove === "function"
      ) {
        try {
          responseSubscription.remove();
        } catch (e) {
          console.log("Error removing response subscription:", e);
        }
      }
    };
  }, [queryClient, user?.id]);
};
