import sql from '@/app/api/utils/sql';
import { requireAuthenticatedUser } from '@/app/api/utils/supabase-auth';
import { ensureActivityLogSchema } from '@/app/api/utils/activity-log';
import { isConfiguredAdminEmail } from '@/app/api/utils/admin-auth';
import { ensureUsersSchema, ensureUserRow } from '@/app/api/utils/users-schema';

export async function GET(request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth.response) {
      return auth.response;
    }

    const userId = auth.user.id;
    await ensureUsersSchema();
    await ensureUserRow(auth.user);
    await ensureActivityLogSchema();

    const users = await sql`
      WITH ranked_users AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            ORDER BY
              COALESCE(contribution_score, 0) DESC,
              COALESCE(trust_score, 0) DESC,
              created_at ASC,
              id ASC
          )::int AS leaderboard_rank
        FROM users
      )
      SELECT
        u.id,
        u.email,
        u.full_name,
        u.contribution_score,
        u.trust_score,
        u.created_at,
        ru.leaderboard_rank,
        (SELECT COUNT(*)::int FROM users) AS ranked_count,
        (SELECT COUNT(*) FROM live_reports WHERE user_id = ${userId}) AS total_reports,
        (
          SELECT COUNT(*)
          FROM user_activity_logs
          WHERE user_id = ${userId}
            AND activity_type = 'claimed'
        ) AS total_claims
      FROM users u
      LEFT JOIN ranked_users ru ON ru.id = u.id
      WHERE u.id = ${userId}
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
      user: {
        ...users[0],
        is_admin: isConfiguredAdminEmail(auth.user?.email),
      },
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
    await ensureUsersSchema();
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
      user: {
        ...users[0],
        is_admin: isConfiguredAdminEmail(auth.user?.email),
      },
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
