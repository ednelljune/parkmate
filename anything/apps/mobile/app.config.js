const { expo: appJson } = require("./app.json");

module.exports = () => {
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const existingExtra =
    appJson.extra && typeof appJson.extra === "object" ? appJson.extra : {};
  const existingPublicConfig =
    existingExtra.publicConfig && typeof existingExtra.publicConfig === "object"
      ? existingExtra.publicConfig
      : {};

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
      publicConfig: {
        ...existingPublicConfig,
        EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: googleMapsApiKey,
      },
    },
  };
};
