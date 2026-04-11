import sql from '@/app/api/utils/sql';
import { requireAuthenticatedUser } from '@/app/api/utils/supabase-auth';
import { logUserActivity } from '@/app/api/utils/activity-log';
import { ensureFalseReportsSchema } from '@/app/api/utils/false-reports';

const FALSE_REPORT_TRUST_THRESHOLD = 3;
const isExpoPushToken = (value) =>
  typeof value === 'string' &&
  (value.startsWith('ExpoPushToken[') || value.startsWith('ExponentPushToken['));

const dispatchReporterFalseReportNotification = async ({
  request,
  reporterUserId,
  reportId,
  parkingType,
  quantity,
  zoneName,
  longitude,
  latitude,
  falseReportCount,
  trustScoreThreshold,
  trustScoreAffected,
}) => {
  if (!reporterUserId) {
    return { sent: 0, tokenCount: 0 };
  }

  const resolvedQuantity = Math.max(1, Number(quantity) || 1);
  const parkingLabel = parkingType || 'Parking';
  const quantityLabel =
    resolvedQuantity > 1 ? `${resolvedQuantity} ${parkingLabel} spots` : `${parkingLabel} spot`;
  const resolvedZoneName = zoneName || 'Reported spot';
  const resolvedFalseReportCount = Math.max(1, Number(falseReportCount) || 1);
  const resolvedThreshold = Math.max(1, Number(trustScoreThreshold) || FALSE_REPORT_TRUST_THRESHOLD);
  const title = 'Your reported spot was flagged';
  const body = trustScoreAffected
    ? `${quantityLabel} in ${resolvedZoneName} was flagged as false by ${resolvedFalseReportCount} drivers. Trust score impact has been applied.`
    : `${quantityLabel} in ${resolvedZoneName} was flagged as false by ${resolvedFalseReportCount} drivers.`;

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
    console.log('[report.false] Reporter system push skipped: no push tokens', {
      reportId,
      reporterUserId,
      falseReportCount: resolvedFalseReportCount,
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
        type: 'false_reported',
        screen: 'activity',
        reportId,
        reporterUserId,
        falseReportCount: resolvedFalseReportCount,
        trustScoreThreshold: resolvedThreshold,
        trustScoreAffected: Boolean(trustScoreAffected),
        parking_type: parkingType,
        quantity: resolvedQuantity,
        zone_name: resolvedZoneName,
        longitude,
        latitude,
      },
      channelId: 'alerts',
    }),
  });

  const pushResult = await pushResponse.json().catch(() => ({}));

  if (!pushResponse.ok || pushResult?.success === false) {
    throw new Error(pushResult?.error || 'Failed to send reporter false-report push');
  }

  console.log('[report.false] Reporter system push sent', {
    reportId,
    reporterUserId,
    falseReportCount: resolvedFalseReportCount,
    tokenCount: tokens.length,
    sent: pushResult.sent || 0,
    errors: pushResult.errors || 0,
  });

  return { sent: pushResult.sent || 0, tokenCount: tokens.length };
};

export async function POST(request) {
  try {
    await ensureFalseReportsSchema();

    const auth = await requireAuthenticatedUser(request);
    if (auth.response) {
      return auth.response;
    }

    const { reportId } = await request.json();
    const userId = auth.user.id;

    if (!reportId) {
      return Response.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    const reportResults = await sql`
      SELECT
        live_reports.user_id,
        live_reports.zone_id,
        live_reports.parking_type,
        live_reports.quantity,
        live_reports.status,
        ST_X(live_reports.location::geometry) AS longitude,
        ST_Y(live_reports.location::geometry) AS latitude,
        pz.zone_type,
        pz.name AS zone_name
      FROM live_reports
      LEFT JOIN parking_zones pz ON pz.id = live_reports.zone_id
      WHERE live_reports.id = ${reportId}
      LIMIT 1;
    `;

    if (reportResults.length === 0) {
      return Response.json(
        { success: false, message: 'Report not found' },
        { status: 404 }
      );
    }

    const report = reportResults[0];
    const originalReporterId = report.user_id;

    if (originalReporterId === userId) {
      return Response.json(
        {
          success: false,
          message: 'You cannot report your own parking spots',
        },
        { status: 400 }
      );
    }

    const existingReport = await sql`
      SELECT id
      FROM false_reports
      WHERE report_id = ${reportId} AND reported_by = ${userId}
      LIMIT 1;
    `;

    if (existingReport.length > 0) {
      return Response.json(
        {
          success: false,
          message: 'You have already reported this spot as false',
        },
        { status: 400 }
      );
    }

    let isOutsideZone = false;
    if (!report.zone_id) {
      isOutsideZone = true;
    } else {
      const zoneCheck = await sql`
        SELECT id
        FROM parking_zones
        WHERE id = ${report.zone_id}
          AND ST_Contains(
            boundary,
            ST_SetSRID(ST_Point(${report.longitude}, ${report.latitude}), 4326)
          )
        LIMIT 1;
      `;

      if (zoneCheck.length === 0) {
        isOutsideZone = true;
      }
    }

    await sql`
      INSERT INTO false_reports (report_id, reported_by)
      VALUES (${reportId}, ${userId})
    `;

    const falseReportCountResult = await sql`
      SELECT COUNT(*)::int AS total
      FROM false_reports
      WHERE report_id = ${reportId};
    `;

    const falseReportCount = Number(falseReportCountResult[0]?.total || 0);
    const shouldAffectTrustScore =
      falseReportCount === FALSE_REPORT_TRUST_THRESHOLD;
    const activityOccurredAt = new Date().toISOString();

    await logUserActivity({
      userId,
      reportId,
      activityType: 'false_reported',
      parkingType: report.parking_type,
      quantity: report.quantity,
      longitude: report.longitude,
      latitude: report.latitude,
      zoneType: report.zone_type,
      zoneName: report.zone_name,
      spotStatus: report.status,
      occurredAt: activityOccurredAt,
    });

    let trustScorePenalty = 0;
    let newTrustScore = null;
    let spotRemoved = false;

    if (shouldAffectTrustScore) {
      trustScorePenalty = isOutsideZone ? -10 : -5;

      await sql`
        UPDATE users
        SET trust_score = GREATEST(0, trust_score + ${trustScorePenalty})
        WHERE id = ${originalReporterId};
      `;

      const updatedUser = await sql`
        SELECT trust_score
        FROM users
        WHERE id = ${originalReporterId}
        LIMIT 1;
      `;

      newTrustScore = updatedUser[0]?.trust_score ?? 0;

      if (isOutsideZone || newTrustScore < 50) {
        await sql`
          UPDATE live_reports
          SET status = 'claimed'
          WHERE id = ${reportId};
        `;
        spotRemoved = true;
      }
    } else if (isOutsideZone) {
      await sql`
        UPDATE live_reports
        SET status = 'claimed'
        WHERE id = ${reportId};
      `;
      spotRemoved = true;
    }

    if (originalReporterId) {
      await logUserActivity({
        userId: originalReporterId,
        reportId,
        activityType: 'false_reported',
        parkingType: report.parking_type,
        quantity: report.quantity,
        longitude: report.longitude,
        latitude: report.latitude,
        zoneType: report.zone_type,
        zoneName: report.zone_name,
        spotStatus: spotRemoved ? 'claimed' : report.status,
        occurredAt: activityOccurredAt,
        eventKey: `report-${reportId}-false-count-${falseReportCount}`,
      });

      try {
        await dispatchReporterFalseReportNotification({
          request,
          reporterUserId: originalReporterId,
          reportId,
          parkingType: report.parking_type,
          quantity: report.quantity,
          zoneName: report.zone_name,
          longitude: report.longitude,
          latitude: report.latitude,
          falseReportCount,
          trustScoreThreshold: FALSE_REPORT_TRUST_THRESHOLD,
          trustScoreAffected: shouldAffectTrustScore,
        });
      } catch (notificationError) {
        console.error('[report.false] Reporter system push failed', {
          reportId,
          reporterUserId: originalReporterId,
          falseReportCount,
          message: notificationError?.message || String(notificationError),
        });
      }
    }

    return Response.json({
      success: true,
      message: shouldAffectTrustScore
        ? 'False report submitted successfully and the trust score was updated'
        : 'False report submitted successfully',
      falseReportCount,
      trustScoreThreshold: FALSE_REPORT_TRUST_THRESHOLD,
      trustScoreAffected: shouldAffectTrustScore,
      trustScorePenalty: Math.abs(trustScorePenalty),
      newTrustScore,
      spotRemoved,
    });
  } catch (error) {
    console.error('Error reporting false spot:', error);
    return Response.json(
      { success: false, message: error.message || 'Failed to report false spot' },
      { status: 500 }
    );
  }
}
