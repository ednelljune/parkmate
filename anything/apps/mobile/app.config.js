const fs = require("fs");
const path = require("path");
const { expo: appJson } = require("./app.json");

const GOOGLE_SERVICES_FILE = "./google-services.json";
const DEFAULT_BACKEND_URL = "https://parkmate-api.onrender.com";
const DEFAULT_BACKEND_HOST = "parkmate-api.onrender.com";
const DEFAULT_SUPABASE_URL = "https://tkjqredjgkijcrrfewbj.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_j6U_1ahMlhXTEMj49uhYXQ_WkxFIlq5";
const DEFAULT_LEGAL_ENTITY_NAME = "ParkMate";
const DEFAULT_CONTACT_EMAIL = "support@parkmate.com";
const DEFAULT_COMPANY_ADDRESS = "Melbourne VIC, Australia";
const DEFAULT_LEGAL_JURISDICTION = "Victoria, Australia";
const DEFAULT_LEGAL_EFFECTIVE_DATE = "14 April 2026";
const DEFAULT_LEGAL_LAST_UPDATED = "14 April 2026";
const DEFAULT_LEGAL_LIABILITY_CAP = "AUD $100";

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
  const backendUrl =
    expoPublicEnvironment.EXPO_PUBLIC_BASE_URL ||
    expoPublicEnvironment.EXPO_PUBLIC_APP_URL ||
    DEFAULT_BACKEND_URL;
  const supabaseUrl =
    expoPublicEnvironment.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const supabasePublishableKey =
    expoPublicEnvironment.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    expoPublicEnvironment.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_PUBLISHABLE_KEY;
  const googleMapsApiKey = expoPublicEnvironment.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const legalEntityName =
    expoPublicEnvironment.EXPO_PUBLIC_LEGAL_ENTITY_NAME || DEFAULT_LEGAL_ENTITY_NAME;
  const contactEmail =
    expoPublicEnvironment.EXPO_PUBLIC_CONTACT_EMAIL || DEFAULT_CONTACT_EMAIL;
  const companyAddress =
    expoPublicEnvironment.EXPO_PUBLIC_COMPANY_ADDRESS || DEFAULT_COMPANY_ADDRESS;
  const legalJurisdiction =
    expoPublicEnvironment.EXPO_PUBLIC_LEGAL_JURISDICTION || DEFAULT_LEGAL_JURISDICTION;
  const legalEffectiveDate =
    expoPublicEnvironment.EXPO_PUBLIC_LEGAL_EFFECTIVE_DATE || DEFAULT_LEGAL_EFFECTIVE_DATE;
  const legalLastUpdated =
    expoPublicEnvironment.EXPO_PUBLIC_LEGAL_LAST_UPDATED || DEFAULT_LEGAL_LAST_UPDATED;
  const legalLiabilityCap =
    expoPublicEnvironment.EXPO_PUBLIC_LEGAL_LIABILITY_CAP || DEFAULT_LEGAL_LIABILITY_CAP;
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
        EXPO_PUBLIC_BASE_URL: backendUrl,
        EXPO_PUBLIC_APP_URL: backendUrl,
        EXPO_PUBLIC_HOST: expoPublicEnvironment.EXPO_PUBLIC_HOST || DEFAULT_BACKEND_HOST,
        EXPO_PUBLIC_SUPABASE_URL: supabaseUrl,
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabasePublishableKey,
        EXPO_PUBLIC_ANDROID_FCM_CONFIGURED: String(androidFcmConfigured),
        EXPO_PUBLIC_LEGAL_ENTITY_NAME: legalEntityName,
        EXPO_PUBLIC_CONTACT_EMAIL: contactEmail,
        EXPO_PUBLIC_COMPANY_ADDRESS: companyAddress,
        EXPO_PUBLIC_LEGAL_JURISDICTION: legalJurisdiction,
        EXPO_PUBLIC_LEGAL_EFFECTIVE_DATE: legalEffectiveDate,
        EXPO_PUBLIC_LEGAL_LAST_UPDATED: legalLastUpdated,
        EXPO_PUBLIC_LEGAL_LIABILITY_CAP: legalLiabilityCap,
      },
    },
  };
};
