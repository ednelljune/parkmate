import sql from "@/app/api/utils/sql";
import { requireAdminUser } from "@/app/api/utils/admin-auth";
import {
  createBoxPolygon,
  DEFAULT_APPROVAL_LAT_OFFSET,
  DEFAULT_APPROVAL_LNG_OFFSET,
  ensureSuggestedZonesAdminSchema,
  normalizeCoordinate,
  normalizeInteger,
  normalizeText,
} from "../../shared";

const normalizeAction = (value) => normalizeText(value, 24)?.toLowerCase() || null;

export async function POST(request, context) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.response) {
      return auth.response;
    }

    await ensureSuggestedZonesAdminSchema();

    const suggestionId = normalizeInteger(context?.params?.id);
    if (!suggestionId) {
      return Response.json(
        { success: false, error: "Invalid suggestion id" },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = normalizeAction(body.action);
    const reviewNotes = normalizeText(body.reviewNotes, 600);

    if (!action || !["approve", "reject", "review"].includes(action)) {
      return Response.json(
        { success: false, error: "A valid action is required." },
        { status: 400 },
      );
    }

    const suggestionRows = await sql`
      SELECT
        id,
        area_name,
        status,
        approved_zone_id,
        ST_Y(location::geometry) AS latitude,
        ST_X(location::geometry) AS longitude
      FROM suggested_parking_zones
      WHERE id = ${suggestionId}
      LIMIT 1;
    `;

    const suggestion = suggestionRows[0];
    if (!suggestion) {
      return Response.json(
        { success: false, error: "Suggestion not found." },
        { status: 404 },
      );
    }

    if (action === "review") {
      const updatedRows = await sql`
        UPDATE suggested_parking_zones
        SET
          status = 'reviewing',
          reviewed_by = ${auth.user.id},
          reviewed_at = CURRENT_TIMESTAMP,
          review_notes = ${reviewNotes},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${suggestionId}
        RETURNING id, status, reviewed_at, review_notes;
      `;

      return Response.json({
        success: true,
        message: "Suggestion moved into review.",
        suggestion: updatedRows[0] || null,
      });
    }

    if (action === "reject") {
      const updatedRows = await sql`
        UPDATE suggested_parking_zones
        SET
          status = 'rejected',
          reviewed_by = ${auth.user.id},
          reviewed_at = CURRENT_TIMESTAMP,
          review_notes = ${reviewNotes},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${suggestionId}
        RETURNING id, status, reviewed_at, review_notes;
      `;

      return Response.json({
        success: true,
        message: "Suggestion rejected.",
        suggestion: updatedRows[0] || null,
      });
    }

    const zoneName =
      normalizeText(body.zoneName, 180) ||
      normalizeText(suggestion.area_name, 180) ||
      `Suggested public zone ${suggestion.id}`;
    const zoneType = normalizeText(body.zoneType, 60) || "Public";
    const rulesDescription = normalizeText(body.rulesDescription, 600);
    const capacitySpaces = normalizeInteger(body.capacitySpaces);
    const latOffset = normalizeCoordinate(body.latOffset) ?? DEFAULT_APPROVAL_LAT_OFFSET;
    const lngOffset = normalizeCoordinate(body.lngOffset) ?? DEFAULT_APPROVAL_LNG_OFFSET;
    const latitude = normalizeCoordinate(suggestion.latitude);
    const longitude = normalizeCoordinate(suggestion.longitude);

    if (latitude === null || longitude === null) {
      return Response.json(
        { success: false, error: "Suggestion coordinates are invalid." },
        { status: 400 },
      );
    }

    if (suggestion.status === "approved" && suggestion.approved_zone_id) {
      return Response.json(
        { success: false, error: "Suggestion is already approved." },
        { status: 409 },
      );
    }

    const polygon = createBoxPolygon(latitude, longitude, latOffset, lngOffset);

    const insertedZoneRows = await sql`
      INSERT INTO parking_zones (
        name,
        zone_type,
        boundary,
        capacity_spaces,
        rules_description
      )
      VALUES (
        ${zoneName},
        ${zoneType},
        ST_GeomFromGeoJSON(${JSON.stringify(polygon)}),
        ${capacitySpaces},
        ${rulesDescription}
      )
      ON CONFLICT (name, zone_type) DO UPDATE
      SET
        boundary = EXCLUDED.boundary,
        capacity_spaces = EXCLUDED.capacity_spaces,
        rules_description = EXCLUDED.rules_description
      RETURNING id, name, zone_type, capacity_spaces, rules_description;
    `;

    const approvedZone = insertedZoneRows[0];

    const updatedSuggestionRows = await sql`
      UPDATE suggested_parking_zones
      SET
        status = 'approved',
        reviewed_by = ${auth.user.id},
        reviewed_at = CURRENT_TIMESTAMP,
        review_notes = ${reviewNotes},
        approved_zone_id = ${approvedZone?.id || null},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${suggestionId}
      RETURNING id, status, reviewed_at, review_notes, approved_zone_id;
    `;

    return Response.json({
      success: true,
      message: "Suggestion approved and added to parking zones.",
      suggestion: updatedSuggestionRows[0] || null,
      approvedZone,
    });
  } catch (error) {
    console.error("Error reviewing zone suggestion:", error);
    return Response.json(
      { success: false, error: error.message || "Failed to review zone suggestion" },
      { status: 500 },
    );
  }
}
