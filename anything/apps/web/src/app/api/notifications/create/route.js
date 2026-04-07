import sql from "@/app/api/utils/sql";
import { getEffectiveReportExpiresAtSql } from "@/app/api/utils/report-ttl";

const EXCLUDED_ZONE_TYPE = "meter";

/**
 * Create real-time push notifications for nearby users when a spot is reported
 * This sends actual push notifications to users' devices within a geographic radius
 */
export async function POST(request) {
  try {
    const {
      reportId,
      latitude,
      longitude,
      radiusMeters = 500,
    } = await request.json();

    if (reportId == null || latitude == null || longitude == null) {
      return Response.json(
        { success: false, error: "Report ID and coordinates are required" },
        { status: 400 },
      );
    }

    const effectiveExpiresAtSql = getEffectiveReportExpiresAtSql("lr");
    const reportResults = await sql(
      `
      SELECT 
        lr.id,
        lr.user_id as reporter_id,
        ST_Y(lr.location::geometry) as latitude,
        ST_X(lr.location::geometry) as longitude,
        lr.parking_type,
        lr.quantity,
        pz.zone_type,
        pz.name as zone_name,
        ${effectiveExpiresAtSql} AS expires_at
      FROM live_reports lr
      LEFT JOIN parking_zones pz ON lr.zone_id = pz.id
      WHERE lr.id = $1
        AND LOWER(COALESCE(pz.zone_type, lr.parking_type, '')) NOT LIKE '%' || ${EXCLUDED_ZONE_TYPE} || '%'
      LIMIT 1;
    `,
      [reportId],
    );

    if (reportResults.length === 0) {
      return Response.json(
        {
          success: true,
          notifiedUsers: 0,
          message: "Notifications skipped for unsupported parking type",
          radiusMeters,
        },
      );
    }

    const report = reportResults[0];

    const usersWithTokens = await sql`
      SELECT DISTINCT 
        pt.user_id, 
        pt.expo_push_token
      FROM push_tokens pt
      WHERE pt.user_id != ${report.reporter_id || 0}
      LIMIT 100
    `;

    if (usersWithTokens.length === 0) {
      return Response.json({
        success: true,
        notifiedUsers: 0,
        message: "No users with push tokens found",
        radiusMeters: radiusMeters,
      });
    }

    const parkingInfo = report.parking_type
      ? `${report.quantity > 1 ? `${report.quantity}x ` : ""}${report.parking_type}`
      : "Parking";
    const message = `${parkingInfo} spot${report.quantity > 1 ? "s" : ""} available nearby${report.zone_name ? ` in ${report.zone_name}` : ""}`;
    const title = "New Parking Available Nearby";

    const logPromises = usersWithTokens.map(
      (user) =>
        sql`
        INSERT INTO notification_logs (user_id, report_id, message)
        VALUES (${user.user_id}, ${reportId}, ${message})
      `,
    );
    await Promise.all(logPromises);

    const tokens = usersWithTokens.map((user) => user.expo_push_token);

    const pushUrl = new URL("/api/notifications/send-push", request.url).toString();
    const pushResponse = await fetch(pushUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tokens,
        title,
        body: message,
        data: {
          reportId: report.id,
          latitude: report.latitude,
          longitude: report.longitude,
          zone_name: report.zone_name,
          zone_type: report.zone_type || report.parking_type,
          distance_meters: 0,
          parking_type: report.parking_type,
          quantity: report.quantity,
          screen: "map",
        },
      }),
    });

    const pushResult = await pushResponse.json().catch(() => ({}));

    return Response.json({
      success: true,
      notifiedUsers: usersWithTokens.length,
      message,
      radiusMeters: radiusMeters,
      pushSent: pushResult.sent || 0,
      pushErrors: pushResult.errors || 0,
    });
  } catch (error) {
    console.error("Error creating notifications:", error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
