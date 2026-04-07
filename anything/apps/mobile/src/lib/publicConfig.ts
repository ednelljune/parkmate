import Constants from 'expo-constants';

type PublicConfigValue = string | undefined;

const getExpoPublicConfig = (): Record<string, unknown> => {
  const extra = Constants.expoConfig?.extra;
  if (!extra || typeof extra !== 'object') {
    return {};
  }

  const publicConfig =
    'publicConfig' in extra && extra.publicConfig && typeof extra.publicConfig === 'object'
      ? (extra.publicConfig as Record<string, unknown>)
      : {};

  return publicConfig;
};

const normalizeValue = (value: unknown): PublicConfigValue => {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return undefined;
};

export const getPublicConfigValue = (key: string): PublicConfigValue => {
  const expoValue = normalizeValue(getExpoPublicConfig()[key]);
  if (expoValue !== undefined) {
    return expoValue;
  }

  const envValue = process.env[key];
  return normalizeValue(envValue);
};

export const getPublicConfig = (): Record<string, PublicConfigValue> => {
  const config = getExpoPublicConfig();

  return Object.fromEntries(
    Object.entries(config).map(([key, value]) => [key, normalizeValue(value)])
  );
};
