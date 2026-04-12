import sql from "@/app/api/utils/sql";
import { requireAuthenticatedUser } from "@/app/api/utils/supabase-auth";
import { ensureActivityLogSchema } from "@/app/api/utils/activity-log";
import { ensureFalseReportsSchema } from "@/app/api/utils/false-reports";
import { getEffectiveReportExpiresAtSql } from "@/app/api/utils/report-ttl";

const LEGACY_ACTIVITY_TIMEOUT_MS = 4000;
const EXCLUDED_ZONE_TYPE = "meter";
const FALSE_REPORT_TRUST_THRESHOLD = 3;

const buildActivityMessage = (activity) => {
  const quantity = Number(activity.quantity) || 1;
  const parkingType = activity.parking_type || activity.zone_type || "Parking";
  const zoneName = activity.zone_name || "Reported spot";
  const quantityLabel =
    quantity > 1 ? `${quantity} ${parkingType} spots` : `${parkingType} spot`;
  const zoneLabel = ` in ${zoneName}`;

  if (activity.activity_type === "claimed") {
    return `You claimed ${quantityLabel}${zoneLabel}.`;
  }

  if (activity.activity_type === "report_claimed") {
    return `Your reported ${quantityLabel}${zoneLabel} was claimed. You earned 10 contribution points.`;
  }

  if (activity.activity_type === "expired") {
    return `Your reported ${quantityLabel}${zoneLabel} expired before it was claimed.`;
  }

  if (activity.activity_type === "false_reported") {
    if (activity.is_system_update) {
      const falseReportCount = Math.max(1, Number(activity.false_report_count) || 1);
      const trustScoreAffected = Boolean(activity.trust_score_affected);

      return trustScoreAffected
        ? `Your reported ${quantityLabel}${zoneLabel} was flagged as false by ${falseReportCount} drivers. Trust score impact has been applied.`
        : `Your reported ${quantityLabel}${zoneLabel} was flagged as false by ${falseReportCount} drivers.`;
    }

    return `You reported ${quantityLabel}${zoneLabel} as a false report.`;
  }

  return `You reported ${quantityLabel}${zoneLabel}.`;
};

const loadLegacyActivities = async (userId, limit) =>
  sql`
    WITH false_report_summary AS (
      SELECT
        fr.report_id,
        COUNT(*)::int AS false_report_count,
        MAX(fr.created_at) AS last_false_report_at
      FROM false_reports fr
      GROUP BY fr.report_id
    ),
    activity_feed AS (
      SELECT
        CONCAT('reported-', lr.id) AS id,
        'reported' AS activity_type,
        lr.id AS report_id,
        lr.status AS spot_status,
        lr.parking_type,
        lr.quantity,
        lr.created_at AS occurred_at,
        ST_X(lr.location::geometry) AS longitude,
        ST_Y(lr.location::geometry) AS latitude,
        pz.zone_type,
        pz.name AS zone_name,
        NULL::text AS event_key,
        NULL::int AS false_report_count,
        ${FALSE_REPORT_TRUST_THRESHOLD}::int AS trust_score_threshold,
        false AS trust_score_affected,
        false AS is_system_update
      FROM live_reports lr
      LEFT JOIN parking_zones pz ON pz.id = lr.zone_id
      WHERE lr.user_id = ${userId}
        AND NOT EXISTS (
          SELECT 1
          FROM user_activity_logs ual
          WHERE ual.user_id = ${userId}
            AND ual.report_id = lr.id
            AND ual.activity_type = 'reported'
        )
        AND LOWER(COALESCE(pz.zone_type, lr.parking_type, '')) NOT LIKE '%' || ${EXCLUDED_ZONE_TYPE} || '%'

      UNION ALL

      SELECT
        CONCAT('claimed-', lr.id) AS id,
        'claimed' AS activity_type,
        lr.id AS report_id,
        lr.status AS spot_status,
        lr.parking_type,
        lr.quantity,
        COALESCE(lr.claimed_at, lr.created_at) AS occurred_at,
        ST_X(lr.location::geometry) AS longitude,
        ST_Y(lr.location::geometry) AS latitude,
        pz.zone_type,
        pz.name AS zone_name,
        NULL::text AS event_key,
        NULL::int AS false_report_count,
        ${FALSE_REPORT_TRUST_THRESHOLD}::int AS trust_score_threshold,
        false AS trust_score_affected,
        false AS is_system_update
      FROM live_reports lr
      LEFT JOIN parking_zones pz ON pz.id = lr.zone_id
      WHERE lr.claimed_by = ${userId}
        AND NOT EXISTS (
          SELECT 1
          FROM user_activity_logs ual
          WHERE ual.user_id = ${userId}
            AND ual.report_id = lr.id
            AND ual.activity_type = 'claimed'
        )
        AND LOWER(COALESCE(pz.zone_type, lr.parking_type, '')) NOT LIKE '%' || ${EXCLUDED_ZONE_TYPE} || '%'

      UNION ALL

      SELECT
        CONCAT('report-claimed-', lr.id) AS id,
        'report_claimed' AS activity_type,
        lr.id AS report_id,
        lr.status AS spot_status,
        lr.parking_type,
        1 AS quantity,
        COALESCE(lr.claimed_at, lr.created_at) AS occurred_at,
        ST_X(lr.location::geometry) AS longitude,
        ST_Y(lr.location::geometry) AS latitude,
        pz.zone_type,
        pz.name AS zone_name,
        CONCAT('report-', lr.id, '-claim-final') AS event_key,
        NULL::int AS false_report_count,
        ${FALSE_REPORT_TRUST_THRESHOLD}::int AS trust_score_threshold,
        false AS trust_score_affected,
        true AS is_system_update
      FROM live_reports lr
      LEFT JOIN parking_zones pz ON pz.id = lr.zone_id
      WHERE lr.user_id = ${userId}
        AND lr.status = 'claimed'
        AND lr.claimed_at IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM user_activity_logs ual
          WHERE ual.user_id = ${userId}
            AND ual.report_id = lr.id
            AND ual.activity_type = 'report_claimed'
        )
        AND LOWER(COALESCE(pz.zone_type, lr.parking_type, '')) NOT LIKE '%' || ${EXCLUDED_ZONE_TYPE} || '%'

      UNION ALL

      SELECT
        CONCAT('false-action-', fr.id) AS id,
        'false_reported' AS activity_type,
        lr.id AS report_id,
        lr.status AS spot_status,
        lr.parking_type,
        lr.quantity,
        fr.created_at AS occurred_at,
        ST_X(lr.location::geometry) AS longitude,
        ST_Y(lr.location::geometry) AS latitude,
        pz.zone_type,
        pz.name AS zone_name,
        NULL::text AS event_key,
        frs.false_report_count,
        ${FALSE_REPORT_TRUST_THRESHOLD}::int AS trust_score_threshold,
        (frs.false_report_count >= ${FALSE_REPORT_TRUST_THRESHOLD}) AS trust_score_affected,
        false AS is_system_update
      FROM false_reports fr
      INNER JOIN live_reports lr ON lr.id = fr.report_id
      LEFT JOIN false_report_summary frs ON frs.report_id = lr.id
      LEFT JOIN parking_zones pz ON pz.id = lr.zone_id
      WHERE fr.reported_by = ${userId}
        AND NOT EXISTS (
          SELECT 1
          FROM user_activity_logs ual
          WHERE ual.user_id = ${userId}
            AND ual.report_id = lr.id
            AND ual.activity_type = 'false_reported'
            AND ual.event_key IS NULL
        )
        AND LOWER(COALESCE(pz.zone_type, lr.parking_type, '')) NOT LIKE '%' || ${EXCLUDED_ZONE_TYPE} || '%'

      UNION ALL

      SELECT
        CONCAT('false_reported-report-', lr.id, '-false-count-', frs.false_report_count) AS id,
        'false_reported' AS activity_type,
        lr.id AS report_id,
        lr.status AS spot_status,
        lr.parking_type,
        lr.quantity,
        frs.last_false_report_at AS occurred_at,
        ST_X(lr.location::geometry) AS longitude,
        ST_Y(lr.location::geometry) AS latitude,
        pz.zone_type,
        pz.name AS zone_name,
        CONCAT('report-', lr.id, '-false-count-', frs.false_report_count) AS event_key,
        frs.false_report_count,
        ${FALSE_REPORT_TRUST_THRESHOLD}::int AS trust_score_threshold,
        (frs.false_report_count >= ${FALSE_REPORT_TRUST_THRESHOLD}) AS trust_score_affected,
        true AS is_system_update
      FROM live_reports lr
      INNER JOIN false_report_summary frs ON frs.report_id = lr.id
      LEFT JOIN parking_zones pz ON pz.id = lr.zone_id
      WHERE lr.user_id = ${userId}
        AND NOT EXISTS (
          SELECT 1
          FROM user_activity_logs ual
          WHERE ual.user_id = ${userId}
            AND ual.report_id = lr.id
            AND ual.activity_type = 'false_reported'
            AND ual.event_key = CONCAT('report-', lr.id, '-false-count-', frs.false_report_count)
        )
        AND LOWER(COALESCE(pz.zone_type, lr.parking_type, '')) NOT LIKE '%' || ${EXCLUDED_ZONE_TYPE} || '%'

      UNION ALL

      SELECT
        CONCAT('expired-report-', lr.id, '-expired') AS id,
        'expired' AS activity_type,
        lr.id AS report_id,
        lr.status AS spot_status,
        lr.parking_type,
        lr.quantity,
        ${getEffectiveReportExpiresAtSql("lr")} AS occurred_at,
        ST_X(lr.location::geometry) AS longitude,
        ST_Y(lr.location::geometry) AS latitude,
        pz.zone_type,
        pz.name AS zone_name,
        CONCAT('report-', lr.id, '-expired') AS event_key,
        NULL::int AS false_report_count,
        ${FALSE_REPORT_TRUST_THRESHOLD}::int AS trust_score_threshold,
        false AS trust_score_affected,
        true AS is_system_update
      FROM live_reports lr
      LEFT JOIN parking_zones pz ON pz.id = lr.zone_id
      WHERE lr.user_id = ${userId}
        AND lr.status = 'available'
        AND ${getEffectiveReportExpiresAtSql("lr")} < CURRENT_TIMESTAMP
        AND NOT EXISTS (
          SELECT 1
          FROM user_activity_logs ual
          WHERE ual.user_id = ${userId}
            AND ual.report_id = lr.id
            AND ual.activity_type = 'expired'
            AND ual.event_key = CONCAT('report-', lr.id, '-expired')
        )
        AND LOWER(COALESCE(pz.zone_type, lr.parking_type, '')) NOT LIKE '%' || ${EXCLUDED_ZONE_TYPE} || '%'
    )
    SELECT *
    FROM activity_feed
    ORDER BY occurred_at DESC
    LIMIT ${limit}
  `;

const loadPersistedActivities = async (userId, limit) =>
  sql`
    WITH false_report_summary AS (
      SELECT
        fr.report_id,
        COUNT(*)::int AS false_report_count
      FROM false_reports fr
      GROUP BY fr.report_id
    )
    SELECT
      CONCAT(ual.activity_type, '-', COALESCE(ual.event_key, ual.report_id::text, ual.id::text)) AS id,
      ual.activity_type,
      ual.report_id,
      ual.spot_status,
      ual.parking_type,
      ual.quantity,
      ual.occurred_at,
      ual.longitude,
      ual.latitude,
      ual.zone_type,
      ual.zone_name,
      ual.event_key,
      CASE
        WHEN ual.activity_type = 'false_reported' THEN frs.false_report_count
        ELSE NULL
      END AS false_report_count,
      ${FALSE_REPORT_TRUST_THRESHOLD}::int AS trust_score_threshold,
      CASE
        WHEN ual.activity_type = 'false_reported' THEN COALESCE(frs.false_report_count, 0) >= ${FALSE_REPORT_TRUST_THRESHOLD}
        ELSE false
      END AS trust_score_affected,
      CASE
        WHEN ual.activity_type IN ('report_claimed', 'expired') THEN true
        WHEN ual.activity_type = 'false_reported' AND ual.event_key IS NOT NULL THEN true
        ELSE false
      END AS is_system_update
    FROM user_activity_logs ual
    LEFT JOIN false_report_summary frs ON frs.report_id = ual.report_id
    WHERE ual.user_id = ${userId}
    AND ual.activity_type IN ('reported', 'claimed', 'false_reported', 'report_claimed', 'expired')
    AND LOWER(COALESCE(ual.zone_type, ual.parking_type, '')) NOT LIKE '%' || ${EXCLUDED_ZONE_TYPE} || '%'
    ORDER BY ual.occurred_at DESC
    LIMIT ${limit}
  `;

const mergeActivities = (persistedActivities, legacyActivities, limit) => {
  const merged = [];
  const seenIds = new Set();

  [...persistedActivities, ...legacyActivities]
    .sort((a, b) => {
      const aTime = new Date(a?.occurred_at || 0).getTime();
      const bTime = new Date(b?.occurred_at || 0).getTime();
      return bTime - aTime;
    })
    .forEach((activity) => {
      const id = String(activity?.id || "");
      if (!id || seenIds.has(id)) {
        return;
      }

      seenIds.add(id);
      merged.push(activity);
    });

  return merged.slice(0, limit);
};

const withTimeout = async (promise, timeoutMs, timeoutMessage) => {
  let timeoutId;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(timeoutMessage));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
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
    let persistedActivities = [];
    try {
      persistedActivities = await loadPersistedActivities(userId, limit);
    } catch (persistedActivitiesError) {
      console.warn("Falling back because persisted activity feed is unavailable:", persistedActivitiesError);
    }

    let legacyActivities = [];
    const remainingLegacyLimit = Math.max(limit - persistedActivities.length, 0);
    if (remainingLegacyLimit > 0) {
      try {
        legacyActivities = await withTimeout(
          loadLegacyActivities(userId, remainingLegacyLimit),
          LEGACY_ACTIVITY_TIMEOUT_MS,
          `Legacy activity feed query exceeded ${LEGACY_ACTIVITY_TIMEOUT_MS}ms`,
        );
      } catch (legacyActivitiesError) {
        console.warn("Skipping legacy activity feed query:", legacyActivitiesError);
      }
    }

    const activities = mergeActivities(persistedActivities, legacyActivities, limit);

    const notifications = activities.map((activity) => ({
      ...activity,
      zone_name: activity.zone_name || "Reported spot",
      message: buildActivityMessage(activity),
      sent_at: activity.occurred_at,
    }));

    return Response.json({
      success: true,
      notifications,
    });
  } catch (error) {
    console.error("Error fetching notification activity feed:", error);
    return Response.json(
      { success: false, error: error.message || "Failed to fetch activity feed" },
      { status: 500 },
    );
  }
}
