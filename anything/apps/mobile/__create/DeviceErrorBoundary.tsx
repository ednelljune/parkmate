import React, { type ReactNode, useCallback, useEffect, useState } from 'react';
import { SharedErrorBoundary, Button } from './SharedErrorBoundary';
import * as Updates from 'expo-updates';
import { SplashScreen } from 'expo-router/build/exports';
import { Platform, Text, View } from 'react-native';
import { isErrorLike, serializeError } from 'serialize-error';
import { reportErrorToRemote } from './report-error-to-remote';
import { captureErrorAndFlush } from '../src/monitoring/sentry';

type ErrorBoundaryState = { hasError: boolean; error: unknown | null; sentLogs: boolean };

function getDisplayableErrorMessage(error: unknown): string | null {
  const serializedError = serializeError(error);
  if (isErrorLike(serializedError) && serializedError.message) {
    return serializedError.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }
  return null;
}

const DeviceErrorBoundary = ({
  sentLogs,
  error,
}: {
  sentLogs: boolean;
  error: unknown | null;
}) => {
  const errorMessage = getDisplayableErrorMessage(error);
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => { });
  }, []);
  const handleReload = useCallback(async () => {
    if (Platform.OS === 'web') {
      window.location.reload();
      return;
    }

    Updates.reloadAsync().catch((error) => {
      // no-op, we don't want to show an error here
    });
  }, []);
  return (
    <SharedErrorBoundary
      isOpen
      description={
        sentLogs
          ? 'ParkMate hit an unexpected error. The details were reported automatically. If the issue persists, restart the app and try again.'
          : 'ParkMate hit an unexpected error. Restart the app and try again.'
      }
    >
      {errorMessage ? (
        <Text style={{ color: '#F5C2C7', fontSize: 12, marginBottom: 12 }}>
          {`Error: ${errorMessage}`}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button color="primary" onPress={handleReload}>
          Restart app
        </Button>
      </View>
    </SharedErrorBoundary>
  );
};

export class DeviceErrorBoundaryWrapper extends React.Component<
  {
    children: ReactNode;
  },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null, sentLogs: false };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, error, sentLogs: false };
  }
  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo): void {
    this.setState({ error });
    console.error('DeviceErrorBoundary caught an error', error, errorInfo);
    void Promise.allSettled([
      captureErrorAndFlush(error, {
        handled: true,
        level: 'error',
        componentStack: errorInfo.componentStack ?? undefined,
        tags: {
          error_source: 'device_error_boundary',
          platform: Platform.OS,
        },
      }),
      reportErrorToRemote({ error }),
    ]).then((results) => {
      const remoteLogResult = results[1];
      const sentLogs =
        remoteLogResult?.status === 'fulfilled' &&
        Boolean(remoteLogResult.value?.success);

      this.setState({ hasError: true, sentLogs });
    });
  }

  render() {
    if (this.state.hasError) {
      return <DeviceErrorBoundary error={this.state.error} sentLogs={this.state.sentLogs} />;
    }
    return this.props.children;
  }
}
