import { requireAuthenticatedUser } from "@/app/api/utils/supabase-auth";

const ADMIN_EMAIL_ENV_NAMES = [
  "PARKMATE_ADMIN_EMAILS",
  "ADMIN_EMAILS",
  "NEXT_PUBLIC_ADMIN_EMAILS",
];
const DEFAULT_ADMIN_EMAILS = ["admin@getparkmate.app"];

const normalizeEmail = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
};

export const getConfiguredAdminEmails = () => {
  const configuredEmails = new Set(DEFAULT_ADMIN_EMAILS);

  for (const envName of ADMIN_EMAIL_ENV_NAMES) {
    const rawValue = process.env[envName];
    if (typeof rawValue !== "string" || !rawValue.trim()) {
      continue;
    }

    rawValue
      .split(",")
      .map((item) => normalizeEmail(item))
      .filter(Boolean)
      .forEach((email) => configuredEmails.add(email));
  }

  return Array.from(configuredEmails);
};

export const isConfiguredAdminEmail = (value) => {
  const userEmail = normalizeEmail(value);
  if (!userEmail) {
    return false;
  }

  return getConfiguredAdminEmails().includes(userEmail);
};

export async function requireAdminUser(request) {
  const auth = await requireAuthenticatedUser(request);
  if (auth.response) {
    return auth;
  }

  const userEmail = normalizeEmail(auth.user?.email);

  if (!isConfiguredAdminEmail(userEmail)) {
    return {
      user: null,
      response: Response.json(
        {
          success: false,
          error: "Forbidden",
          message: "You do not have access to the admin review tools.",
        },
        { status: 403 },
      ),
    };
  }

  return auth;
}
