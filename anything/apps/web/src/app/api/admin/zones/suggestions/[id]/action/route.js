import sql from "@/app/api/utils/sql";
import { requireAdminUser } from "@/app/api/utils/admin-auth";
import { logUserActivity } from "@/app/api/utils/activity-log";
import {
  createBoxPolygon,
  DEFAULT_APPROVAL_LAT_OFFSET,
  DEFAULT_APPROVAL_LNG_OFFSET,
  ensureSuggestedZonesAdminSchema,
  normalizeCoordinate,
  normalizeInteger,
  normalizeSuggestedZoneType,
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

    if (!action || !["approve", "reject", "review", "delete", "update-approved-zone", "delete-approved-zone"].includes(action)) {
      return Response.json(
        { success: false, error: "A valid action is required." },
        { status: 400 },
      );
    }

    const suggestionRows = await sql`
      SELECT
        id,
        user_id,
        area_name,
        street_name,
        suggested_zone_type,
        estimated_capacity_spaces,
        status,
        approved_zone_id,
        review_notes,
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

    const latitude = normalizeCoordinate(suggestion.latitude);
    const longitude = normalizeCoordinate(suggestion.longitude);

    if (action === "review") {
      const updatedRows = await sql`
        UPDATE suggested_parking_zones
        SET
          status = 'reviewing',
          reviewed_by = ${auth.user.id},
          reviewed_at = CURRENT_TIMESTAMP,
          review_notes = COALESCE(${reviewNotes}, review_notes),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${suggestionId}
        RETURNING id, status, reviewed_at, review_notes;
      `;

      if (suggestion.user_id) {
        await logUserActivity({
          userId: suggestion.user_id,
          reportId: suggestion.id,
          activityType: "zone_reviewing",
          parkingType: suggestion.suggested_zone_type || "Public",
          quantity: 1,
          longitude,
          latitude,
          zoneType: suggestion.suggested_zone_type || "Public",
          zoneName: suggestion.street_name || suggestion.area_name || "Missing public zone",
          spotStatus: "reviewing",
          eventKey: `zone-suggestion-${suggestion.id}-reviewing`,
        });
      }

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
          review_notes = COALESCE(${reviewNotes}, review_notes),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${suggestionId}
        RETURNING id, status, reviewed_at, review_notes;
      `;

      if (suggestion.user_id) {
        await logUserActivity({
          userId: suggestion.user_id,
          reportId: suggestion.id,
          activityType: "zone_rejected",
          parkingType: suggestion.suggested_zone_type || "Public",
          quantity: 1,
          longitude,
          latitude,
          zoneType: suggestion.suggested_zone_type || "Public",
          zoneName: suggestion.street_name || suggestion.area_name || "Missing public zone",
          spotStatus: "rejected",
          eventKey: `zone-suggestion-${suggestion.id}-rejected`,
        });
      }

      return Response.json({
        success: true,
        message: "Suggestion rejected.",
        suggestion: updatedRows[0] || null,
      });
    }

    if (action === "delete") {
      if (suggestion.approved_zone_id) {
        await sql`
          DELETE FROM parking_zones
          WHERE id = ${suggestion.approved_zone_id};
        `;
      }

      await sql`
        DELETE FROM suggested_parking_zones
        WHERE id = ${suggestionId};
      `;

      return Response.json({
        success: true,
        message: suggestion.approved_zone_id
          ? "Suggestion and linked live zone deleted."
          : "Suggestion deleted.",
        deletedSuggestionId: suggestionId,
        deletedZoneId: suggestion.approved_zone_id || null,
      });
    }

    if (action === "update-approved-zone" || action === "delete-approved-zone") {
      if (!suggestion.approved_zone_id) {
        return Response.json(
          { success: false, error: "This suggestion does not have an approved live zone to manage." },
          { status: 409 },
        );
      }
    }

    if (action === "delete-approved-zone") {
      await sql`
        DELETE FROM parking_zones
        WHERE id = ${suggestion.approved_zone_id};
      `;

      const updatedSuggestionRows = await sql`
        UPDATE suggested_parking_zones
        SET
          status = 'reviewing',
          approved_zone_id = NULL,
          reviewed_by = ${auth.user.id},
          reviewed_at = CURRENT_TIMESTAMP,
          review_notes = COALESCE(${reviewNotes}, review_notes),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${suggestionId}
        RETURNING id, status, reviewed_at, review_notes, approved_zone_id;
      `;

      return Response.json({
        success: true,
        message: "Approved live zone deleted. Suggestion moved back to reviewing.",
        suggestion: updatedSuggestionRows[0] || null,
        deletedZoneId: suggestion.approved_zone_id,
      });
    }

    if (action === "update-approved-zone") {
      const zoneName =
        normalizeText(body.zoneName, 180) ||
        normalizeText(suggestion.street_name, 180) ||
        normalizeText(suggestion.area_name, 180) ||
        `Suggested public zone ${suggestion.id}`;
      const zoneType = normalizeSuggestedZoneType(body.zoneType);
      const rulesDescription = normalizeText(body.rulesDescription, 600);
      const capacitySpaces =
        normalizeInteger(body.capacitySpaces) ??
        normalizeInteger(suggestion.estimated_capacity_spaces);

      if (!zoneType) {
        return Response.json(
          { success: false, error: "A valid parking type is required to update this zone." },
          { status: 400 },
        );
      }

      if (capacitySpaces !== null && capacitySpaces < 0) {
        return Response.json(
          { success: false, error: "Capacity must be zero or a positive number." },
          { status: 400 },
        );
      }

      const existingZoneRows = await sql`
        SELECT id, name, zone_type
        FROM parking_zones
        WHERE LOWER(name) = LOWER(${zoneName})
          AND LOWER(zone_type) = LOWER(${zoneType})
          AND id <> ${suggestion.approved_zone_id}
        LIMIT 1;
      `;

      if (existingZoneRows[0]) {
        return Response.json(
          {
            success: false,
            error: "Another parking zone with this name and type already exists.",
            existingZone: existingZoneRows[0],
          },
          { status: 409 },
        );
      }

      const updatedZoneRows = await sql`
        UPDATE parking_zones
        SET
          name = ${zoneName},
          zone_type = ${zoneType},
          capacity_spaces = ${capacitySpaces},
          rules_description = ${rulesDescription}
        WHERE id = ${suggestion.approved_zone_id}
        RETURNING id, name, zone_type, capacity_spaces, rules_description;
      `;

      const updatedSuggestionRows = await sql`
        UPDATE suggested_parking_zones
        SET
          reviewed_by = ${auth.user.id},
          reviewed_at = CURRENT_TIMESTAMP,
          review_notes = COALESCE(${reviewNotes}, review_notes),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${suggestionId}
        RETURNING id, status, reviewed_at, review_notes, approved_zone_id;
      `;

      return Response.json({
        success: true,
        message: "Approved live zone updated.",
        suggestion: updatedSuggestionRows[0] || null,
        approvedZone: updatedZoneRows[0] || null,
      });
    }

    if (!body.zoneName || !normalizeText(body.zoneName, 180)) {
      return Response.json(
        { success: false, error: "Zone name is required." },
        { status: 400 },
      );
    }

    const zoneName =
      normalizeText(body.zoneName, 180) ||
      normalizeText(suggestion.street_name, 180) ||
      normalizeText(suggestion.area_name, 180) ||
      `Suggested public zone ${suggestion.id}`;
    const zoneType = normalizeSuggestedZoneType(body.zoneType);
    const rulesDescription = normalizeText(body.rulesDescription, 600);
    const capacitySpaces =
      normalizeInteger(body.capacitySpaces) ??
      normalizeInteger(suggestion.estimated_capacity_spaces);
    const latOffset = normalizeCoordinate(body.latOffset) ?? DEFAULT_APPROVAL_LAT_OFFSET;
    const lngOffset = normalizeCoordinate(body.lngOffset) ?? DEFAULT_APPROVAL_LNG_OFFSET;

    if (latitude === null || longitude === null) {
      return Response.json(
        { success: false, error: "Suggestion coordinates are invalid." },
        { status: 400 },
      );
    }

    if (!zoneType) {
      return Response.json(
        { success: false, error: "A valid parking type is required to approve this zone." },
        { status: 400 },
      );
    }

    if (capacitySpaces !== null && capacitySpaces < 0) {
      return Response.json(
        { success: false, error: "Capacity must be zero or a positive number." },
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

    const existingZoneRows = await sql`
      SELECT id, name, zone_type
      FROM parking_zones
      WHERE LOWER(name) = LOWER(${zoneName})
        AND LOWER(zone_type) = LOWER(${zoneType})
      LIMIT 1;
    `;

    if (existingZoneRows[0]) {
      return Response.json(
        {
          success: false,
          error: "A parking zone with this name and type already exists. Use a different zone name before approving.",
          existingZone: existingZoneRows[0],
        },
        { status: 409 },
      );
    }

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
      RETURNING id, name, zone_type, capacity_spaces, rules_description;
    `;

    const approvedZone = insertedZoneRows[0];

    const updatedSuggestionRows = await sql`
      UPDATE suggested_parking_zones
      SET
        status = 'approved',
        reviewed_by = ${auth.user.id},
        reviewed_at = CURRENT_TIMESTAMP,
        review_notes = COALESCE(${reviewNotes}, review_notes),
        approved_zone_id = ${approvedZone?.id || null},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${suggestionId}
      RETURNING id, status, reviewed_at, review_notes, approved_zone_id;
    `;

    if (suggestion.user_id) {
      await logUserActivity({
        userId: suggestion.user_id,
        reportId: suggestion.id,
        activityType: "zone_approved",
        parkingType: zoneType,
        quantity: 1,
        longitude,
        latitude,
        zoneType,
        zoneName,
        spotStatus: "approved",
        eventKey: `zone-suggestion-${suggestion.id}-approved`,
      });
    }

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
