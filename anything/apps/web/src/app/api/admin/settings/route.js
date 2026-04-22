import sql from '@/app/api/utils/sql';
import { requireAdminUser, isConfiguredAdminEmail } from '@/app/api/utils/admin-auth';

function getDisplayNameFallback(user) {
  const metadataName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    null;

  if (metadataName) {
    return metadataName;
  }

  const email = typeof user.email === 'string' ? user.email.trim() : '';
  const [localPart] = email.split('@');
  return localPart || null;
}

async function ensureUserRow(user) {
  const fullName = getDisplayNameFallback(user);
  const email = user.email || '';

  await sql`
    INSERT INTO users (id, email, full_name)
    VALUES (${user.id}, ${email}, ${fullName})
    ON CONFLICT (id) DO UPDATE
    SET
      email = COALESCE(NULLIF(EXCLUDED.email, ''), users.email),
      full_name = COALESCE(users.full_name, EXCLUDED.full_name);
  `;
}

async function buildSettingsPayload(user) {
  const rows = await sql`
    SELECT id, email, full_name, contribution_score, trust_score, created_at
    FROM users
    WHERE id = ${user.id}
    LIMIT 1;
  `;

  const systemCounts = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS total_users,
      (SELECT COUNT(*)::int FROM parking_zones) AS total_zones,
      (SELECT COUNT(*)::int FROM live_reports) AS total_reports,
      (SELECT COUNT(*)::int FROM suggested_parking_zones) AS total_suggestions;
  `;

  return {
    profile: {
      ...(rows[0] || {}),
      is_admin: isConfiguredAdminEmail(user?.email),
    },
    system: {
      database_configured: Boolean(process.env.DATABASE_URL || process.env.DATABASE_POOLER_URL),
      google_maps_configured: Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
      api_base_configured: Boolean(process.env.NEXT_PUBLIC_API_BASE_URL),
      ...systemCounts[0],
    },
  };
}

export async function GET(request) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.response) {
      return auth.response;
    }

    await ensureUserRow(auth.user);

    return Response.json({
      success: true,
      ...(await buildSettingsPayload(auth.user)),
    });
  } catch (error) {
    console.error('Error loading admin settings:', error);
    return Response.json(
      { success: false, error: error.message || 'Failed to load settings' },
      { status: 500 },
    );
  }
}

export async function PATCH(request) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.response) {
      return auth.response;
    }

    const body = await request.json();
    const fullName = typeof body?.full_name === 'string' ? body.full_name.trim().slice(0, 120) : null;

    await ensureUserRow(auth.user);

    await sql`
      UPDATE users
      SET full_name = ${fullName || null}
      WHERE id = ${auth.user.id};
    `;

    return Response.json({
      success: true,
      ...(await buildSettingsPayload(auth.user)),
    });
  } catch (error) {
    console.error('Error updating admin settings:', error);
    return Response.json(
      { success: false, error: error.message || 'Failed to update settings' },
      { status: 500 },
    );
  }
}
