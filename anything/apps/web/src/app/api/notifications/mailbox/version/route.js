import sql from "@/app/api/utils/sql";
import { requireAuthenticatedUser } from "@/app/api/utils/supabase-auth";
import { ensureActivityLogSchema } from "@/app/api/utils/activity-log";
import { ensureFalseReportsSchema } from "@/app/api/utils/false-reports";
import {
  ensureHiddenNotificationsSchema,
  HIDDEN_NOTIFICATION_FEED_TYPES,
} from "@/app/api/utils/hidden-notifications";
import { getEffectiveReportExpiresAtSql } from "@/app/api/utils/report-ttl";

const EXCLUDED_ZONE_TYPE = "meter";

export async function GET(request) {
  try {
    await ensureActivityLogSchema();
    await ensureFalseReportsSchema();
    await ensureHiddenNotificationsSchema();

    const auth = await requireAuthenticatedUser(request);
    if (auth.response) {
      return auth.response;
    }

    const userId = auth.user.id;
    const effectiveExpiresAtSql = getEffectiveReportExpiresAtSql("lr");

    const rows = await sql(
      `
      WITH false_report_summary AS (
        SELECT
          fr.report_id,
          COUNT(*)::int AS false_report_count,
          MAX(fr.created_at) AS last_false_report_at
        FROM false_reports fr
        GROUP BY fr.report_id
      ),
      mailbox_version_events AS (
        SELECT
          CONCAT('claimed-', COALESCE(ual.event_key, ual.id::text, ual.report_id::text)) AS event_id,
          ual.occurred_at
        FROM user_activity_logs ual
        LEFT JOIN live_reports lr ON lr.id = ual.report_id
        WHERE ual.user_id = $1
          AND ual.activity_type = 'report_claimed'
          AND LOWER(COALESCE(ual.zone_type, ual.parking_type, '')) NOT LIKE '%' || $2 || '%'

        UNION ALL

        SELECT
          CONCAT('claimed-', lr.id) AS event_id,
          COALESCE(lr.claimed_at, lr.created_at) AS occurred_at
        FROM live_reports lr
        LEFT JOIN parking_zones pz ON pz.id = lr.zone_id
        WHERE lr.user_id = $1
          AND lr.status = 'claimed'
          AND lr.claimed_at IS NOT NULL
          AND LOWER(COALESCE(pz.zone_type, lr.parking_type, '')) NOT LIKE '%' || $2 || '%'
          AND NOT EXISTS (
            SELECT 1
            FROM user_activity_logs ual
            WHERE ual.user_id = $1
              AND ual.report_id = lr.id
              AND ual.activity_type = 'report_claimed'
          )

        UNION ALL

        SELECT
          CONCAT('expired-', lr.id) AS event_id,
          ${effectiveExpiresAtSql} AS occurred_at
        FROM live_reports lr
        LEFT JOIN parking_zones pz ON pz.id = lr.zone_id
        WHERE lr.user_id = $1
          AND lr.status = 'available'
          AND ${effectiveExpiresAtSql} < CURRENT_TIMESTAMP
          AND LOWER(COALESCE(pz.zone_type, lr.parking_type, '')) NOT LIKE '%' || $2 || '%'

        UNION ALL

        SELECT
          CONCAT('false-', lr.id, '-', COALESCE(frs.false_report_count, 0)) AS event_id,
          frs.last_false_report_at AS occurred_at
        FROM live_reports lr
        INNER JOIN false_report_summary frs ON frs.report_id = lr.id
        LEFT JOIN parking_zones pz ON pz.id = lr.zone_id
        WHERE lr.user_id = $1
          AND LOWER(COALESCE(pz.zone_type, lr.parking_type, '')) NOT LIKE '%' || $2 || '%'

        UNION ALL

        SELECT
          CONCAT('hidden-mailbox-', uhn.notification_id) AS event_id,
          uhn.created_at AS occurred_at
        FROM user_hidden_notifications uhn
        WHERE uhn.user_id = $1
          AND uhn.feed_type = $3
      ),
      deduped_mailbox_version_events AS (
        SELECT
          event_id,
          MAX(occurred_at) AS occurred_at
        FROM mailbox_version_events
        WHERE event_id IS NOT NULL
          AND occurred_at IS NOT NULL
        GROUP BY event_id
      )
      SELECT
        COUNT(*)::int AS event_count,
        MAX(occurred_at) AS latest_occurred_at
      FROM deduped_mailbox_version_events
    `,
      [userId, EXCLUDED_ZONE_TYPE, HIDDEN_NOTIFICATION_FEED_TYPES.mailbox],
    );

    const status = rows[0] || {};

    return Response.json({
      success: true,
      eventCount: Number(status.event_count) || 0,
      latestOccurredAt: status.latest_occurred_at || null,
      version: `${Number(status.event_count) || 0}:${status.latest_occurred_at || "empty"}`,
    });
  } catch (error) {
    console.error("Error fetching mailbox version:", error);
    return Response.json(
      { success: false, error: error.message || "Failed to fetch mailbox version" },
      { status: 500 },
    );
  }
}
