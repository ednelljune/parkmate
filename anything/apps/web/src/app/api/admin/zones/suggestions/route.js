import sql from "@/app/api/utils/sql";
import { requireAdminUser } from "@/app/api/utils/admin-auth";
import { ensureSuggestedZonesAdminSchema, normalizeText } from "./shared";

const VALID_STATUSES = new Set(["pending", "reviewing", "approved", "rejected"]);

export async function GET(request) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.response) {
      return auth.response;
    }

    await ensureSuggestedZonesAdminSchema();

    const { searchParams } = new URL(request.url);
    const statusFilter = normalizeText(searchParams.get("status"), 24)?.toLowerCase() || "pending";
    const effectiveStatus = VALID_STATUSES.has(statusFilter) ? statusFilter : "pending";

    const rows = await sql`
      SELECT
        spz.id,
        spz.user_id,
        spz.area_name,
        spz.status,
        spz.confirmation_count,
        spz.false_flag_count,
        spz.source,
        spz.created_at,
        spz.updated_at,
        spz.reviewed_at,
        spz.review_notes,
        spz.approved_zone_id,
        ST_Y(spz.location::geometry) AS latitude,
        ST_X(spz.location::geometry) AS longitude,
        submitter.email AS submitter_email,
        submitter.full_name AS submitter_name,
        reviewer.email AS reviewer_email,
        reviewer.full_name AS reviewer_name,
        pz.name AS approved_zone_name,
        pz.zone_type AS approved_zone_type
      FROM suggested_parking_zones spz
      LEFT JOIN users submitter ON submitter.id = spz.user_id
      LEFT JOIN users reviewer ON reviewer.id = spz.reviewed_by
      LEFT JOIN parking_zones pz ON pz.id = spz.approved_zone_id
      WHERE spz.status = ${effectiveStatus}
      ORDER BY spz.created_at DESC
      LIMIT 200;
    `;

    return Response.json({
      success: true,
      status: effectiveStatus,
      suggestions: rows,
    });
  } catch (error) {
    console.error("Error loading admin zone suggestions:", error);
    return Response.json(
      { success: false, error: error.message || "Failed to load zone suggestions" },
      { status: 500 },
    );
  }
}

