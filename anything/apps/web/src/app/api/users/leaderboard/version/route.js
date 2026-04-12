import sql from "@/app/api/utils/sql";
import { ensureActivityLogSchema } from "@/app/api/utils/activity-log";

export async function GET(request) {
  try {
    await ensureActivityLogSchema();

    const { searchParams } = new URL(request.url);
    const requestedLimit = Number.parseInt(searchParams.get("limit") || "50", 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 200)
      : 50;

    const rows = await sql(
      `
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
      ),
      leaderboard_rows AS (
        SELECT
          u.id,
          COALESCE(u.full_name, '') AS full_name,
          COALESCE(u.contribution_score, 0) AS contribution_score,
          COALESCE(u.trust_score, 0) AS trust_score,
          COALESCE(rc.total_reports, 0) AS total_reports,
          COALESCE(cc.total_claims, 0) AS total_claims,
          u.created_at
        FROM users u
        LEFT JOIN report_counts rc ON rc.user_id = u.id
        LEFT JOIN claim_counts cc ON cc.user_id = u.id
        ORDER BY u.trust_score DESC, u.contribution_score DESC, u.created_at ASC, u.id ASC
        LIMIT $1
      )
      SELECT
        COUNT(*)::int AS ranked_count,
        COALESCE(
          MD5(
            STRING_AGG(
              CONCAT_WS(
                '|',
                id::text,
                full_name,
                trust_score::text,
                contribution_score::text,
                total_reports::text,
                total_claims::text,
                COALESCE(created_at::text, '')
              ),
              '||'
              ORDER BY trust_score DESC, contribution_score DESC, created_at ASC, id ASC
            )
          ),
          'empty'
        ) AS checksum
      FROM leaderboard_rows
    `,
      [limit],
    );

    const status = rows[0] || {};
    const rankedCount = Number(status.ranked_count) || 0;
    const checksum = status.checksum || "empty";

    return Response.json({
      success: true,
      rankedCount,
      checksum,
      version: `${rankedCount}:${checksum}`,
    });
  } catch (error) {
    console.error("Error fetching leaderboard version:", error);
    return Response.json(
      { success: false, error: error.message || "Failed to fetch leaderboard version" },
      { status: 500 },
    );
  }
}
