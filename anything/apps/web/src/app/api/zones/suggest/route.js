import sql from "@/app/api/utils/sql";
import { requireAuthenticatedUser } from "@/app/api/utils/supabase-auth";
import { logUserActivity } from "@/app/api/utils/activity-log";
import {
  ensureSuggestedZonesAdminSchema,
  normalizeCoordinate,
  normalizeInteger,
  normalizeSuggestedZoneType,
  normalizeText,
} from "@/app/api/admin/zones/suggestions/shared";

const EXCLUDED_ZONE_TYPE = "meter";
const MIN_TRUST_SCORE_TO_SUGGEST = 45;
const MAX_SUGGESTIONS_PER_DAY = 3;
const DUPLICATE_DISTANCE_METERS = 75;
const STREET_NAME_MAX_LENGTH = 180;

const getDisplayNameFallback = (user) => {
  const metadataName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    null;

  if (metadataName) {
    return metadataName;
  }

  const email = typeof user.email === "string" ? user.email.trim() : "";
  const [localPart] = email.split("@");
  return localPart || null;
};

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth.response) {
      return auth.response;
    }

    await ensureSuggestedZonesAdminSchema();

    const {
      latitude,
      longitude,
      streetName,
      estimatedCapacitySpaces,
      suggestedZoneType,
    } =
      await request.json();
    const userId = auth.user.id;
    const normalizedLatitude = normalizeCoordinate(latitude);
    const normalizedLongitude = normalizeCoordinate(longitude);
    const normalizedStreetName = normalizeText(streetName, STREET_NAME_MAX_LENGTH);
    const normalizedEstimatedCapacitySpaces = normalizeInteger(estimatedCapacitySpaces);
    const normalizedSuggestedZoneType = normalizeSuggestedZoneType(suggestedZoneType);
    const fullName = getDisplayNameFallback(auth.user);
    const email = auth.user.email || "";

    if (normalizedLatitude === null || normalizedLongitude === null) {
      return Response.json(
        { success: false, message: "Current location is required to suggest a parking zone." },
        { status: 400 },
      );
    }

    if (!normalizedStreetName) {
      return Response.json(
        { success: false, message: "Street name is required for missing zone suggestions." },
        { status: 400 },
      );
    }

    if (!normalizedSuggestedZoneType) {
      return Response.json(
        { success: false, message: "Parking type is required for missing zone suggestions." },
        { status: 400 },
      );
    }

    if (
      normalizedEstimatedCapacitySpaces !== null &&
      normalizedEstimatedCapacitySpaces < 0
    ) {
      return Response.json(
        { success: false, message: "Estimated capacity must be zero or a positive number." },
        { status: 400 },
      );
    }

    await sql`
      INSERT INTO users (id, email, full_name)
      VALUES (${userId}, ${email}, ${fullName})
      ON CONFLICT (id) DO UPDATE
      SET
        email = COALESCE(NULLIF(EXCLUDED.email, ''), users.email),
        full_name = COALESCE(users.full_name, EXCLUDED.full_name);
    `;

    const userRows = await sql`
      SELECT trust_score
      FROM users
      WHERE id = ${userId}
      LIMIT 1;
    `;
    const trustScore = Number(userRows[0]?.trust_score) || 100;

    if (trustScore < MIN_TRUST_SCORE_TO_SUGGEST) {
      return Response.json(
        {
          success: false,
          message:
            "Your trust score is too low to suggest new parking zones right now.",
        },
        { status: 403 },
      );
    }

    const mappedZoneRows = await sql`
      SELECT id, name, zone_type
      FROM parking_zones
      WHERE LOWER(COALESCE(zone_type, '')) NOT LIKE '%' || ${EXCLUDED_ZONE_TYPE} || '%'
        AND ST_Covers(
          boundary,
          ST_SetSRID(ST_Point(${normalizedLongitude}, ${normalizedLatitude}), 4326)
        )
      LIMIT 1;
    `;

    if (mappedZoneRows[0]) {
      return Response.json(
        {
          success: false,
          message:
            "This location is already inside a mapped parking zone, so a new zone suggestion is not needed here.",
        },
        { status: 409 },
      );
    }

    const dailyLimitRows = await sql`
      SELECT COUNT(*)::int AS count
      FROM suggested_parking_zones
      WHERE user_id = ${userId}
        AND created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours';
    `;
    const dailySubmissionCount = Number(dailyLimitRows[0]?.count) || 0;

    if (dailySubmissionCount >= MAX_SUGGESTIONS_PER_DAY) {
      return Response.json(
        {
          success: false,
          message:
            "You have reached today's parking zone suggestion limit. Please try again tomorrow.",
          dailySubmissionCount,
          dailySubmissionLimit: MAX_SUGGESTIONS_PER_DAY,
        },
        { status: 429 },
      );
    }

    const nearbySuggestionRows = await sql`
      SELECT id, street_name, area_name, status, created_at
      FROM suggested_parking_zones
      WHERE status IN ('pending', 'reviewing', 'approved')
        AND ST_DWithin(
          location::geography,
          ST_SetSRID(ST_Point(${normalizedLongitude}, ${normalizedLatitude}), 4326)::geography,
          ${DUPLICATE_DISTANCE_METERS}
        )
      ORDER BY created_at DESC
      LIMIT 1;
    `;

    if (nearbySuggestionRows[0]) {
      return Response.json(
        {
          success: false,
          message:
            "A parking zone suggestion has already been submitted very close to this location.",
          duplicateSuggestion: nearbySuggestionRows[0],
        },
        { status: 409 },
      );
    }

    const insertedRows = await sql`
      INSERT INTO suggested_parking_zones (
        user_id,
        location,
        area_name,
        street_name,
        estimated_capacity_spaces,
        suggested_zone_type,
        status,
        source
      )
      VALUES (
        ${userId},
        ST_SetSRID(ST_Point(${normalizedLongitude}, ${normalizedLatitude}), 4326),
        ${normalizedStreetName},
        ${normalizedStreetName},
        ${normalizedEstimatedCapacitySpaces},
        ${normalizedSuggestedZoneType},
        'pending',
        'mobile'
      )
      RETURNING
        id,
        area_name,
        street_name,
        estimated_capacity_spaces,
        suggested_zone_type,
        suggested_zone_type AS zone_type,
        estimated_capacity_spaces AS capacity_spaces,
        street_name AS zone_name,
        status,
        confirmation_count,
        false_flag_count,
        created_at,
        ST_Y(location::geometry) AS latitude,
        ST_X(location::geometry) AS longitude;
    `;

    const insertedSuggestion = insertedRows[0] || null;

    if (insertedSuggestion) {
      await logUserActivity({
        userId,
        reportId: insertedSuggestion.id,
        activityType: "zone_suggested",
        parkingType: insertedSuggestion.suggested_zone_type || "Public",
        quantity: 1,
        longitude: insertedSuggestion.longitude,
        latitude: insertedSuggestion.latitude,
        zoneType: insertedSuggestion.suggested_zone_type || "Public",
        zoneName: insertedSuggestion.street_name || "Missing public zone",
        spotStatus: insertedSuggestion.status,
        occurredAt: insertedSuggestion.created_at,
        eventKey: `zone-suggestion-${insertedSuggestion.id}-submitted`,
      });
    }

    return Response.json({
      success: true,
      message:
        "Parking zone suggestion received. We'll review it before it becomes part of the live map.",
      suggestion: insertedSuggestion,
      dailySubmissionCount: dailySubmissionCount + 1,
      dailySubmissionLimit: MAX_SUGGESTIONS_PER_DAY,
    });
  } catch (error) {
    console.error("Error suggesting parking zone:", error);
    return Response.json(
      { success: false, error: error.message || "Failed to suggest parking zone" },
      { status: 500 },
    );
  }
}
