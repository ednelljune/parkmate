import sql from '@/app/api/utils/sql';
import { requireAuthenticatedUser } from '@/app/api/utils/supabase-auth';
import { ensureActivityLogSchema } from '@/app/api/utils/activity-log';

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

export async function GET(request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth.response) {
      return auth.response;
    }

    const userId = auth.user.id;
    await ensureUserRow(auth.user);
    await ensureActivityLogSchema();

    const users = await sql`
      SELECT
        id,
        email,
        full_name,
        contribution_score,
        trust_score,
        created_at,
        (SELECT COUNT(*) FROM live_reports WHERE user_id = ${userId}) AS total_reports,
        (
          SELECT COUNT(*)
          FROM user_activity_logs
          WHERE user_id = ${userId}
            AND activity_type = 'claimed'
        ) AS total_claims
      FROM users
      WHERE id = ${userId}
      LIMIT 1;
    `;

    if (users.length === 0) {
      return Response.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      user: users[0],
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth.response) {
      return auth.response;
    }

    const { full_name } = await request.json();
    const userId = auth.user.id;
    await ensureUserRow(auth.user);

    const users = await sql`
      UPDATE users
      SET full_name = ${full_name || null}
      WHERE id = ${userId}
      RETURNING id, email, full_name, contribution_score, trust_score, created_at;
    `;

    if (users.length === 0) {
      return Response.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      user: users[0],
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
