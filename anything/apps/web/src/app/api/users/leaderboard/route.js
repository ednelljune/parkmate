import sql from '@/app/api/utils/sql';
import { ensureActivityLogSchema } from '@/app/api/utils/activity-log';

export async function GET(request) {
  try {
    await ensureActivityLogSchema();

    const { searchParams } = new URL(request.url);
    const limit = Math.max(1, Number.parseInt(searchParams.get('limit') || '50', 10));
    const offset = Math.max(0, Number.parseInt(searchParams.get('offset') || '0', 10));

    const users = await sql`
      SELECT
        id,
        full_name,
        contribution_score,
        trust_score,
        (SELECT COUNT(*) FROM live_reports WHERE user_id = users.id) AS total_reports,
        (
          SELECT COUNT(*)
          FROM user_activity_logs
          WHERE user_id = users.id
            AND activity_type = 'claimed'
        ) AS total_claims,
        created_at
      FROM users
      ORDER BY trust_score DESC, contribution_score DESC, created_at ASC
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
