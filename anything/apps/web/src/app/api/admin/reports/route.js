import sql from '@/app/api/utils/sql';
import { requireAdminUser } from '@/app/api/utils/admin-auth';
import { getEffectiveReportExpiresAtSql } from '@/app/api/utils/report-ttl';

function normalizeInt(value, fallback, { min = 1, max = 100 } = {}) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function normalizeSearch(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, 80);
}

function addParam(params, value) {
  params.push(value);
  return `$${params.length}`;
}

export async function GET(request) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.response) {
      return auth.response;
    }

    const { searchParams } = new URL(request.url);
    const search = normalizeSearch(searchParams.get('search'));
    const status = normalizeSearch(searchParams.get('status')).toLowerCase() || 'all';
    const limit = normalizeInt(searchParams.get('limit'), 50);
    const page = normalizeInt(searchParams.get('page'), 1, { min: 1, max: 10000 });
    const offset = (page - 1) * limit;
    const effectiveExpiresAtSql = getEffectiveReportExpiresAtSql('lr');
    const effectiveStatusSql = `
      CASE
        WHEN lr.status = 'claimed' THEN 'claimed'
        WHEN ${effectiveExpiresAtSql} <= CURRENT_TIMESTAMP THEN 'expired'
        ELSE 'available'
      END
    `;

    const whereParams = [];
    const whereClauses = [];

    if (search) {
      const searchPattern = `%${search}%`;
      const zoneRef = addParam(whereParams, searchPattern);
      const nameRef = addParam(whereParams, searchPattern);
      const emailRef = addParam(whereParams, searchPattern);
      const typeRef = addParam(whereParams, searchPattern);
      whereClauses.push(`(
        LOWER(COALESCE(pz.name, '')) LIKE LOWER(${zoneRef})
        OR LOWER(COALESCE(reporter.full_name, '')) LIKE LOWER(${nameRef})
        OR LOWER(COALESCE(reporter.email, '')) LIKE LOWER(${emailRef})
        OR LOWER(COALESCE(lr.parking_type, '')) LIKE LOWER(${typeRef})
      )`);
    }

    if (status && status !== 'all') {
      const statusRef = addParam(whereParams, status);
      whereClauses.push(`${effectiveStatusSql} = ${statusRef}`);
    }

    const whereSql = whereClauses.length > 0 ? whereClauses.join(' AND ') : 'TRUE';
    const listParams = [...whereParams, limit, offset];

    const [reports, totalRows, summaryRows] = await Promise.all([
      sql(
        `
          WITH false_report_counts AS (
            SELECT report_id, COUNT(*)::int AS false_flag_count
            FROM false_reports
            GROUP BY report_id
          )
          SELECT
            lr.id,
            lr.status,
            ${effectiveStatusSql} AS effective_status,
            lr.parking_type,
            lr.quantity,
            lr.created_at,
            ${effectiveExpiresAtSql} AS expires_at,
            ST_X(lr.location::geometry) AS longitude,
            ST_Y(lr.location::geometry) AS latitude,
            reporter.id AS reporter_id,
            reporter.full_name AS reporter_name,
            reporter.email AS reporter_email,
            claimant.full_name AS claimant_name,
            claimant.email AS claimant_email,
            pz.id AS zone_id,
            pz.name AS zone_name,
            pz.zone_type,
            COALESCE(frc.false_flag_count, 0) AS false_flag_count
          FROM live_reports lr
          LEFT JOIN users reporter ON reporter.id = lr.user_id
          LEFT JOIN users claimant ON claimant.id = lr.claimed_by
          LEFT JOIN parking_zones pz ON pz.id = lr.zone_id
          LEFT JOIN false_report_counts frc ON frc.report_id = lr.id
          WHERE ${whereSql}
          ORDER BY lr.created_at DESC
          LIMIT $${listParams.length - 1}
          OFFSET $${listParams.length};
        `,
        listParams,
      ),
      sql(
        `
          SELECT COUNT(*)::int AS total
          FROM live_reports lr
          LEFT JOIN users reporter ON reporter.id = lr.user_id
          LEFT JOIN parking_zones pz ON pz.id = lr.zone_id
          WHERE ${whereSql};
        `,
        whereParams,
      ),
      sql(`
        SELECT
          COUNT(*)::int AS total_reports,
          COUNT(*) FILTER (WHERE lr.status = 'claimed')::int AS claimed_reports,
          COUNT(*) FILTER (WHERE lr.status != 'claimed' AND ${effectiveExpiresAtSql} > CURRENT_TIMESTAMP)::int AS available_reports,
          COUNT(*) FILTER (WHERE lr.status != 'claimed' AND ${effectiveExpiresAtSql} <= CURRENT_TIMESTAMP)::int AS expired_reports,
          COALESCE(SUM(quantity), 0)::int AS total_quantity
        FROM live_reports lr;
      `),
    ]);

    return Response.json({
      success: true,
      reports,
      summary: summaryRows[0] || null,
      pagination: {
        page,
        limit,
        total: totalRows[0]?.total ?? 0,
      },
    });
  } catch (error) {
    console.error('Error loading admin reports:', error);
    return Response.json(
      { success: false, error: error.message || 'Failed to load reports' },
      { status: 500 },
    );
  }
}
