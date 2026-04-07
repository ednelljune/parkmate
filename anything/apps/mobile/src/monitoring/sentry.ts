import * as Sentry from '@sentry/react-native';

const FALLBACK_SENTRY_DSN =
  'https://efebc23fa5840e75457156ed629b0407@o4511164241149952.ingest.us.sentry.io/4511164243509248';
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || FALLBACK_SENTRY_DSN;
const FLUSH_TIMEOUT_MS = 2000;
const SENTRY_ENVIRONMENT =
  process.env.EXPO_PUBLIC_CREATE_ENV || (__DEV__ ? 'development' : 'production');
const IS_DEVELOPMENT_RUNTIME =
  __DEV__ || String(SENTRY_ENVIRONMENT).toLowerCase() === 'development';

let hasInitializedSentry = false;
let hasAttachedGlobalHandler = false;

type CaptureContext = {
  componentStack?: string;
  extras?: Record<string, unknown>;
  handled?: boolean;
  level?: Sentry.SeverityLevel;
  tags?: Record<string, string>;
};

type BreadcrumbContext = {
  category: string;
  data?: Record<string, unknown>;
  level?: Sentry.SeverityLevel;
  message: string;
  type?: string;
};

type ErrorUtilsHandler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsLike = {
  getGlobalHandler?: () => ErrorUtilsHandler | null;
  setGlobalHandler?: (handler: ErrorUtilsHandler) => void;
};
type ExpoRuntimeLike = typeof globalThis & {
  expo?: {
    modules?: {
      ExpoGo?: unknown;
    };
  };
};
type SentryNativeCrashLike = typeof Sentry & {
  nativeCrash?: () => void;
};

const MAX_SERIALIZE_DEPTH = 4;
const MAX_SERIALIZE_KEYS = 25;

function normalizeForSentry(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (value == null) {
    return value;
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'function') {
    return `[Function ${value.name || 'anonymous'}]`;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      message: value.message,
      name: value.name,
      stack: value.stack,
    };
  }

  if (depth >= MAX_SERIALIZE_DEPTH) {
    return '[MaxDepthExceeded]';
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_SERIALIZE_KEYS)
      .map((item) => normalizeForSentry(item, depth + 1, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value as object)) {
      return '[Circular]';
    }

    seen.add(value as object);

    const entries = Object.entries(value as Record<string, unknown>).slice(
      0,
      MAX_SERIALIZE_KEYS,
    );

    return entries.reduce<Record<string, unknown>>((accumulator, [key, entryValue]) => {
      accumulator[key] = normalizeForSentry(entryValue, depth + 1, seen);
      return accumulator;
    }, {});
  }

  return String(value);
}

export function ensureSentryInitialized(): void {
  if (hasInitializedSentry) {
    return;
  }

  const shouldEnableReplay = !IS_DEVELOPMENT_RUNTIME && !isExpoGoRuntime();
  const integrations = [Sentry.feedbackIntegration()];

  if (shouldEnableReplay) {
    integrations.unshift(Sentry.mobileReplayIntegration());
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    enabled: Boolean(SENTRY_DSN),
    debug: false,
    environment: SENTRY_ENVIRONMENT,
    sendDefaultPii: true,
    enableNative: true,
    enableNativeCrashHandling: true,
    enableLogs: !IS_DEVELOPMENT_RUNTIME,
    attachStacktrace: true,
    replaysSessionSampleRate: shouldEnableReplay ? 0.1 : 0,
    replaysOnErrorSampleRate: shouldEnableReplay ? 1 : 0,
    integrations,
  });

  hasInitializedSentry = true;
}

export function captureError(error: unknown, context: CaptureContext = {}): string {
  ensureSentryInitialized();

  let eventId = '';

  Sentry.withScope((scope) => {
    if (context.level) {
      scope.setLevel(context.level);
    }

    if (typeof context.handled === 'boolean') {
      scope.setTag('handled', String(context.handled));
    }

    if (context.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }

    if (context.extras) {
      Object.entries(context.extras).forEach(([key, value]) => {
        scope.setExtra(key, normalizeForSentry(value));
      });
    }

    if (context.componentStack) {
      scope.setContext('react_error_boundary', {
        componentStack: context.componentStack,
      });
    }

    eventId = Sentry.captureException(error);
  });

  return eventId;
}

export function captureMessage(message: string, context: CaptureContext = {}): string {
  ensureSentryInitialized();

  let eventId = '';

  Sentry.withScope((scope) => {
    if (context.level) {
      scope.setLevel(context.level);
    }

    if (typeof context.handled === 'boolean') {
      scope.setTag('handled', String(context.handled));
    }

    if (context.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }

    if (context.extras) {
      Object.entries(context.extras).forEach(([key, value]) => {
        scope.setExtra(key, normalizeForSentry(value));
      });
    }

    eventId = Sentry.captureMessage(message);
  });

  return eventId;
}

export function addSentryBreadcrumb({
  category,
  data,
  level = 'info',
  message,
  type = 'default',
}: BreadcrumbContext): void {
  ensureSentryInitialized();

  Sentry.addBreadcrumb({
    category,
    data: data ? (normalizeForSentry(data) as Record<string, unknown>) : undefined,
    level,
    message,
    type,
  });
}

export function setSentryUser(user: {
  email?: string | null;
  id?: string | null;
  username?: string | null;
} | null): void {
  ensureSentryInitialized();

  if (!user) {
    Sentry.setUser(null);
    return;
  }

  Sentry.setUser({
    email: user.email || undefined,
    id: user.id || undefined,
    username: user.username || undefined,
  });
}

export { normalizeForSentry };

export async function captureErrorAndFlush(
  error: unknown,
  context: CaptureContext = {},
): Promise<string> {
  const eventId = captureError(error, context);

  try {
    await Promise.race([
      Promise.resolve(Sentry.flush()),
      new Promise<void>((resolve) => {
        setTimeout(resolve, FLUSH_TIMEOUT_MS);
      }),
    ]);
  } catch {
    // Best effort only. We still want the original crash path to continue.
  }

  return eventId;
}

export async function captureMessageAndFlush(
  message: string,
  context: CaptureContext = {},
): Promise<string> {
  const eventId = captureMessage(message, context);

  try {
    await Promise.race([
      Promise.resolve(Sentry.flush()),
      new Promise<void>((resolve) => {
        setTimeout(resolve, FLUSH_TIMEOUT_MS);
      }),
    ]);
  } catch {
    // Best effort only. We still want the verification flow to continue.
  }

  return eventId;
}

export function isExpoGoRuntime(): boolean {
  return Boolean((globalThis as ExpoRuntimeLike).expo?.modules?.ExpoGo);
}

export async function sendSentryVerificationEvent(): Promise<string> {
  addSentryBreadcrumb({
    category: 'sentry.verification',
    message: 'Manual Sentry verification requested',
    data: {
      environment: SENTRY_ENVIRONMENT,
      isExpoGo: isExpoGoRuntime(),
      isHermes: typeof HermesInternal !== 'undefined',
    },
  });

  return await captureMessageAndFlush('Manual Sentry verification event', {
    level: 'info',
    handled: true,
    tags: {
      sentry_verification: 'manual',
      runtime: isExpoGoRuntime() ? 'expo-go' : 'native-build',
    },
    extras: {
      environment: SENTRY_ENVIRONMENT,
      isExpoGo: isExpoGoRuntime(),
      isHermes: typeof HermesInternal !== 'undefined',
      platformHint: 'react-native',
    },
  });
}

export function triggerSentryNativeTestCrash(): void {
  ensureSentryInitialized();

  addSentryBreadcrumb({
    category: 'sentry.verification',
    level: 'warning',
    message: 'Manual native crash test requested',
    data: {
      environment: SENTRY_ENVIRONMENT,
      isExpoGo: isExpoGoRuntime(),
    },
  });

  const nativeCrash = (Sentry as SentryNativeCrashLike).nativeCrash;
  if (typeof nativeCrash !== 'function') {
    throw new Error('Sentry.nativeCrash is unavailable in this runtime.');
  }

  nativeCrash();
}

export function attachSentryGlobalErrorHandler(): void {
  if (hasAttachedGlobalHandler) {
    return;
  }

  ensureSentryInitialized();

  const errorUtils = (global as typeof globalThis & { ErrorUtils?: ErrorUtilsLike })
    .ErrorUtils;
  if (!errorUtils || typeof errorUtils.setGlobalHandler !== 'function') {
    return;
  }

  const originalGlobalHandler =
    typeof errorUtils.getGlobalHandler === 'function'
      ? errorUtils.getGlobalHandler()
      : null;

  errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    console.error('Unhandled React Native exception', error, { isFatal });

    void captureErrorAndFlush(error, {
      handled: false,
      level: isFatal ? 'fatal' : 'error',
      tags: {
        error_source: 'global_error_utils',
        is_fatal: String(Boolean(isFatal)),
      },
    }).finally(() => {
      originalGlobalHandler?.(error, isFatal);
    });
  });

  hasAttachedGlobalHandler = true;
}
