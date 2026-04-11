type ErrorUtilsHandler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsLike = {
  getGlobalHandler?: () => ErrorUtilsHandler | null;
  setGlobalHandler?: (handler: ErrorUtilsHandler) => void;
};

const errorUtils = (global as typeof globalThis & { ErrorUtils?: ErrorUtilsLike })
  .ErrorUtils;
const originalGlobalHandler =
  typeof errorUtils?.getGlobalHandler === 'function' ? errorUtils.getGlobalHandler() : null;

if (__DEV__ && errorUtils && typeof errorUtils.setGlobalHandler === 'function') {
  errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    console.error('Unhandled React Native exception', error, { isFatal });
    originalGlobalHandler?.(error, isFatal);
  });
}

import 'react-native-url-polyfill/auto';
import './src/__create/polyfills';
import './src/utils/installConsolePrivacyGate';
import { getRuntimeEnvironment } from './src/utils/runtimeLogging';
global.Buffer = require('buffer').Buffer;

import '@expo/metro-runtime';
import { AppRegistry } from 'react-native';
import { DeviceErrorBoundaryWrapper } from './__create/DeviceErrorBoundary';
import AnythingMenu from './src/__create/anything-menu';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';
import App from './entrypoint';
import {
  addSentryBreadcrumb,
  attachSentryGlobalErrorHandler,
  ensureSentryInitialized,
} from './src/monitoring/sentry';

ensureSentryInitialized();
attachSentryGlobalErrorHandler();
addSentryBreadcrumb({
  category: 'app.lifecycle',
  message: 'Mobile app bootstrap started',
  data: {
    createEnv: getRuntimeEnvironment(),
    isDev: __DEV__,
  },
});

AppRegistry.setWrapperComponentProvider(() => ({ children }) => {
  const isDevelopmentRuntime = getRuntimeEnvironment() === 'development';
  const wrappedChildren = (
    <DeviceErrorBoundaryWrapper>
      {children}
    </DeviceErrorBoundaryWrapper>
  );

  if (isDevelopmentRuntime) {
    return (
      <>
        {wrappedChildren}
        <AnythingMenu />
      </>
    );
  }

  return wrappedChildren;
});

renderRootComponent(App);
