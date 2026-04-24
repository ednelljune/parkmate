import sql from "@/app/api/utils/sql";
import { requireAdminUser } from "@/app/api/utils/admin-auth";
import { ensureSuggestedZonesAdminSchema } from "@/app/api/admin/zones/suggestions/shared";
import { ensureUsersSchema } from "@/app/api/utils/users-schema";

const NOTIFICATION_LIMIT = 8;

const normalizeSince = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString();
};

export async function GET(request) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.response) {
      return auth.response;
    }

    await ensureSuggestedZonesAdminSchema();
    await ensureUsersSchema();

    const { searchParams } = new URL(request.url);
    const since = normalizeSince(searchParams.get("since"));

    const summaryRows = await sql(
      `
        WITH notification_feed AS (
          SELECT
            CONCAT('zone-suggestion-', spz.id) AS notification_id,
            'zone_suggestion' AS notification_type,
            spz.created_at
          FROM suggested_parking_zones spz
          WHERE spz.status = 'pending'

          UNION ALL

          SELECT
            CONCAT('report-', lr.id) AS notification_id,
            'report' AS notification_type,
            lr.created_at
          FROM live_reports lr

          UNION ALL

          SELECT
            CONCAT('user-', u.id) AS notification_id,
            'user' AS notification_type,
            u.created_at
          FROM users u
        )
        SELECT
          COUNT(*)::int AS total_count,
          COUNT(*) FILTER (WHERE notification_type = 'zone_suggestion')::int AS zone_suggestion_count,
          COUNT(*) FILTER (WHERE notification_type = 'report')::int AS report_count,
          COUNT(*) FILTER (WHERE notification_type = 'user')::int AS user_count,
          COUNT(*) FILTER (WHERE $1::timestamptz IS NULL OR created_at > $1::timestamptz)::int AS unread_count,
          MAX(created_at) AS latest_created_at
        FROM notification_feed;
      `,
      [since],
    );

    const notificationRows = await sql(
      `
        WITH notification_feed AS (
          SELECT
            CONCAT('zone-suggestion-', spz.id) AS notification_id,
            'zone_suggestion' AS notification_type,
            spz.id::text AS entity_id,
            spz.created_at,
            COALESCE(spz.street_name, spz.area_name, CONCAT('Suggestion ', spz.id::text)) AS title,
            COALESCE(submitter.full_name, submitter.email, 'Unknown user') AS actor_name,
            submitter.email AS actor_email,
            spz.suggested_zone_type AS zone_type,
            spz.parking_category AS parking_category,
            spz.status,
            spz.confirmation_count,
            spz.false_flag_count,
            '/admin/zones/suggestions' AS href
          FROM suggested_parking_zones spz
          LEFT JOIN users submitter ON submitter.id = spz.user_id
          WHERE spz.status = 'pending'

          UNION ALL

          SELECT
            CONCAT('report-', lr.id) AS notification_id,
            'report' AS notification_type,
            lr.id::text AS entity_id,
            lr.created_at,
            COALESCE(pz.name, CONCAT(COALESCE(lr.parking_type, 'Parking'), ' report #', lr.id::text)) AS title,
            COALESCE(reporter.full_name, reporter.email, 'Unknown user') AS actor_name,
            reporter.email AS actor_email,
            COALESCE(pz.zone_type, lr.parking_type) AS zone_type,
            NULL::text AS parking_category,
            lr.status,
            NULL::int AS confirmation_count,
            NULL::int AS false_flag_count,
            '/admin/reports' AS href
          FROM live_reports lr
          LEFT JOIN users reporter ON reporter.id = lr.user_id
          LEFT JOIN parking_zones pz ON pz.id = lr.zone_id

          UNION ALL

          SELECT
            CONCAT('user-', u.id) AS notification_id,
            'user' AS notification_type,
            u.id::text AS entity_id,
            u.created_at,
            COALESCE(u.full_name, u.email, 'New user') AS title,
            COALESCE(u.full_name, u.email, 'New user') AS actor_name,
            u.email AS actor_email,
            NULL::text AS zone_type,
            NULL::text AS parking_category,
            'active' AS status,
            NULL::int AS confirmation_count,
            NULL::int AS false_flag_count,
            '/admin/users' AS href
          FROM users u
        )
        SELECT *
        FROM notification_feed
        ORDER BY created_at DESC
        LIMIT $1;
      `,
      [NOTIFICATION_LIMIT],
    );

    const summary = summaryRows[0] || {};

    return Response.json({
      success: true,
      summary: {
        totalCount: Number(summary.total_count) || 0,
        zoneSuggestionCount: Number(summary.zone_suggestion_count) || 0,
        reportCount: Number(summary.report_count) || 0,
        userCount: Number(summary.user_count) || 0,
        unreadCount: Number(summary.unread_count) || 0,
        latestCreatedAt: summary.latest_created_at || null,
      },
      notifications: notificationRows.map((item) => ({
        ...item,
        zone_name: item.title,
      })),
    });
  } catch (error) {
    console.error("Error loading admin notifications:", error);
    return Response.json(
      { success: false, error: "Failed to load admin notifications" },
      { status: 500 },
    );
  }
}
