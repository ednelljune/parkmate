import sql from "@/app/api/utils/sql";
import { requireAuthenticatedUser } from "@/app/api/utils/supabase-auth";
import { ensureActivityLogSchema } from "@/app/api/utils/activity-log";
import { ensureFalseReportsSchema } from "@/app/api/utils/false-reports";
import { getEffectiveReportExpiresAtSql } from "@/app/api/utils/report-ttl";

const EXCLUDED_ZONE_TYPE = "meter";
const CLAIM_POINTS_AWARDED = 10;
const FALSE_REPORT_TRUST_THRESHOLD = 3;

const buildSystemUpdateMessage = (item) => {
  const quantity = Math.max(1, Number(item?.quantity) || 1);
  const parkingType = item?.parking_type || item?.zone_type || "Parking";
  const zoneName = item?.zone_name || "Reported spot";
  const quantityLabel =
    quantity > 1 ? `${quantity} ${parkingType} spots` : `${parkingType} spot`;

  if (item.mailbox_type === "claimed") {
    return `${quantityLabel} in ${zoneName} was claimed. You earned ${CLAIM_POINTS_AWARDED} points.`;
  }

  if (item.mailbox_type === "expired") {
    return `${quantityLabel} in ${zoneName} expired without being claimed.`;
  }

  const falseReportCount = Math.max(1, Number(item?.false_report_count) || 1);
  const reporterLabel = falseReportCount === 1 ? "driver" : "drivers";
  const trustLabel =
    falseReportCount >= FALSE_REPORT_TRUST_THRESHOLD
      ? " Trust score impact has already been applied."
      : ` Trust score impact starts after ${FALSE_REPORT_TRUST_THRESHOLD} users flag the same spot.`;

  return `${quantityLabel} in ${zoneName} was flagged as false by ${falseReportCount} ${reporterLabel}.${trustLabel}`;
};

export async function GET(request) {
  try {
    await ensureActivityLogSchema();
    await ensureFalseReportsSchema();

    const auth = await requireAuthenticatedUser(request);
    if (auth.response) {
      return auth.response;
    }

    const { searchParams } = new URL(request.url);
    const requestedLimit = Number.parseInt(searchParams.get("limit") || "50", 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 200)
      : 50;
    const userId = auth.user.id;
    const effectiveExpiresAtSql = getEffectiveReportExpiresAtSql("lr");

    const systemUpdateItems = await sql(
      `
      WITH false_report_summary AS (
        SELECT
          fr.report_id,
          COUNT(*)::int AS false_report_count,
          MAX(fr.created_at) AS last_false_report_at
        FROM false_reports fr
        GROUP BY fr.report_id
      ),
      system_updates_feed AS (
        SELECT
          CONCAT('claimed-', COALESCE(ual.event_key, ual.id::text, ual.report_id::text)) AS id,
          'claimed' AS mailbox_type,
          ual.report_id,
          ual.spot_status,
          ual.parking_type,
          ual.quantity,
          ual.occurred_at,
          lr.expires_at,
          ual.longitude,
          ual.latitude,
          ual.zone_type,
          ual.zone_name,
          $2::int AS claim_points_awarded,
          NULL::int AS false_report_count,
          $3::int AS trust_score_threshold,
          false AS trust_score_affected
        FROM user_activity_logs ual
        LEFT JOIN live_reports lr ON lr.id = ual.report_id
        WHERE ual.user_id = $1
          AND ual.activity_type = 'report_claimed'

        UNION ALL

        SELECT
          CONCAT('claimed-', lr.id) AS id,
          'claimed' AS mailbox_type,
          lr.id AS report_id,
          lr.status AS spot_status,
          lr.parking_type,
          1 AS quantity,
          COALESCE(lr.claimed_at, lr.created_at) AS occurred_at,
          ${effectiveExpiresAtSql} AS expires_at,
          ST_X(lr.location::geometry) AS longitude,
          ST_Y(lr.location::geometry) AS latitude,
          pz.zone_type,
          pz.name AS zone_name,
          $2::int AS claim_points_awarded,
          NULL::int AS false_report_count,
          $3::int AS trust_score_threshold,
          false AS trust_score_affected
        FROM live_reports lr
        LEFT JOIN parking_zones pz ON pz.id = lr.zone_id
        WHERE lr.user_id = $1
          AND lr.status = 'claimed'
          AND lr.claimed_at IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM user_activity_logs ual
            WHERE ual.user_id = $1
              AND ual.report_id = lr.id
              AND ual.activity_type = 'report_claimed'
          )

        UNION ALL

        SELECT
          CONCAT('expired-', lr.id) AS id,
          'expired' AS mailbox_type,
          lr.id AS report_id,
          lr.status AS spot_status,
          lr.parking_type,
          lr.quantity,
          ${effectiveExpiresAtSql} AS occurred_at,
          ${effectiveExpiresAtSql} AS expires_at,
          ST_X(lr.location::geometry) AS longitude,
          ST_Y(lr.location::geometry) AS latitude,
          pz.zone_type,
          pz.name AS zone_name,
          NULL::int AS claim_points_awarded,
          NULL::int AS false_report_count,
          $3::int AS trust_score_threshold,
          false AS trust_score_affected
        FROM live_reports lr
        LEFT JOIN parking_zones pz ON pz.id = lr.zone_id
        WHERE lr.user_id = $1
          AND lr.status = 'available'
          AND ${effectiveExpiresAtSql} < CURRENT_TIMESTAMP

        UNION ALL

        SELECT
          CONCAT('false-', lr.id) AS id,
          'false_reported' AS mailbox_type,
          lr.id AS report_id,
          lr.status AS spot_status,
          lr.parking_type,
          lr.quantity,
          frs.last_false_report_at AS occurred_at,
          ${effectiveExpiresAtSql} AS expires_at,
          ST_X(lr.location::geometry) AS longitude,
          ST_Y(lr.location::geometry) AS latitude,
          pz.zone_type,
          pz.name AS zone_name,
          NULL::int AS claim_points_awarded,
          frs.false_report_count,
          $3::int AS trust_score_threshold,
          (frs.false_report_count >= $3) AS trust_score_affected
        FROM live_reports lr
        INNER JOIN false_report_summary frs ON frs.report_id = lr.id
        LEFT JOIN parking_zones pz ON pz.id = lr.zone_id
        WHERE lr.user_id = $1
          AND frs.false_report_count >= $3
      )
      SELECT *
      FROM system_updates_feed
      WHERE LOWER(COALESCE(zone_type, parking_type, '')) NOT LIKE '%' || $4 || '%'
      ORDER BY occurred_at DESC
      LIMIT $5
    `,
      [userId, CLAIM_POINTS_AWARDED, FALSE_REPORT_TRUST_THRESHOLD, EXCLUDED_ZONE_TYPE, limit],
    );

    const notifications = systemUpdateItems.map((item) => ({
      ...item,
      zone_name: item.zone_name || "Reported spot",
      message: buildSystemUpdateMessage(item),
      sent_at: item.occurred_at,
    }));

    const summary = notifications.reduce(
      (accumulator, item) => {
        accumulator.total += 1;

        if (item.mailbox_type === "claimed") {
          accumulator.claimed += 1;
        } else if (item.mailbox_type === "expired") {
          accumulator.expired += 1;
        } else if (item.mailbox_type === "false_reported") {
          accumulator.falseReported += 1;
        }

        return accumulator;
      },
      { total: 0, claimed: 0, expired: 0, falseReported: 0 },
    );

    console.log("[notifications.system-updates] System updates fetched", {
      userId,
      total: summary.total,
      claimed: summary.claimed,
      expired: summary.expired,
      falseReported: summary.falseReported,
      claimedReportIds: notifications
        .filter((item) => item.mailbox_type === "claimed")
        .map((item) => item.report_id),
    });

    return Response.json({
      success: true,
      notifications,
      summary,
    });
  } catch (error) {
    console.error("Error fetching notification system updates:", error);
    return Response.json(
      { success: false, error: error.message || "Failed to fetch notification system updates" },
      { status: 500 },
    );
  }
}
