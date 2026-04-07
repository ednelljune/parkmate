import sql from '@/app/api/utils/sql';

const VICTORIA_BOUNDS = {
  minLat: -39.5,
  maxLat: -33.5,
  minLng: 140.5,
  maxLng: 150.5,
};
const EXCLUDED_ZONE_TYPE = 'meter';

export async function POST(request) {
  try {
    const {
      latitude,
      longitude,
      radiusMeters,
      minLat,
      maxLat,
      minLng,
      maxLng,
      includeGeometry = true,
    } = await request.json();
    const geometrySelectSql = includeGeometry
      ? "ST_AsGeoJSON(boundary)::json AS boundary_geojson,"
      : "NULL::json AS boundary_geojson,";

    if (
      minLat != null &&
      maxLat != null &&
      minLng != null &&
      maxLng != null
    ) {
      const boundedMinLat = Math.max(minLat, VICTORIA_BOUNDS.minLat);
      const boundedMaxLat = Math.min(maxLat, VICTORIA_BOUNDS.maxLat);
      const boundedMinLng = Math.max(minLng, VICTORIA_BOUNDS.minLng);
      const boundedMaxLng = Math.min(maxLng, VICTORIA_BOUNDS.maxLng);

      const zones = await sql(
        `
          SELECT
            id,
            name,
            zone_type,
            capacity_spaces,
            rules_description,
            ${geometrySelectSql}
            ST_Y(ST_Centroid(boundary::geometry)) AS center_lat,
            ST_X(ST_Centroid(boundary::geometry)) AS center_lng
          FROM parking_zones
          WHERE ST_Intersects(
            boundary::geometry,
            ST_MakeEnvelope(
              $1,
              $2,
              $3,
              $4,
              4326
            )
          )
            AND LOWER(COALESCE(zone_type, '')) NOT LIKE '%' || $5 || '%'
          LIMIT ${includeGeometry ? 800 : 400};
        `,
        [
          boundedMinLng,
          boundedMinLat,
          boundedMaxLng,
          boundedMaxLat,
          EXCLUDED_ZONE_TYPE,
        ],
      );

      return Response.json({ success: true, zones });
    }

    if (latitude != null && longitude != null && radiusMeters != null) {
      const zones = await sql(
        `
          SELECT
            id,
            name,
            zone_type,
            capacity_spaces,
            rules_description,
            ${geometrySelectSql}
            ST_Y(ST_Centroid(boundary::geometry)) AS center_lat,
            ST_X(ST_Centroid(boundary::geometry)) AS center_lng,
            ST_Distance(
              boundary::geography,
              ST_SetSRID(ST_Point($1, $2), 4326)::geography
            ) AS distance_meters
          FROM parking_zones
          WHERE ST_DWithin(
            boundary::geography,
            ST_SetSRID(ST_Point($1, $2), 4326)::geography,
            $3
          )
            AND LOWER(COALESCE(zone_type, '')) NOT LIKE '%' || $4 || '%'
            AND ST_Y(ST_Centroid(boundary::geometry)) BETWEEN $5 AND $6
            AND ST_X(ST_Centroid(boundary::geometry)) BETWEEN $7 AND $8
          ORDER BY distance_meters ASC
          LIMIT ${includeGeometry ? 200 : 120};
        `,
        [
          longitude,
          latitude,
          radiusMeters,
          EXCLUDED_ZONE_TYPE,
          VICTORIA_BOUNDS.minLat,
          VICTORIA_BOUNDS.maxLat,
          VICTORIA_BOUNDS.minLng,
          VICTORIA_BOUNDS.maxLng,
        ],
      );

      return Response.json({ success: true, zones });
    }

    const zones = await sql`
      SELECT
        id,
        name,
        zone_type,
        capacity_spaces,
        rules_description,
        ST_AsGeoJSON(boundary)::json AS boundary_geojson,
        ST_Y(ST_Centroid(boundary::geometry)) AS center_lat,
        ST_X(ST_Centroid(boundary::geometry)) AS center_lng
      FROM parking_zones
      WHERE LOWER(COALESCE(zone_type, '')) NOT LIKE '%' || ${EXCLUDED_ZONE_TYPE} || '%'
        AND ST_Y(ST_Centroid(boundary::geometry)) BETWEEN ${VICTORIA_BOUNDS.minLat} AND ${VICTORIA_BOUNDS.maxLat}
        AND ST_X(ST_Centroid(boundary::geometry)) BETWEEN ${VICTORIA_BOUNDS.minLng} AND ${VICTORIA_BOUNDS.maxLng}
      LIMIT 5000;
    `;

    return Response.json({ success: true, zones });
  } catch (error) {
    console.error('Error listing zones:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const zones = await sql`
      SELECT
        id,
        name,
        zone_type,
        capacity_spaces,
        rules_description,
        ST_AsGeoJSON(boundary)::json AS boundary_geojson,
        ST_Y(ST_Centroid(boundary::geometry)) AS center_lat,
        ST_X(ST_Centroid(boundary::geometry)) AS center_lng
      FROM parking_zones
      WHERE LOWER(COALESCE(zone_type, '')) NOT LIKE '%' || ${EXCLUDED_ZONE_TYPE} || '%'
        AND ST_Y(ST_Centroid(boundary::geometry)) BETWEEN ${VICTORIA_BOUNDS.minLat} AND ${VICTORIA_BOUNDS.maxLat}
        AND ST_X(ST_Centroid(boundary::geometry)) BETWEEN ${VICTORIA_BOUNDS.minLng} AND ${VICTORIA_BOUNDS.maxLng}
      LIMIT 5000;
    `;

    return Response.json({ success: true, zones });
  } catch (error) {
    console.error('Error fetching zones:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
