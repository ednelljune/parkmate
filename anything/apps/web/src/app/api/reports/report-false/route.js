import sql from '@/app/api/utils/sql';
import { requireAuthenticatedUser } from '@/app/api/utils/supabase-auth';
import { logUserActivity } from '@/app/api/utils/activity-log';
import { ensureFalseReportsSchema } from '@/app/api/utils/false-reports';

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
    });

    const trustScorePenalty = isOutsideZone ? -10 : -5;

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

    if (isOutsideZone || (updatedUser[0] && updatedUser[0].trust_score < 50)) {
      await sql`
        UPDATE live_reports
        SET status = 'claimed'
        WHERE id = ${reportId};
      `;
    }

    return Response.json({
      success: true,
      message: 'False report submitted successfully',
      trustScorePenalty: Math.abs(trustScorePenalty),
      newTrustScore: updatedUser[0]?.trust_score || 0,
      spotRemoved: isOutsideZone,
    });
  } catch (error) {
    console.error('Error reporting false spot:', error);
    return Response.json(
      { success: false, message: error.message || 'Failed to report false spot' },
      { status: 500 }
    );
  }
}
