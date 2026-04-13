import sql from '@/app/api/utils/sql';

const EXCLUDED_ZONE_TYPE = 'meter';

export async function POST(request) {
  try {
    const { latitude, longitude } = await request.json();

    if (latitude == null || longitude == null) {
      return Response.json(
        { success: false, error: 'Latitude and longitude are required' },
        { status: 400 }
      );
    }

    const zoneResults = await sql`
      SELECT
        id,
        name,
        zone_type,
        capacity_spaces,
        rules_description
      FROM parking_zones
      WHERE ST_Covers(boundary, ST_SetSRID(ST_Point(${longitude}, ${latitude}), 4326))
        AND LOWER(COALESCE(zone_type, '')) NOT LIKE '%' || ${EXCLUDED_ZONE_TYPE} || '%'
      LIMIT 1;
    `;

    return Response.json({
      success: true,
      zone: zoneResults[0] || null,
    });
  } catch (error) {
    console.error('Error fetching zone at location:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
