import sql from "@/app/api/utils/sql";

let suggestedZonesAdminSchemaPromise = null;

export const DEFAULT_APPROVAL_LAT_OFFSET = 0.00045;
export const DEFAULT_APPROVAL_LNG_OFFSET = 0.00055;

export const normalizeCoordinate = (value) => {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const normalizeInteger = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
};

export const normalizeText = (value, maxLength = 240) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
};

export const createBoxPolygon = (
  latitude,
  longitude,
  latOffset = DEFAULT_APPROVAL_LAT_OFFSET,
  lngOffset = DEFAULT_APPROVAL_LNG_OFFSET,
) => ({
  type: "Polygon",
  coordinates: [[
    [longitude - lngOffset, latitude - latOffset],
    [longitude + lngOffset, latitude - latOffset],
    [longitude + lngOffset, latitude + latOffset],
    [longitude - lngOffset, latitude + latOffset],
    [longitude - lngOffset, latitude - latOffset],
  ]],
});

export const ensureSuggestedZonesAdminSchema = () => {
  if (!suggestedZonesAdminSchemaPromise) {
    suggestedZonesAdminSchemaPromise = (async () => {
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
        ALTER TABLE suggested_parking_zones
        ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL;
      `;

      await sql`
        ALTER TABLE suggested_parking_zones
        ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
      `;

      await sql`
        ALTER TABLE suggested_parking_zones
        ADD COLUMN IF NOT EXISTS review_notes TEXT;
      `;

      await sql`
        ALTER TABLE suggested_parking_zones
        ADD COLUMN IF NOT EXISTS approved_zone_id BIGINT REFERENCES parking_zones(id) ON DELETE SET NULL;
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
      suggestedZonesAdminSchemaPromise = null;
      throw error;
    });
  }

  return suggestedZonesAdminSchemaPromise;
};

