import sql from "@/app/api/utils/sql";
import { requireAdminUser } from "@/app/api/utils/admin-auth";
import { ensureSuggestedZonesAdminSchema } from "@/app/api/admin/zones/suggestions/shared";

export async function GET(request) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.response) {
      return auth.response;
    }

    await ensureSuggestedZonesAdminSchema();

    const [summaryRows, recentSuggestionRows] = await Promise.all([
      sql`
        SELECT
          COUNT(*)::int AS total_suggestions,
          COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_count,
          COUNT(*) FILTER (WHERE status = 'reviewing')::int AS reviewing_count,
          COUNT(*) FILTER (WHERE status = 'approved')::int AS approved_count,
          COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected_count,
          COUNT(*) FILTER (WHERE approved_zone_id IS NOT NULL)::int AS live_zone_count,
          COUNT(DISTINCT user_id)::int AS contributor_count,
          COALESCE(SUM(confirmation_count), 0)::int AS total_confirmations,
          COALESCE(SUM(false_flag_count), 0)::int AS total_false_flags,
          MAX(created_at) AS latest_submission_at,
          MIN(created_at) FILTER (WHERE status = 'pending') AS oldest_pending_at
        FROM suggested_parking_zones;
      `,
      sql`
        SELECT
          spz.id,
          COALESCE(spz.street_name, spz.area_name) AS zone_name,
          spz.street_name,
          spz.area_name,
          spz.status,
          spz.confirmation_count,
          spz.false_flag_count,
          spz.suggested_zone_type,
          spz.estimated_capacity_spaces,
          spz.created_at,
          ST_Y(spz.location::geometry) AS latitude,
          ST_X(spz.location::geometry) AS longitude,
          submitter.email AS submitter_email,
          submitter.full_name AS submitter_name
        FROM suggested_parking_zones spz
        LEFT JOIN users submitter ON submitter.id = spz.user_id
        WHERE spz.status IN ('pending', 'reviewing')
        ORDER BY
          CASE WHEN spz.status = 'pending' THEN 0 ELSE 1 END,
          spz.confirmation_count DESC,
          spz.created_at DESC
        LIMIT 8;
      `,
    ]);

    return Response.json({
      success: true,
      summary: summaryRows[0] || null,
      suggestions: recentSuggestionRows,
    });
  } catch (error) {
    console.error("Error loading admin dashboard:", error);
    return Response.json(
      { success: false, error: error.message || "Failed to load admin dashboard" },
      { status: 500 },
    );
  }
}
