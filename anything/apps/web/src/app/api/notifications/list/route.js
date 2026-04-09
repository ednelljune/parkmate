import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/app/api/utils/supabase-auth";
import { ensureFalseReportsSchema } from "@/app/api/utils/false-reports";
import {
  applyEffectiveReportExpiry,
  getEffectiveReportExpiresAtSql,
} from "@/app/api/utils/report-ttl";

const EXCLUDED_ZONE_TYPE = "meter";

/**
 * Get all reported parking spots for notifications feed
 * Shows ALL spots (available, claimed, expired, false reports) with status labels
 */
export async function POST(request) {
  try {
    await ensureFalseReportsSchema();
    const effectiveExpiresAtSql = getEffectiveReportExpiresAtSql("lr");

    const {
      latitude,
      longitude,
      radiusMeters = 2000,
      limit = 100,
      search = "",
      zoneTypeFilter = "",
    } = await request.json();
    const { user } = await getAuthenticatedUser(request);

    if (latitude == null || longitude == null) {
      return Response.json(
        { success: false, error: "Location required" },
        { status: 400 },
      );
    }

    let baseQuery = `
      SELECT 
        lr.id as report_id,
        lr.user_id,
        lr.status as spot_status,
        lr.parking_type,
        lr.quantity,
        lr.created_at,
        ${effectiveExpiresAtSql} AS expires_at,
        lr.claimed_at,
        ST_X(lr.location::geometry) as longitude,
        ST_Y(lr.location::geometry) as latitude,
        pz.zone_type,
        pz.name as zone_name,
        pz.rules_description,
        ST_Distance(
          lr.location::geography,
          ST_SetSRID(ST_Point($1, $2), 4326)::geography
        ) as distance_meters,
        CASE 
          WHEN lr.status = 'claimed' THEN 'Claimed'
          WHEN ${effectiveExpiresAtSql} < CURRENT_TIMESTAMP THEN 'Expired'
          WHEN EXISTS (
            SELECT 1 FROM false_reports fr 
            WHERE fr.report_id = lr.id 
            AND fr.reported_by = $3
          ) THEN 'Reported False'
          WHEN lr.status = 'available' THEN 'Available'
          ELSE lr.status
        END as display_status
      FROM live_reports lr
      LEFT JOIN parking_zones pz ON lr.zone_id = pz.id
      WHERE ST_DWithin(
        lr.location::geography,
        ST_SetSRID(ST_Point($1, $2), 4326)::geography,
        $4
      )
        AND LOWER(COALESCE(pz.zone_type, lr.parking_type, '')) NOT LIKE '%' || $5 || '%'
    `;

    const params = [longitude, latitude, user?.id || null, radiusMeters, EXCLUDED_ZONE_TYPE];
    let paramIndex = 6;

    if (search) {
      baseQuery += ` AND (
        LOWER(pz.name) LIKE LOWER($${paramIndex}) 
        OR LOWER(lr.parking_type) LIKE LOWER($${paramIndex})
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (zoneTypeFilter) {
      baseQuery += ` AND (pz.zone_type = $${paramIndex} OR lr.parking_type = $${paramIndex})`;
      params.push(zoneTypeFilter);
      paramIndex++;
    }

    baseQuery += ` ORDER BY lr.created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const spots = await sql(baseQuery, params);

    const notifications = spots.map((spot) => {
      const normalizedSpot = applyEffectiveReportExpiry(spot);
      const parkingInfo = spot.parking_type
        ? `${spot.quantity > 1 ? `${spot.quantity}x ` : ""}${spot.parking_type}`
        : "Parking";

      let message = `${parkingInfo} spot${spot.quantity > 1 ? "s" : ""}`;

      if (spot.display_status === "Available") {
        message += ` available ${Math.round(spot.distance_meters)}m away`;
      } else if (spot.display_status === "Claimed") {
        message += ` was claimed`;
      } else if (spot.display_status === "Expired") {
        message += ` has expired`;
      } else if (spot.display_status === "Reported False") {
        message += ` marked as false`;
      }

      if (spot.zone_name) {
        message += ` in ${spot.zone_name}`;
      }

      return {
        id: spot.report_id,
        user_id: spot.user_id,
        report_id: spot.report_id,
        message,
        sent_at: spot.created_at,
        spot_status: spot.spot_status,
        display_status: spot.display_status,
        longitude: spot.longitude,
        latitude: spot.latitude,
        zone_type: spot.zone_type || spot.parking_type,
        zone_name: spot.zone_name,
        distance_meters: spot.distance_meters,
        parking_type: spot.parking_type,
        quantity: spot.quantity,
        expires_at: normalizedSpot.expires_at,
      };
    });

    return Response.json({
      success: true,
      notifications,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
