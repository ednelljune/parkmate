const fs = require("fs");
const path = require("path");
const { expo: appJson } = require("./app.json");

const GOOGLE_SERVICES_FILE = "./google-services.json";

const getExpoPublicEnvironment = () =>
  Object.fromEntries(
    Object.entries(process.env).filter(
      ([key, value]) =>
        key.startsWith("EXPO_PUBLIC_") &&
        value != null &&
        String(value).trim().length > 0,
    ),
  );

module.exports = () => {
  const expoPublicEnvironment = getExpoPublicEnvironment();
  const googleMapsApiKey = expoPublicEnvironment.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const existingExtra =
    appJson.extra && typeof appJson.extra === "object" ? appJson.extra : {};
  const existingPublicConfig =
    existingExtra.publicConfig && typeof existingExtra.publicConfig === "object"
      ? existingExtra.publicConfig
      : {};
  const googleServicesFilePath = path.join(__dirname, "google-services.json");
  const hasGoogleServicesFile = fs.existsSync(googleServicesFilePath);
  const androidFcmConfigured =
    hasGoogleServicesFile ||
    expoPublicEnvironment.EXPO_PUBLIC_ANDROID_FCM_CONFIGURED === "true";

  if (!googleMapsApiKey) {
    console.warn(
      "[app.config] EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is not set. Android Google Maps will be unavailable in native builds.",
    );
  }

  if (process.env.EAS_BUILD === "true" && !googleMapsApiKey) {
    throw new Error(
      "Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY for EAS build. Set it in the selected EAS environment before building Android.",
    );
  }

  return {
    ...appJson,
    android: {
      ...appJson.android,
      ...(hasGoogleServicesFile ? { googleServicesFile: GOOGLE_SERVICES_FILE } : {}),
      config: {
        ...(appJson.android?.config ?? {}),
        googleMaps: {
          ...((appJson.android?.config && appJson.android.config.googleMaps) ?? {}),
          apiKey: googleMapsApiKey,
        },
      },
    },
    extra: {
      ...existingExtra,
      androidFcmConfigured,
      publicConfig: {
        ...existingPublicConfig,
        ...expoPublicEnvironment,
        EXPO_PUBLIC_ANDROID_FCM_CONFIGURED: String(androidFcmConfigured),
      },
    },
  };
};
