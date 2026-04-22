import sql from '@/app/api/utils/sql';
import { requireAdminUser } from '@/app/api/utils/admin-auth';
import { ensureActivityLogSchema } from '@/app/api/utils/activity-log';
import { ensureUsersSchema } from '@/app/api/utils/users-schema';

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

    await ensureUsersSchema();
    await ensureActivityLogSchema();

    const { searchParams } = new URL(request.url);
    const search = normalizeSearch(searchParams.get('search'));
    const limit = normalizeInt(searchParams.get('limit'), 50);
    const page = normalizeInt(searchParams.get('page'), 1, { min: 1, max: 10000 });
    const offset = (page - 1) * limit;

    const whereParams = [];
    const whereClauses = [];

    if (search) {
      const searchPattern = `%${search}%`;
      const nameRef = addParam(whereParams, searchPattern);
      const emailRef = addParam(whereParams, searchPattern);
      whereClauses.push(`(LOWER(COALESCE(u.full_name, '')) LIKE LOWER(${nameRef}) OR LOWER(COALESCE(u.email, '')) LIKE LOWER(${emailRef}))`);
    }

    const whereSql = whereClauses.length > 0 ? whereClauses.join(' AND ') : 'TRUE';
    const listParams = [...whereParams, limit, offset];
    const totalParams = [...whereParams];

    const [users, totalRows, summaryRows] = await Promise.all([
      sql(
        `
          WITH report_counts AS (
            SELECT user_id, COUNT(*)::int AS total_reports, MAX(created_at) AS last_report_at
            FROM live_reports
            GROUP BY user_id
          ),
          suggestion_counts AS (
            SELECT user_id, COUNT(*)::int AS total_suggestions, MAX(created_at) AS last_suggestion_at
            FROM suggested_parking_zones
            GROUP BY user_id
          ),
          claim_counts AS (
            SELECT user_id, COUNT(*)::int AS total_claims, MAX(occurred_at) AS last_claim_at
            FROM user_activity_logs
            WHERE activity_type = 'claimed'
            GROUP BY user_id
          )
          SELECT
            u.id,
            u.email,
            u.full_name,
            u.contribution_score,
            u.trust_score,
            u.created_at,
            COALESCE(rc.total_reports, 0) AS total_reports,
            COALESCE(sc.total_suggestions, 0) AS total_suggestions,
            COALESCE(cc.total_claims, 0) AS total_claims,
            GREATEST(
              u.created_at,
              COALESCE(rc.last_report_at, u.created_at),
              COALESCE(sc.last_suggestion_at, u.created_at),
              COALESCE(cc.last_claim_at, u.created_at)
            ) AS last_activity_at
          FROM users u
          LEFT JOIN report_counts rc ON rc.user_id = u.id
          LEFT JOIN suggestion_counts sc ON sc.user_id = u.id
          LEFT JOIN claim_counts cc ON cc.user_id = u.id
          WHERE ${whereSql}
          ORDER BY last_activity_at DESC, u.created_at DESC
          LIMIT $${listParams.length - 1}
          OFFSET $${listParams.length};
        `,
        listParams,
      ),
      sql(
        `
          SELECT COUNT(*)::int AS total
          FROM users u
          WHERE ${whereSql};
        `,
        totalParams,
      ),
      sql`
        WITH active_users AS (
          SELECT DISTINCT user_id
          FROM (
            SELECT user_id
            FROM live_reports
            WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
            UNION
            SELECT user_id
            FROM suggested_parking_zones
            WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
          ) activity
          WHERE user_id IS NOT NULL
        )
        SELECT
          COUNT(*)::int AS total_users,
          COUNT(*) FILTER (WHERE trust_score >= 70)::int AS trusted_users,
          COUNT(*) FILTER (WHERE trust_score < 50)::int AS low_trust_users,
          (SELECT COUNT(*)::int FROM active_users) AS active_contributors
        FROM users;
      `,
    ]);

    return Response.json({
      success: true,
      users,
      summary: summaryRows[0] || null,
      pagination: {
        page,
        limit,
        total: totalRows[0]?.total ?? 0,
      },
    });
  } catch (error) {
    console.error('Error loading admin users:', error);
    return Response.json(
      { success: false, error: error.message || 'Failed to load users' },
      { status: 500 },
    );
  }
}
