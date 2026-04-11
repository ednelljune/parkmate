const normalizeEnvironment = (value?: string | null) =>
  String(value || '')
    .trim()
    .toLowerCase();

export const getRuntimeEnvironment = () => {
  const configuredEnvironment = normalizeEnvironment(process.env.EXPO_PUBLIC_CREATE_ENV);

  if (configuredEnvironment) {
    return configuredEnvironment;
  }

  return __DEV__ ? 'development' : 'production';
};

export const isDeveloperLoggingEnabled = () => {
  return __DEV__ || getRuntimeEnvironment() === 'development';
};

let hasInstalledConsolePrivacyGate = false;

export const installConsolePrivacyGate = () => {
  if (hasInstalledConsolePrivacyGate) {
    return;
  }

  hasInstalledConsolePrivacyGate = true;

  if (isDeveloperLoggingEnabled()) {
    return;
  }

  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
  console.warn = () => {};
  console.error = () => {};
};
