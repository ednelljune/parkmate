import sql from "@/app/api/utils/sql";
import { requireAuthenticatedUser } from "@/app/api/utils/supabase-auth";
import { logUserActivity } from "@/app/api/utils/activity-log";
import { ensureUserRow } from "@/app/api/utils/users-schema";
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
const DUPLICATE_DISTANCE_METERS = 30;
const STREET_NAME_MAX_LENGTH = 180;
// Temporary limit while evidence images are still sent as inline data URLs.
const EVIDENCE_PHOTO_URL_MAX_LENGTH = 5000000;
const PARKING_CATEGORY_MAX_LENGTH = 80;
const DESCRIPTION_MAX_LENGTH = 1200;

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
      evidencePhotoUrl,
      parkingCategory,
      description,
      publicParkingConfirmed,
    } =
      await request.json();
    const userId = auth.user.id;
    const normalizedLatitude = normalizeCoordinate(latitude);
    const normalizedLongitude = normalizeCoordinate(longitude);
    const normalizedStreetName = normalizeText(streetName, STREET_NAME_MAX_LENGTH);
    const normalizedEstimatedCapacitySpaces = normalizeInteger(estimatedCapacitySpaces);
    const normalizedSuggestedZoneType = normalizeSuggestedZoneType(suggestedZoneType);
    const normalizedEvidencePhotoUrl = normalizeText(
      evidencePhotoUrl,
      EVIDENCE_PHOTO_URL_MAX_LENGTH,
    );
    const normalizedParkingCategory = normalizeText(
      parkingCategory,
      PARKING_CATEGORY_MAX_LENGTH,
    );
    const normalizedDescription = normalizeText(description, DESCRIPTION_MAX_LENGTH);
    const isPublicParkingConfirmed = publicParkingConfirmed === true;

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

    if (!normalizedEvidencePhotoUrl) {
      return Response.json(
        { success: false, message: "Photo evidence is required for missing zone suggestions." },
        { status: 400 },
      );
    }

    if (!normalizedParkingCategory) {
      return Response.json(
        { success: false, message: "Parking category is required for missing zone suggestions." },
        { status: 400 },
      );
    }

    if (!isPublicParkingConfirmed) {
      return Response.json(
        { success: false, message: "You must confirm this is public parking before submitting." },
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

    await ensureUserRow(auth.user);

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
      WHERE status IN ('pending', 'reviewing')
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
        evidence_photo_url,
        parking_category,
        description,
        public_parking_confirmed,
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
        ${normalizedEvidencePhotoUrl},
        ${normalizedParkingCategory},
        ${normalizedDescription},
        ${isPublicParkingConfirmed},
        ${normalizedEstimatedCapacitySpaces},
        ${normalizedSuggestedZoneType},
        'pending',
        'mobile'
      )
      RETURNING
        id,
        area_name,
        street_name,
        evidence_photo_url,
        parking_category,
        description,
        public_parking_confirmed,
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
