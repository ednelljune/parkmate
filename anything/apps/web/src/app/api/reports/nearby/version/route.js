import sql from "@/app/api/utils/sql";
import { getEffectiveReportExpiresAtSql } from "@/app/api/utils/report-ttl";

const EXCLUDED_ZONE_TYPE = "meter";

export async function POST(request) {
  try {
    const { latitude, longitude, radiusMeters = 500 } = await request.json();

    if (latitude == null || longitude == null) {
      return Response.json(
        { success: false, error: "Location required" },
        { status: 400 },
      );
    }

    const effectiveExpiresAtSql = getEffectiveReportExpiresAtSql("lr");

    const rows = await sql(
      `
        WITH nearby_report_rows AS (
          SELECT
            lr.id,
            COALESCE(lr.status, 'available') AS status,
            COALESCE(lr.parking_type, '') AS parking_type,
            COALESCE(lr.quantity, 1) AS quantity,
            ${effectiveExpiresAtSql} AS expires_at,
            lr.created_at,
            COALESCE(pz.zone_type, '') AS zone_type
          FROM live_reports lr
          LEFT JOIN parking_zones pz ON lr.zone_id = pz.id
          WHERE COALESCE(lr.status, 'available') = 'available'
            AND ${effectiveExpiresAtSql} > CURRENT_TIMESTAMP
            AND LOWER(COALESCE(pz.zone_type, lr.parking_type, '')) NOT LIKE '%' || $4 || '%'
            AND ST_DWithin(
              lr.location::geography,
              ST_SetSRID(ST_Point($1, $2), 4326)::geography,
              $3
            )
        )
        SELECT
          COUNT(*)::int AS report_count,
          COALESCE(
            MD5(
              STRING_AGG(
                CONCAT_WS(
                  '|',
                  id::text,
                  status,
                  parking_type,
                  quantity::text,
                  COALESCE(expires_at::text, ''),
                  COALESCE(created_at::text, ''),
                  zone_type
                ),
                '||'
                ORDER BY created_at DESC, id DESC
              )
            ),
            'empty'
          ) AS checksum
        FROM nearby_report_rows
      `,
      [longitude, latitude, radiusMeters, EXCLUDED_ZONE_TYPE],
    );

    const status = rows[0] || {};
    const reportCount = Number(status.report_count) || 0;
    const checksum = status.checksum || "empty";

    return Response.json({
      success: true,
      reportCount,
      checksum,
      version: `${reportCount}:${checksum}`,
    });
  } catch (error) {
    console.error("[reports.nearby.version] Error checking nearby reports version", {
      message: error?.message || String(error),
      stack: error?.stack || null,
    });
    return Response.json(
      { success: false, error: error.message || "Failed to fetch nearby reports version" },
      { status: 500 },
    );
  }
}
