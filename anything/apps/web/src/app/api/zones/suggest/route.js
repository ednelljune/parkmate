import sql from "@/app/api/utils/sql";
import { requireAuthenticatedUser } from "@/app/api/utils/supabase-auth";

const EXCLUDED_ZONE_TYPE = "meter";
const MIN_TRUST_SCORE_TO_SUGGEST = 45;
const MAX_SUGGESTIONS_PER_DAY = 3;
const DUPLICATE_DISTANCE_METERS = 75;
const AREA_NAME_MAX_LENGTH = 120;

let suggestedZonesSchemaPromise = null;

const normalizeCoordinate = (value) => {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeAreaName = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed.slice(0, AREA_NAME_MAX_LENGTH);
};

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

const ensureSuggestedZonesSchema = () => {
  if (!suggestedZonesSchemaPromise) {
    suggestedZonesSchemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS suggested_parking_zones (
          id BIGSERIAL PRIMARY KEY,
          user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          location geometry(Point, 4326) NOT NULL,
          area_name TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          confirmation_count INTEGER NOT NULL DEFAULT 0,
          false_flag_count INTEGER NOT NULL DEFAULT 0,
          source TEXT NOT NULL DEFAULT 'mobile',
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_suggested_parking_zones_user_created
        ON suggested_parking_zones (user_id, created_at DESC);
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_suggested_parking_zones_status_created
        ON suggested_parking_zones (status, created_at DESC);
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_suggested_parking_zones_location_gist
        ON suggested_parking_zones USING GIST (location);
      `;
    })().catch((error) => {
      suggestedZonesSchemaPromise = null;
      throw error;
    });
  }

  return suggestedZonesSchemaPromise;
};

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth.response) {
      return auth.response;
    }

    await ensureSuggestedZonesSchema();

    const { latitude, longitude, areaName } = await request.json();
    const userId = auth.user.id;
    const normalizedLatitude = normalizeCoordinate(latitude);
    const normalizedLongitude = normalizeCoordinate(longitude);
    const normalizedAreaName = normalizeAreaName(areaName);
    const fullName = getDisplayNameFallback(auth.user);
    const email = auth.user.email || "";

    if (normalizedLatitude === null || normalizedLongitude === null) {
      return Response.json(
        { success: false, message: "Current location is required to suggest a parking zone." },
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
      SELECT id, area_name, status, created_at
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
        status,
        source
      )
      VALUES (
        ${userId},
        ST_SetSRID(ST_Point(${normalizedLongitude}, ${normalizedLatitude}), 4326),
        ${normalizedAreaName},
        'pending',
        'mobile'
      )
      RETURNING
        id,
        area_name,
        status,
        confirmation_count,
        false_flag_count,
        created_at;
    `;

    return Response.json({
      success: true,
      message:
        "Parking zone suggestion received. We'll review it before it becomes part of the live map.",
      suggestion: insertedRows[0] || null,
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
