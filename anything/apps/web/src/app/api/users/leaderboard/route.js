import sql from '@/app/api/utils/sql';
import { ensureActivityLogSchema } from '@/app/api/utils/activity-log';

export async function GET(request) {
  try {
    await ensureActivityLogSchema();

    const { searchParams } = new URL(request.url);
    const limit = Math.max(1, Number.parseInt(searchParams.get('limit') || '50', 10));
    const offset = Math.max(0, Number.parseInt(searchParams.get('offset') || '0', 10));

    const users = await sql`
      WITH report_counts AS (
        SELECT user_id, COUNT(*)::int AS total_reports
        FROM live_reports
        GROUP BY user_id
      ),
      claim_counts AS (
        SELECT user_id, COUNT(*)::int AS total_claims
        FROM user_activity_logs
        WHERE activity_type = 'claimed'
        GROUP BY user_id
      )
      SELECT
        u.id,
        u.full_name,
        u.contribution_score,
        u.trust_score,
        COALESCE(rc.total_reports, 0) AS total_reports,
        COALESCE(cc.total_claims, 0) AS total_claims,
        u.created_at
      FROM users u
      LEFT JOIN report_counts rc ON rc.user_id = u.id
      LEFT JOIN claim_counts cc ON cc.user_id = u.id
      ORDER BY u.trust_score DESC, u.contribution_score DESC, u.created_at ASC
      LIMIT ${limit}
      OFFSET ${offset};
    `;

    const totalCount = await sql`SELECT COUNT(*) AS count FROM users`;

    return Response.json({
      success: true,
      users,
      pagination: {
        limit,
        offset,
        total: Number.parseInt(totalCount[0].count, 10),
      },
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
