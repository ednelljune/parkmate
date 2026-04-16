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
const FALSE_REPORT_TRUST_THRESHOLD = 3;

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
          MAX(fr.created_at) AS last_false_report_at
        FROM false_reports fr
        GROUP BY fr.report_id
      ),
      activity_version_events AS (
        SELECT
          CONCAT('persisted-', ual.activity_type, '-', COALESCE(ual.event_key, ual.report_id::text, ual.id::text)) AS event_id,
          ual.occurred_at
        FROM user_activity_logs ual
        WHERE ual.user_id = $1
          AND ual.activity_type IN ('reported', 'claimed', 'false_reported', 'report_claimed')
          AND LOWER(COALESCE(ual.zone_type, ual.parking_type, '')) NOT LIKE '%' || $2 || '%'

        UNION ALL

        SELECT
          CONCAT('legacy-reported-', lr.id) AS event_id,
          lr.created_at AS occurred_at
        FROM live_reports lr
        LEFT JOIN parking_zones pz ON pz.id = lr.zone_id
        WHERE lr.user_id = $1
          AND LOWER(COALESCE(pz.zone_type, lr.parking_type, '')) NOT LIKE '%' || $2 || '%'

        UNION ALL

        SELECT
          CONCAT('legacy-claimed-', lr.id) AS event_id,
          COALESCE(lr.claimed_at, lr.created_at) AS occurred_at
        FROM live_reports lr
        LEFT JOIN parking_zones pz ON pz.id = lr.zone_id
        WHERE lr.claimed_by = $1
          AND LOWER(COALESCE(pz.zone_type, lr.parking_type, '')) NOT LIKE '%' || $2 || '%'

        UNION ALL

        SELECT
          CONCAT('legacy-report-claimed-', lr.id) AS event_id,
          COALESCE(lr.claimed_at, lr.created_at) AS occurred_at
        FROM live_reports lr
        LEFT JOIN parking_zones pz ON pz.id = lr.zone_id
        WHERE lr.user_id = $1
          AND lr.status = 'claimed'
          AND lr.claimed_at IS NOT NULL
          AND LOWER(COALESCE(pz.zone_type, lr.parking_type, '')) NOT LIKE '%' || $2 || '%'

        UNION ALL

        SELECT
          CONCAT('legacy-false-', fr.id) AS event_id,
          fr.created_at AS occurred_at
        FROM false_reports fr
        INNER JOIN live_reports lr ON lr.id = fr.report_id
        LEFT JOIN parking_zones pz ON pz.id = lr.zone_id
        WHERE fr.reported_by = $1
          AND LOWER(COALESCE(pz.zone_type, lr.parking_type, '')) NOT LIKE '%' || $2 || '%'

        UNION ALL

        SELECT
          CONCAT('mailbox-expired-', lr.id) AS event_id,
          ${effectiveExpiresAtSql} AS occurred_at
        FROM live_reports lr
        LEFT JOIN parking_zones pz ON pz.id = lr.zone_id
        WHERE lr.user_id = $1
          AND lr.status = 'available'
          AND ${effectiveExpiresAtSql} < CURRENT_TIMESTAMP
          AND LOWER(COALESCE(pz.zone_type, lr.parking_type, '')) NOT LIKE '%' || $2 || '%'

        UNION ALL

        SELECT
          CONCAT('mailbox-false-', lr.id) AS event_id,
          frs.last_false_report_at AS occurred_at
        FROM live_reports lr
        INNER JOIN false_report_summary frs ON frs.report_id = lr.id
        LEFT JOIN parking_zones pz ON pz.id = lr.zone_id
        WHERE lr.user_id = $1
          AND (
            SELECT COUNT(*)::int
            FROM false_reports fr_count
            WHERE fr_count.report_id = lr.id
          ) >= ${FALSE_REPORT_TRUST_THRESHOLD}
          AND LOWER(COALESCE(pz.zone_type, lr.parking_type, '')) NOT LIKE '%' || $2 || '%'

        UNION ALL

        SELECT
          CONCAT('hidden-activity-', uhn.notification_id) AS event_id,
          uhn.created_at AS occurred_at
        FROM user_hidden_notifications uhn
        WHERE uhn.user_id = $1
          AND uhn.feed_type = $3
      ),
      deduped_activity_version_events AS (
        SELECT
          event_id,
          MAX(occurred_at) AS occurred_at
        FROM activity_version_events
        WHERE event_id IS NOT NULL
          AND occurred_at IS NOT NULL
        GROUP BY event_id
      )
      SELECT
        COUNT(*)::int AS event_count,
        MAX(occurred_at) AS latest_occurred_at
      FROM deduped_activity_version_events
    `,
      [userId, EXCLUDED_ZONE_TYPE, HIDDEN_NOTIFICATION_FEED_TYPES.activity],
    );

    const status = rows[0] || {};

    return Response.json({
      success: true,
      eventCount: Number(status.event_count) || 0,
      latestOccurredAt: status.latest_occurred_at || null,
      version: `${Number(status.event_count) || 0}:${status.latest_occurred_at || "empty"}`,
    });
  } catch (error) {
    console.error("Error fetching activity version:", error);
    return Response.json(
      { success: false, error: error.message || "Failed to fetch activity version" },
      { status: 500 },
    );
  }
}
