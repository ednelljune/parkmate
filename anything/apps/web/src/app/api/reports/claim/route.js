import sql from '@/app/api/utils/sql';
import { requireAuthenticatedUser } from '@/app/api/utils/supabase-auth';
import { logUserActivity } from '@/app/api/utils/activity-log';
import { getEffectiveReportExpiresAtSql } from '@/app/api/utils/report-ttl';

const CLAIM_SPOT_MIN_DISTANCE_METERS = 35;
const CLAIM_SPOT_MAX_DISTANCE_METERS = 75;

const isExpoPushToken = (value) =>
  typeof value === 'string' &&
  (value.startsWith('ExpoPushToken[') || value.startsWith('ExponentPushToken['));

const normalizeCoordinate = (value) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeAccuracyMeters = (value) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const getClaimDistanceThresholdMeters = (accuracyMeters) => {
  const normalizedAccuracyMeters = normalizeAccuracyMeters(accuracyMeters);
  if (normalizedAccuracyMeters === null) {
    return CLAIM_SPOT_MIN_DISTANCE_METERS;
  }

  return Math.min(
    Math.max(CLAIM_SPOT_MIN_DISTANCE_METERS, normalizedAccuracyMeters),
    CLAIM_SPOT_MAX_DISTANCE_METERS,
  );
};

const dispatchReporterClaimNotification = async ({
  request,
  reporterUserId,
  claimantUserId,
  reportId,
  claimedQuantity,
  parkingType,
  zoneName,
  longitude,
  latitude,
}) => {
  if (!reporterUserId) {
    return { sent: 0, tokenCount: 0 };
  }

  const quantity = Math.max(1, Number(claimedQuantity) || 1);
  const parkingLabel = parkingType || 'Parking';
  const quantityLabel =
    quantity > 1 ? `${quantity} ${parkingLabel} spots` : `${parkingLabel} spot`;
  const resolvedZoneName = zoneName || 'Reported spot';
  const title = 'Your reported spot was claimed';
  const body = `${quantityLabel} in ${resolvedZoneName} was claimed. You earned +10 contribution points.`;

  await sql`
    INSERT INTO notification_logs (user_id, report_id, message)
    VALUES (${reporterUserId}, ${reportId}, ${body})
  `;

  const tokenRows = await sql`
    SELECT expo_push_token
    FROM push_tokens
    WHERE user_id = ${reporterUserId}
  `;
  const tokens = [
    ...new Set(tokenRows.map((row) => row.expo_push_token).filter(isExpoPushToken)),
  ];

  if (tokens.length === 0) {
    console.log('[report.claim] Reporter system push skipped: no push tokens', {
      reportId,
      reporterUserId,
      claimantUserId,
    });
    return { sent: 0, tokenCount: 0 };
  }

  const pushUrl = new URL('/api/notifications/send-push', request.url).toString();
  const pushResponse = await fetch(pushUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tokens,
      title,
      body,
      data: {
        type: 'report_claimed',
        screen: 'activity',
        reportId,
        claimantUserId,
        reporterUserId,
        parking_type: parkingType,
        quantity,
        zone_name: resolvedZoneName,
        longitude,
        latitude,
      },
      channelId: 'alerts',
    }),
  });

  const pushResult = await pushResponse.json().catch(() => ({}));

  if (!pushResponse.ok || pushResult?.success === false) {
    throw new Error(pushResult?.error || 'Failed to send reporter claim push');
  }

  console.log('[report.claim] Reporter system push sent', {
    reportId,
    reporterUserId,
    claimantUserId,
    tokenCount: tokens.length,
    sent: pushResult.sent || 0,
    errors: pushResult.errors || 0,
  });

  return { sent: pushResult.sent || 0, tokenCount: tokens.length };
};

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth.response) {
      return auth.response;
    }

    const { reportId, latitude, longitude, accuracy } = await request.json();
    const userId = auth.user.id;
    const normalizedReportId = Number(reportId);
    const normalizedLatitude = normalizeCoordinate(latitude);
    const normalizedLongitude = normalizeCoordinate(longitude);
    const normalizedAccuracyMeters = normalizeAccuracyMeters(accuracy);
    const claimDistanceThresholdMeters = getClaimDistanceThresholdMeters(
      normalizedAccuracyMeters,
    );

    if (!Number.isInteger(normalizedReportId) || normalizedReportId <= 0) {
      return Response.json(
        { success: false, message: 'reportId is required.' },
        { status: 400 }
      );
    }

    if (normalizedLatitude === null || normalizedLongitude === null) {
      return Response.json(
        {
          success: false,
          message:
            'Your current location is required to confirm you are close enough to the reported spot.',
        },
        { status: 400 }
      );
    }

    const results = await sql.transaction(async (txn) => {
      await txn`
        SELECT pg_advisory_xact_lock(${normalizedReportId}::bigint)
      `;

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
      `,
        [normalizedLongitude, normalizedLatitude, normalizedReportId],
      );

      if (availableReports.length === 0) {
        return { availableReports, claimedReports: [] };
      }

      const targetReport = availableReports[0];
      const reportLongitude = Number(targetReport?.longitude);
      const reportLatitude = Number(targetReport?.latitude);
      const distanceMeters = Number(availableReports[0]?.distance_meters);
      const currentZoneRows = await txn`
        SELECT
          id,
          name,
          zone_type
        FROM parking_zones
        WHERE boundary IS NOT NULL
          AND ST_Covers(
          boundary::geometry,
          ST_SetSRID(
            ST_Point(${normalizedLongitude}, ${normalizedLatitude}),
            4326
          )::geometry
        )
        LIMIT 1
      `;
      const currentZone = currentZoneRows[0] || null;

      let reportZone = null;
      if (targetReport?.zone_id != null) {
        const reportZoneRows = await txn`
          SELECT
            id,
            name,
            zone_type
          FROM parking_zones
          WHERE id = ${targetReport.zone_id}
            AND boundary IS NOT NULL
          LIMIT 1
        `;
        reportZone = reportZoneRows[0] || null;
      } else if (
        Number.isFinite(reportLongitude) &&
        Number.isFinite(reportLatitude)
      ) {
        const inferredReportZoneRows = await txn`
          SELECT
            id,
            name,
            zone_type
          FROM parking_zones
          WHERE boundary IS NOT NULL
            AND ST_Covers(
            boundary::geometry,
            ST_SetSRID(
              ST_Point(${reportLongitude}, ${reportLatitude}),
              4326
            )::geometry
          )
          LIMIT 1
        `;
        reportZone = inferredReportZoneRows[0] || null;
      }

      const hasZoneMatch =
        !!reportZone &&
        !!currentZone &&
        String(currentZone.id) === String(reportZone.id);
      const hasDistanceMatch =
        Number.isFinite(distanceMeters) &&
        distanceMeters <= claimDistanceThresholdMeters;
      const canClaimZoneLinkedReport =
        !!targetReport?.zone_id && hasZoneMatch;
      const canClaimLegacyReport =
        !targetReport?.zone_id && hasDistanceMatch;

      if (!canClaimZoneLinkedReport && !canClaimLegacyReport) {
        const accuracyClause = normalizedAccuracyMeters
          ? ` Your GPS accuracy is about ${Math.round(normalizedAccuracyMeters)}m.`
          : "";
        const actualDistanceClause = Number.isFinite(distanceMeters)
          ? ` You are about ${Math.round(distanceMeters)}m away.`
          : "";
        const zoneClause = reportZone
          ? " This report is linked to a parking zone, but your current location did not resolve to the same zone."
          : "";
        const error = new Error(
          `Move closer to the reported spot coordinates before claiming it. You must be within ${Math.round(claimDistanceThresholdMeters)}m.${zoneClause}${actualDistanceClause}${accuracyClause}`,
        );
        error.status = 403;
        console.warn('[report.claim] Claim rejected', {
          reportId,
          userId,
          distanceMeters: Number.isFinite(distanceMeters)
            ? Math.round(distanceMeters)
            : null,
          claimDistanceThresholdMeters: Math.round(claimDistanceThresholdMeters),
          normalizedAccuracyMeters: normalizedAccuracyMeters
            ? Math.round(normalizedAccuracyMeters)
            : null,
          reportZoneId: reportZone?.id || null,
          currentZoneId: currentZone?.id || null,
          targetReportZoneId: targetReport?.zone_id || null,
        });
        throw error;
      }
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
              WHERE id = ${normalizedReportId}
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
              WHERE id = ${normalizedReportId}
                AND status = 'available'
              RETURNING *
            `;

      await txn`
        UPDATE users
        SET contribution_score = contribution_score + 10
        WHERE id = (SELECT user_id FROM live_reports WHERE id = ${normalizedReportId})
          AND EXISTS (
            SELECT 1
            FROM live_reports
            WHERE id = ${normalizedReportId}
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
        mailboxEventKey: `report-${reportId}-claim-remaining-${Math.max(0, remainingQuantity)}`,
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
    const activityOccurredAt = new Date().toISOString();

    if (claimedSource) {
      console.log('[report.claim] Claim succeeded', {
        reportId,
        claimantUserId: userId,
        reporterUserId: claimedSource.user_id || null,
        claimedQuantity: results.claimedQuantity,
        remainingQuantity: results.remainingQuantity,
        wasExhausted: results.wasExhausted,
        mailboxEventKey: results.mailboxEventKey,
      });

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
        occurredAt: activityOccurredAt,
      });

      if (claimedSource.user_id) {
        await logUserActivity({
          userId: claimedSource.user_id,
          reportId,
          activityType: 'report_claimed',
          parkingType: claimedSource.parking_type,
          quantity: results.claimedQuantity,
          longitude: claimedSource.longitude,
          latitude: claimedSource.latitude,
          zoneType: activityZone?.zone_type || claimedSource.parking_type,
          zoneName: activityZone?.name || 'Reported spot',
          spotStatus: results.wasExhausted ? 'claimed' : 'available',
          occurredAt: activityOccurredAt,
          eventKey: results.mailboxEventKey,
        });

        console.log('[report.claim] Reporter system update stored', {
          reportId,
          reporterUserId: claimedSource.user_id,
          claimantUserId: userId,
          mailboxEventKey: results.mailboxEventKey,
          occurredAt: activityOccurredAt,
        });

        try {
          await dispatchReporterClaimNotification({
            request,
            reporterUserId: claimedSource.user_id,
            claimantUserId: userId,
            reportId,
            claimedQuantity: results.claimedQuantity,
            parkingType: claimedSource.parking_type,
            zoneName: activityZone?.name || 'Reported spot',
            longitude: claimedSource.longitude,
            latitude: claimedSource.latitude,
          });
        } catch (notificationError) {
          console.error('[report.claim] Reporter system push failed', {
            reportId,
            reporterUserId: claimedSource.user_id,
            claimantUserId: userId,
            message: notificationError?.message || String(notificationError),
          });
        }
      }
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
