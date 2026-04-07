import sql from "@/app/api/utils/sql";
import { requireAuthenticatedUser } from "@/app/api/utils/supabase-auth";
import { ensureFalseReportsSchema } from "@/app/api/utils/false-reports";

const LEGACY_ACTIVITY_TIMEOUT_MS = 4000;
const EXCLUDED_ZONE_TYPE = "meter";

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

  if (activity.activity_type === "false_reported") {
    return `You reported ${quantityLabel}${zoneLabel} as a false report.`;
  }

  return `You reported ${quantityLabel}${zoneLabel}.`;
};

const loadLegacyActivities = async (userId, limit) =>
  sql`
    WITH activity_feed AS (
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
        pz.name AS zone_name
      FROM live_reports lr
      LEFT JOIN parking_zones pz ON pz.id = lr.zone_id
      WHERE lr.user_id = ${userId}
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
        pz.name AS zone_name
      FROM live_reports lr
      LEFT JOIN parking_zones pz ON pz.id = lr.zone_id
      WHERE lr.claimed_by = ${userId}
        AND LOWER(COALESCE(pz.zone_type, lr.parking_type, '')) NOT LIKE '%' || ${EXCLUDED_ZONE_TYPE} || '%'

      UNION ALL

      SELECT
        CONCAT('false-', fr.id) AS id,
        'false_reported' AS activity_type,
        lr.id AS report_id,
        lr.status AS spot_status,
        lr.parking_type,
        lr.quantity,
        fr.created_at AS occurred_at,
        ST_X(lr.location::geometry) AS longitude,
        ST_Y(lr.location::geometry) AS latitude,
        pz.zone_type,
        pz.name AS zone_name
      FROM false_reports fr
      INNER JOIN live_reports lr ON lr.id = fr.report_id
      LEFT JOIN parking_zones pz ON pz.id = lr.zone_id
      WHERE fr.reported_by = ${userId}
        AND LOWER(COALESCE(pz.zone_type, lr.parking_type, '')) NOT LIKE '%' || ${EXCLUDED_ZONE_TYPE} || '%'
    )
    SELECT *
    FROM activity_feed
    ORDER BY occurred_at DESC
    LIMIT ${limit}
  `;

const loadPersistedActivities = async (userId, limit) =>
  sql`
    SELECT
      CONCAT(activity_type, '-', COALESCE(report_id::text, id::text)) AS id,
      activity_type,
      report_id,
      spot_status,
      parking_type,
      quantity,
      occurred_at,
      longitude,
      latitude,
      zone_type,
      zone_name
    FROM user_activity_logs
    WHERE user_id = ${userId}
    AND LOWER(COALESCE(zone_type, parking_type, '')) NOT LIKE '%' || ${EXCLUDED_ZONE_TYPE} || '%'
    ORDER BY occurred_at DESC
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
    if (persistedActivities.length < limit) {
      try {
        legacyActivities = await withTimeout(
          loadLegacyActivities(userId, limit),
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
