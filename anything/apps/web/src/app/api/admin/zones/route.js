import sql from '@/app/api/utils/sql';
import { requireAdminUser } from '@/app/api/utils/admin-auth';

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
    const zoneType = normalizeSearch(searchParams.get('zoneType'));
    const limit = normalizeInt(searchParams.get('limit'), 100, { max: 250 });
    const page = normalizeInt(searchParams.get('page'), 1, { min: 1, max: 10000 });
    const offset = (page - 1) * limit;

    const whereParams = [];
    const whereClauses = [];

    if (search) {
      const searchPattern = `%${search}%`;
      const nameRef = addParam(whereParams, searchPattern);
      const typeRef = addParam(whereParams, searchPattern);
      whereClauses.push(`(LOWER(COALESCE(name, '')) LIKE LOWER(${nameRef}) OR LOWER(COALESCE(zone_type, '')) LIKE LOWER(${typeRef}))`);
    }

    if (zoneType && zoneType.toLowerCase() !== 'all') {
      const zoneTypeRef = addParam(whereParams, zoneType);
      whereClauses.push(`LOWER(COALESCE(zone_type, '')) = LOWER(${zoneTypeRef})`);
    }

    const whereSql = whereClauses.length > 0 ? whereClauses.join(' AND ') : 'TRUE';
    const listParams = [...whereParams, limit, offset];

    const [zones, totalRows, summaryRows, typeRows] = await Promise.all([
      sql(
        `
          SELECT
            id,
            name,
            zone_type,
            capacity_spaces,
            rules_description,
            created_at,
            ST_Y(ST_Centroid(boundary::geometry)) AS center_lat,
            ST_X(ST_Centroid(boundary::geometry)) AS center_lng
          FROM parking_zones
          WHERE ${whereSql}
          ORDER BY created_at DESC, id DESC
          LIMIT $${listParams.length - 1}
          OFFSET $${listParams.length};
        `,
        listParams,
      ),
      sql(
        `
          SELECT COUNT(*)::int AS total
          FROM parking_zones
          WHERE ${whereSql};
        `,
        whereParams,
      ),
      sql`
        SELECT
          COUNT(*)::int AS total_zones,
          COUNT(DISTINCT zone_type)::int AS zone_types_count,
          COALESCE(SUM(capacity_spaces), 0)::int AS total_capacity
        FROM parking_zones;
      `,
      sql`
        SELECT zone_type, COUNT(*)::int AS count
        FROM parking_zones
        GROUP BY zone_type
        ORDER BY count DESC, zone_type ASC;
      `,
    ]);

    return Response.json({
      success: true,
      zones,
      summary: summaryRows[0] || null,
      zoneTypes: typeRows,
      pagination: {
        page,
        limit,
        total: totalRows[0]?.total ?? 0,
      },
    });
  } catch (error) {
    console.error('Error loading admin zones:', error);
    return Response.json(
      { success: false, error: error.message || 'Failed to load zones' },
      { status: 500 },
    );
  }
}
