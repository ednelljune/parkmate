import sql from '@/app/api/utils/sql';
import { requireAuthenticatedUser } from '@/app/api/utils/supabase-auth';
import { logUserActivity } from '@/app/api/utils/activity-log';
import { getEffectiveReportExpiresAtSql } from '@/app/api/utils/report-ttl';

const CLAIM_SPOT_MAX_DISTANCE_METERS = 75;

const normalizeCoordinate = (value) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth.response) {
      return auth.response;
    }

    const { reportId, latitude, longitude } = await request.json();
    const userId = auth.user.id;
    const normalizedLatitude = normalizeCoordinate(latitude);
    const normalizedLongitude = normalizeCoordinate(longitude);

    if (!reportId) {
      return Response.json(
        { success: false, message: 'reportId is required.' },
        { status: 400 }
      );
    }

    if (normalizedLatitude === null || normalizedLongitude === null) {
      return Response.json(
        {
          success: false,
          message: 'Your current location is required to claim a parking spot.',
        },
        { status: 400 }
      );
    }

    const results = await sql.transaction(async (txn) => {
      const effectiveExpiresAtSql = getEffectiveReportExpiresAtSql('lr');
      const availableReports = await txn(
        `
        SELECT
          lr.id,
          lr.user_id,
          lr.status,
          ${effectiveExpiresAtSql} AS expires_at,
          lr.quantity,
          lr.zone_id,
          lr.parking_type,
          ST_X(lr.location::geometry) AS longitude,
          ST_Y(lr.location::geometry) AS latitude,
          ST_Distance(
              lr.location::geography,
              ST_SetSRID(
                ST_Point($1, $2),
                4326
              )::geography
            ) AS distance_meters
        FROM live_reports lr
        WHERE lr.id = $3
          AND lr.status = 'available'
          AND ${effectiveExpiresAtSql} > CURRENT_TIMESTAMP
        FOR UPDATE
      `,
        [normalizedLongitude, normalizedLatitude, reportId],
      );

      if (availableReports.length === 0) {
        return { availableReports, claimedReports: [] };
      }

      const distanceMeters = Number(availableReports[0]?.distance_meters);
      if (
        !Number.isFinite(distanceMeters) ||
        distanceMeters > CLAIM_SPOT_MAX_DISTANCE_METERS
      ) {
        const roundedDistance = Number.isFinite(distanceMeters)
          ? Math.round(distanceMeters)
          : null;
        const actualDistanceClause =
          roundedDistance == null ? '' : ` You are about ${roundedDistance}m away.`;
        const error = new Error(
          `Move closer to the reported spot before claiming it. You must be within ${CLAIM_SPOT_MAX_DISTANCE_METERS}m.${actualDistanceClause}`
        );
        error.status = 403;
        throw error;
      }

      const targetReport = availableReports[0];
      const existingQuantity = Math.max(
        1,
        Number.isFinite(Number(targetReport?.quantity))
          ? Math.floor(Number(targetReport.quantity))
          : 1,
      );
      const remainingQuantity = existingQuantity - 1;

      const claimedReports =
        remainingQuantity > 0
          ? await txn`
              UPDATE live_reports
              SET quantity = ${remainingQuantity}
              WHERE id = ${reportId}
                AND status = 'available'
              RETURNING *
            `
          : await txn`
              UPDATE live_reports
              SET
                quantity = 1,
                status = 'claimed',
                claimed_by = ${userId},
                claimed_at = CURRENT_TIMESTAMP
              WHERE id = ${reportId}
                AND status = 'available'
              RETURNING *
            `;

      await txn`
        UPDATE users
        SET contribution_score = contribution_score + 10
        WHERE id = (SELECT user_id FROM live_reports WHERE id = ${reportId})
          AND EXISTS (
            SELECT 1
            FROM live_reports
            WHERE id = ${reportId}
              AND user_id IS NOT NULL
          )
      `;

      await txn`
        UPDATE users
        SET contribution_score = contribution_score + 2
        WHERE id = ${userId}
      `;

      return {
        availableReports,
        claimedReports,
        claimedQuantity: 1,
        remainingQuantity,
        wasExhausted: remainingQuantity <= 0,
      };
    });

    if (results.availableReports.length === 0) {
      return Response.json(
        {
          success: false,
          message: 'This spot is no longer available or has already been claimed.',
        },
        { status: 400 }
      );
    }

    if (results.claimedReports.length === 0) {
      return Response.json(
        {
          success: false,
          message: 'Failed to claim spot. It may have been claimed by someone else.',
        },
        { status: 400 }
      );
    }

    const claimedSource = results.availableReports[0];
    const activityRows = await sql`
      SELECT id, name, zone_type
      FROM parking_zones
      WHERE id = ${claimedSource?.zone_id || null}
      LIMIT 1
    `;
    const activityZone = activityRows[0] || null;

    if (claimedSource) {
      await logUserActivity({
        userId,
        reportId,
        activityType: 'claimed',
        parkingType: claimedSource.parking_type,
        quantity: results.claimedQuantity,
        longitude: claimedSource.longitude,
        latitude: claimedSource.latitude,
        zoneType: activityZone?.zone_type || claimedSource.parking_type,
        zoneName: activityZone?.name || 'Reported spot',
        spotStatus: results.wasExhausted ? 'claimed' : 'available',
        occurredAt: new Date().toISOString(),
      });
    }

    return Response.json({
      success: true,
      report: results.claimedReports[0],
      claimedQuantity: results.claimedQuantity,
      remainingQuantity: Math.max(0, results.remainingQuantity),
      wasExhausted: results.wasExhausted,
    });
  } catch (error) {
    console.error('Error claiming spot:', error);
    return Response.json(
      {
        success: false,
        message: error.message || 'Failed to claim spot',
      },
      { status: error.status || 500 }
    );
  }
}
