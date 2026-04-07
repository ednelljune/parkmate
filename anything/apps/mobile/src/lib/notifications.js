import Constants from 'expo-constants';
import { Platform } from 'react-native';
import fetch from '@/__create/fetch';
import {
  addSentryBreadcrumb,
  captureError,
  captureMessage,
  normalizeForSentry,
} from '@/monitoring/sentry';
import { resolveBackendUrl } from '@/utils/backend';

export const isExpoGo =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === 'storeClient';

export const notificationsUnsupportedInCurrentRuntime =
  Platform.OS === 'web' || (Platform.OS === 'android' && isExpoGo);

export const remotePushRegistrationUnsupportedInCurrentRuntime =
  Platform.OS === 'web' || isExpoGo;

const publicConfig = Constants.expoConfig?.extra?.publicConfig ?? {};

export const androidPushNotificationsConfigured =
  Platform.OS !== 'android' ||
  Constants.expoConfig?.extra?.androidFcmConfigured === true ||
  Constants.expoConfig?.android?.googleServicesFile ||
  publicConfig.EXPO_PUBLIC_ANDROID_FCM_CONFIGURED === 'true';

let notificationsModulePromise = null;
let hasWarnedMissingAndroidPushConfig = false;

const summarizeNotificationData = (data) => {
  if (!data || typeof data !== 'object') {
    return normalizeForSentry(data);
  }

  return normalizeForSentry({
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    parking_type: data.parking_type ?? null,
    reportId: data.reportId ?? null,
    zoneId: data.zoneId ?? null,
    zoneName: data.zoneName ?? data.zone_name ?? null,
    zoneType: data.zoneType ?? data.zone_type ?? null,
  });
};

export function warnMissingAndroidPushConfigOnce(message) {
  if (hasWarnedMissingAndroidPushConfig) {
    return;
  }

  hasWarnedMissingAndroidPushConfig = true;
  console.warn(message);
}

export async function getNotificationsModule() {
  if (notificationsUnsupportedInCurrentRuntime) {
    return null;
  }

  if (!notificationsModulePromise) {
    notificationsModulePromise = import('expo-notifications').catch((error) => {
      notificationsModulePromise = null;
      captureError(error, {
        handled: true,
        level: 'error',
        tags: {
          notifications_stage: 'load_module',
          platform: Platform.OS,
        },
      });
      throw error;
    });
  }

  return notificationsModulePromise;
}

export async function configureNotificationHandler(handler) {
  try {
    const Notifications = await getNotificationsModule();

    if (!Notifications) {
      addSentryBreadcrumb({
        category: 'notifications.config',
        level: 'warning',
        message: 'Notification handler skipped because notifications module is unavailable',
        data: {
          platform: Platform.OS,
        },
      });
      return false;
    }

    Notifications.setNotificationHandler(handler);
    addSentryBreadcrumb({
      category: 'notifications.config',
      message: 'Notification handler configured',
      data: {
        platform: Platform.OS,
      },
    });
    return true;
  } catch (error) {
    captureError(error, {
      handled: true,
      level: 'error',
      tags: {
        notifications_stage: 'configure_handler',
        platform: Platform.OS,
      },
    });
    throw error;
  }
}

export async function ensureAlertsNotificationChannel() {
  try {
    const Notifications = await getNotificationsModule();

    if (!Notifications || Platform.OS !== 'android') {
      return false;
    }

    await Notifications.setNotificationChannelAsync('alerts', {
      name: 'Nearby Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3B82F6',
    });

    return true;
  } catch (error) {
    captureError(error, {
      handled: true,
      level: 'error',
      tags: {
        notifications_stage: 'ensure_alert_channel',
        platform: Platform.OS,
      },
    });
    throw error;
  }
}

export async function scheduleLocalAlertNotification({
  title,
  body,
  data,
}) {
  addSentryBreadcrumb({
    category: 'notifications.alert',
    message: 'Scheduling local alert notification',
    data: {
      body,
      data: summarizeNotificationData(data),
      platform: Platform.OS,
      title,
    },
  });

  try {
    const Notifications = await getNotificationsModule();

    if (!Notifications) {
      addSentryBreadcrumb({
        category: 'notifications.alert',
        level: 'warning',
        message: 'Local alert notification skipped because notifications module is unavailable',
        data: {
          platform: Platform.OS,
        },
      });
      return false;
    }

    await ensureAlertsNotificationChannel();

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      captureMessage('Local alert notification skipped because permission was not granted', {
        handled: true,
        level: 'warning',
        tags: {
          notifications_stage: 'schedule_local_alert_permission_denied',
          platform: Platform.OS,
        },
        extras: {
          permissionStatus: status,
          title,
          data: summarizeNotificationData(data),
        },
      });
      return false;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data,
      },
      trigger: null,
    });

    addSentryBreadcrumb({
      category: 'notifications.alert',
      message: 'Local alert notification scheduled',
      data: {
        data: summarizeNotificationData(data),
        platform: Platform.OS,
        title,
      },
    });
    return true;
  } catch (error) {
    captureError(error, {
      handled: true,
      level: 'error',
      tags: {
        notifications_stage: 'schedule_local_alert',
        platform: Platform.OS,
      },
      extras: {
        body,
        data: summarizeNotificationData(data),
        title,
      },
    });
    throw error;
  }
}

export async function sendUserAlertPushNotification({
  title,
  body,
  data,
}) {
  const endpoint = resolveBackendUrl('/api/notifications/send-alert');

  if (!endpoint) {
    return false;
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        body,
        data,
      }),
    });

    if (!response.ok) {
      captureMessage('User alert push notification request failed', {
        handled: true,
        level: 'warning',
        tags: {
          notifications_stage: 'send_remote_alert',
          platform: Platform.OS,
        },
        extras: {
          endpoint,
          status: response.status,
          title,
          data: summarizeNotificationData(data),
        },
      });
      return false;
    }

    const result = await response.json().catch(() => ({}));
    return result?.success === true && Number(result?.sent || 0) > 0;
  } catch (error) {
    captureError(error, {
      handled: true,
      level: 'error',
      tags: {
        notifications_stage: 'send_remote_alert',
        platform: Platform.OS,
      },
      extras: {
        endpoint,
        title,
        data: summarizeNotificationData(data),
      },
    });
    return false;
  }
}
