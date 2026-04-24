import sql from '@/app/api/utils/sql';
import { ensureParkingZonesSchema } from '@/app/api/utils/parking-zones-schema';

const VICTORIA_BOUNDS = {
  minLat: -39.5,
  maxLat: -33.5,
  minLng: 140.5,
  maxLng: 150.5,
};
const EXCLUDED_ZONE_TYPE = 'meter';

export async function POST(request) {
  try {
    await ensureParkingZonesSchema();

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
          WITH origin AS (
            SELECT
              ST_SetSRID(ST_Point($1, $2), 4326) AS point_geom,
              ST_SetSRID(ST_Point($1, $2), 4326)::geography AS point_geography,
              ($3::double precision / 111320.0) AS search_radius_degrees
          ),
          candidate_zones AS (
            SELECT
              parking_zones.id,
              parking_zones.name,
              parking_zones.zone_type,
              parking_zones.capacity_spaces,
              parking_zones.rules_description,
              parking_zones.boundary,
              ST_Y(ST_Centroid(parking_zones.boundary::geometry)) AS center_lat,
              ST_X(ST_Centroid(parking_zones.boundary::geometry)) AS center_lng
            FROM parking_zones
            CROSS JOIN origin
            WHERE parking_zones.boundary && ST_Expand(origin.point_geom, origin.search_radius_degrees)
              AND LOWER(COALESCE(parking_zones.zone_type, '')) NOT LIKE '%' || $4 || '%'
              AND ST_Y(ST_Centroid(parking_zones.boundary::geometry)) BETWEEN $5 AND $6
              AND ST_X(ST_Centroid(parking_zones.boundary::geometry)) BETWEEN $7 AND $8
          )
          SELECT
            candidate_zones.id,
            candidate_zones.name,
            candidate_zones.zone_type,
            candidate_zones.capacity_spaces,
            candidate_zones.rules_description,
            ${includeGeometry ? 'ST_AsGeoJSON(candidate_zones.boundary)::json AS boundary_geojson,' : 'NULL::json AS boundary_geojson,'}
            candidate_zones.center_lat,
            candidate_zones.center_lng,
            ST_Distance(candidate_zones.boundary::geography, origin.point_geography) AS distance_meters
          FROM candidate_zones
          CROSS JOIN origin
          WHERE ST_DWithin(
            candidate_zones.boundary::geography,
            origin.point_geography,
            $3
          )
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
    await ensureParkingZonesSchema();

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
