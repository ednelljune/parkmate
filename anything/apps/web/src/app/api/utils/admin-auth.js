import { requireAuthenticatedUser } from "@/app/api/utils/supabase-auth";

const ADMIN_EMAIL_ENV_NAMES = [
  "PARKMATE_ADMIN_EMAILS",
  "ADMIN_EMAILS",
  "NEXT_PUBLIC_ADMIN_EMAILS",
];
const DEFAULT_ADMIN_EMAILS = ["support@getparkmate.app"];

const normalizeEmail = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
};

const getConfiguredAdminEmails = () => {
  for (const envName of ADMIN_EMAIL_ENV_NAMES) {
    const rawValue = process.env[envName];
    if (typeof rawValue !== "string" || !rawValue.trim()) {
      continue;
    }

    return rawValue
      .split(",")
      .map((item) => normalizeEmail(item))
      .filter(Boolean);
  }

  return DEFAULT_ADMIN_EMAILS;
};

export async function requireAdminUser(request) {
  const auth = await requireAuthenticatedUser(request);
  if (auth.response) {
    return auth;
  }

  const configuredAdminEmails = getConfiguredAdminEmails();
  const userEmail = normalizeEmail(auth.user?.email);

  if (!userEmail || configuredAdminEmails.length === 0 || !configuredAdminEmails.includes(userEmail)) {
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
