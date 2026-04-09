import sql from "@/app/api/utils/sql";
import {
  applyEffectiveReportExpiry,
  getEffectiveReportExpiresAtSql,
} from "@/app/api/utils/report-ttl";

const EXCLUDED_ZONE_TYPE = "meter";

export async function POST(request) {
  try {
    const {
      latitude,
      longitude,
      radiusMeters = 500,
      limit = 100,
    } = await request.json();

    console.log("[reports.nearby] Incoming nearby request", {
      latitude,
      longitude,
      radiusMeters,
      limit,
    });

    if (latitude == null || longitude == null) {
      console.warn("[reports.nearby] Nearby request missing location", {
        latitude,
        longitude,
      });
      return Response.json(
        { success: false, error: "Location required" },
        { status: 400 },
      );
    }

    const effectiveExpiresAtSql = getEffectiveReportExpiresAtSql("lr");

    const spots = await sql(
      `
        SELECT
          lr.id,
          lr.user_id,
          lr.zone_id,
          lr.created_at,
          ${effectiveExpiresAtSql} AS expires_at,
          lr.status,
          lr.parking_type,
          lr.quantity,
          ST_X(lr.location::geometry) AS longitude,
          ST_Y(lr.location::geometry) AS latitude,
          pz.name AS zone_name,
          pz.zone_type,
          ST_Distance(
            lr.location::geography,
            ST_SetSRID(ST_Point($1, $2), 4326)::geography
          ) AS distance_meters
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
        ORDER BY lr.created_at DESC
        LIMIT $5
      `,
      [longitude, latitude, radiusMeters, EXCLUDED_ZONE_TYPE, limit],
    );

    console.log("[reports.nearby] Nearby query completed", {
      latitude,
      longitude,
      radiusMeters,
      resultCount: spots.length,
    });

    return Response.json({
      success: true,
      spots: spots.map((spot) => ({
        ...applyEffectiveReportExpiry(spot),
        zone_type: spot.zone_type || spot.parking_type || "1P",
        zone_name: spot.zone_name || "Reported spot",
      })),
    });
  } catch (error) {
    console.error("[reports.nearby] Error fetching nearby reports", {
      message: error?.message || String(error),
      stack: error?.stack || null,
    });
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
