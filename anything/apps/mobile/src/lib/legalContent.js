import { getPublicConfigValue } from "@/lib/publicConfig";

const getConfiguredValue = (key, fallback) => {
  const value = getPublicConfigValue(key);
  if (!value || !String(value).trim()) {
    return fallback;
  }

  return String(value).trim();
};

export const LEGAL_META = {
  companyName: getConfiguredValue("EXPO_PUBLIC_LEGAL_ENTITY_NAME", "[Company Name]"),
  contactEmail: getConfiguredValue("EXPO_PUBLIC_CONTACT_EMAIL", "[Contact Email]"),
  address: getConfiguredValue("EXPO_PUBLIC_COMPANY_ADDRESS", "[Address]"),
  jurisdiction: getConfiguredValue("EXPO_PUBLIC_LEGAL_JURISDICTION", "[Jurisdiction]"),
  effectiveDate: getConfiguredValue("EXPO_PUBLIC_LEGAL_EFFECTIVE_DATE", "[Insert Date]"),
  lastUpdated: getConfiguredValue("EXPO_PUBLIC_LEGAL_LAST_UPDATED", "[Insert Date]"),
  liabilityCap: getConfiguredValue("EXPO_PUBLIC_LEGAL_LIABILITY_CAP", "AUD $100"),
};

export const LEGAL_PLACEHOLDER_KEYS = Object.entries(LEGAL_META)
  .filter(([, value]) => value.startsWith("["))
  .map(([key]) => key);

export const PRIVACY_POLICY_SECTIONS = [
  {
    title: "Information we collect",
    body:
      "ParkMate may collect account details, location data, parking reports and claims, notification tokens, diagnostics, and app preferences stored on your device.",
    bullets: [
      "Account information such as your name, email address, and authentication data.",
      "Approximate or precise location when you allow it for nearby zones, reports, and directions.",
      "Parking activity, leaderboard data, and contribution metrics tied to your account.",
      "Device, app, crash, and performance information used to keep the app reliable.",
    ],
  },
  {
    title: "How we use information",
    body:
      "We use collected information to run the app, personalize nearby parking features, support alerts and timers, improve reliability, and detect misuse.",
    bullets: [
      "Create and manage your account and keep you signed in.",
      "Show nearby parking zones, directions, live reports, and contribution history.",
      "Send timer reminders, parking alerts, and service notices when enabled.",
      "Detect fraud, spam, inaccurate reporting, and other abusive behavior.",
    ],
  },
  {
    title: "Sharing and providers",
    body:
      "We may share information with service providers that operate ParkMate infrastructure or when required for legal, safety, or transaction-related reasons.",
    bullets: [
      "Backend, authentication, analytics, notification, crash reporting, and mapping providers.",
      "Legal or regulatory authorities when required by law or valid legal process.",
      "Successors in connection with a merger, financing, acquisition, or sale of assets.",
    ],
  },
  {
    title: "Your choices",
    body:
      "You can control permissions through your device settings and may request deletion of your account or associated personal information.",
    bullets: [
      "Disable location access or notifications at the device level.",
      "Delete the app and locally stored data from your device.",
      `Contact ${LEGAL_META.contactEmail} for privacy requests, including account deletion.`,
    ],
  },
];

export const TERMS_OF_SERVICE_SECTIONS = [
  {
    title: "Service scope",
    body:
      "ParkMate is an informational parking tool. It helps users discover zones, review community reports, manage timers, and access map-based directions.",
    bullets: [
      "Parking data may be user-generated, delayed, incomplete, inaccurate, or outdated.",
      "You remain responsible for checking signage, permits, meter rules, and local laws.",
      "ParkMate does not guarantee parking availability, legality, safety, or suitability.",
    ],
  },
  {
    title: "Accounts and community use",
    body:
      "You must provide accurate account information, protect your login credentials, and avoid abusive or misleading conduct in the app.",
    bullets: [
      "Do not submit false, manipulated, abusive, fraudulent, or spammy parking reports.",
      "Do not interfere with the app, attempt unauthorized access, or misuse automation.",
      "You grant ParkMate a license to use submitted reports and related content to operate and improve the service.",
    ],
  },
  {
    title: "Suspension and termination",
    body:
      "ParkMate may suspend or terminate access when necessary to protect users, enforce the rules, or comply with legal obligations.",
    bullets: [
      "Accounts may be restricted for Terms violations or safety risks.",
      "Some features may not work if you disable required device permissions.",
      "You may stop using ParkMate at any time.",
    ],
  },
  {
    title: "Disclaimers and liability",
    body:
      "To the maximum extent allowed by law, ParkMate is provided as is and as available, without guarantees of uninterrupted service or complete accuracy.",
    bullets: [
      "ParkMate is not responsible for fines, towing, penalties, permit issues, or similar parking losses.",
      `Total liability is capped at the greater of amounts paid in the prior 12 months or ${LEGAL_META.liabilityCap}.`,
      `These Terms are governed by the laws of ${LEGAL_META.jurisdiction}.`,
    ],
  },
];
