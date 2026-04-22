import sql from '@/app/api/utils/sql';
import { requireAdminUser } from '@/app/api/utils/admin-auth';
import { getEffectiveReportExpiresAtSql } from '@/app/api/utils/report-ttl';
import { ensureUsersSchema } from '@/app/api/utils/users-schema';

export async function GET(request) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.response) {
      return auth.response;
    }

    await ensureUsersSchema();
    const effectiveExpiresAtSql = getEffectiveReportExpiresAtSql('lr');

    const [summaryRows, suggestionsByDay, reportsByDay, topZones, topContributors] = await Promise.all([
      sql(`
        SELECT
          (SELECT COUNT(*)::int FROM users) AS total_users,
          (SELECT COUNT(*)::int FROM users WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days') AS new_users_30d,
          (SELECT COUNT(*)::int FROM parking_zones) AS total_zones,
          (SELECT COUNT(*)::int FROM live_reports lr WHERE lr.status != 'claimed' AND ${effectiveExpiresAtSql} > CURRENT_TIMESTAMP) AS live_reports_available,
          (SELECT COUNT(*)::int FROM suggested_parking_zones) AS total_suggestions,
          (SELECT COUNT(*)::int FROM suggested_parking_zones WHERE status = 'pending') AS pending_suggestions;
      `),
      sql(`
        WITH days AS (
          SELECT generate_series(
            CURRENT_DATE - INTERVAL '6 days',
            CURRENT_DATE,
            INTERVAL '1 day'
          )::date AS day
        )
        SELECT
          TO_CHAR(days.day, 'Dy') AS label,
          COALESCE(COUNT(spz.id), 0)::int AS suggestions
        FROM days
        LEFT JOIN suggested_parking_zones spz ON DATE(spz.created_at) = days.day
        GROUP BY days.day
        ORDER BY days.day ASC;
      `),
      sql(`
        WITH days AS (
          SELECT generate_series(
            CURRENT_DATE - INTERVAL '6 days',
            CURRENT_DATE,
            INTERVAL '1 day'
          )::date AS day
        )
        SELECT
          TO_CHAR(days.day, 'Dy') AS label,
          COALESCE(COUNT(lr.id), 0)::int AS reports
        FROM days
        LEFT JOIN live_reports lr ON DATE(lr.created_at) = days.day
        GROUP BY days.day
        ORDER BY days.day ASC;
      `),
      sql(`
        SELECT
          COALESCE(pz.name, 'Unlinked zone') AS zone_name,
          COUNT(lr.id)::int AS report_count
        FROM live_reports lr
        LEFT JOIN parking_zones pz ON pz.id = lr.zone_id
        GROUP BY COALESCE(pz.name, 'Unlinked zone')
        ORDER BY report_count DESC, zone_name ASC
        LIMIT 5;
      `),
      sql(`
        WITH contributor_totals AS (
          SELECT
            u.id,
            u.full_name,
            u.email,
            COALESCE(report_counts.total_reports, 0) AS total_reports,
            COALESCE(suggestion_counts.total_suggestions, 0) AS total_suggestions,
            COALESCE(report_counts.total_reports, 0) + COALESCE(suggestion_counts.total_suggestions, 0) AS total_activity
          FROM users u
          LEFT JOIN (
            SELECT user_id, COUNT(*)::int AS total_reports
            FROM live_reports
            GROUP BY user_id
          ) report_counts ON report_counts.user_id = u.id
          LEFT JOIN (
            SELECT user_id, COUNT(*)::int AS total_suggestions
            FROM suggested_parking_zones
            GROUP BY user_id
          ) suggestion_counts ON suggestion_counts.user_id = u.id
        )
        SELECT *
        FROM contributor_totals
        WHERE total_activity > 0
        ORDER BY total_activity DESC, total_reports DESC, total_suggestions DESC
        LIMIT 5;
      `),
    ]);

    return Response.json({
      success: true,
      summary: summaryRows[0] || null,
      charts: {
        suggestionsByDay,
        reportsByDay,
      },
      topZones,
      topContributors,
    });
  } catch (error) {
    console.error('Error loading admin analytics:', error);
    return Response.json(
      { success: false, error: error.message || 'Failed to load analytics' },
      { status: 500 },
    );
  }
}
