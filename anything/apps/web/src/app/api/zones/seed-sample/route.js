import sql from '@/app/api/utils/sql';

export async function POST() {
  try {
    const sampleZones = [
      {
        name: 'Collins St (Spring-Elizabeth)',
        zone_type: '1P',
        center: { lat: -37.8136, lng: 144.9631 },
        rules: 'Mon-Fri 8am-6pm, Sat 8am-12pm',
      },
      {
        name: 'Bourke St (Swanston-Russell)',
        zone_type: '2P',
        center: { lat: -37.8143, lng: 144.9682 },
        rules: 'Mon-Fri 8am-6pm',
      },
      {
        name: 'Lonsdale St (Exhibition-Spring)',
        zone_type: '3P',
        center: { lat: -37.8104, lng: 144.9734 },
        rules: 'Mon-Sat 8am-6pm',
      },
      {
        name: 'Flinders St (Swanston-Russell)',
        zone_type: '1P',
        center: { lat: -37.8179, lng: 144.9679 },
        rules: 'Mon-Fri 9am-5:30pm',
      },
      {
        name: 'Little Collins St (Queen-William)',
        zone_type: '2P',
        center: { lat: -37.8151, lng: 144.9588 },
        rules: 'Mon-Fri 8am-6pm, Sat 8am-1pm',
      },
    ];

    let importedCount = 0;

    for (const zone of sampleZones) {
      const latOffset = 0.0009;
      const lonOffset = 0.0009;
      const polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [zone.center.lng - lonOffset, zone.center.lat - latOffset],
            [zone.center.lng + lonOffset, zone.center.lat - latOffset],
            [zone.center.lng + lonOffset, zone.center.lat + latOffset],
            [zone.center.lng - lonOffset, zone.center.lat + latOffset],
            [zone.center.lng - lonOffset, zone.center.lat - latOffset],
          ],
        ],
      };

      await sql`
        INSERT INTO parking_zones (
          name,
          zone_type,
          boundary,
          capacity_spaces,
          rules_description
        )
        VALUES (
          ${zone.name},
          ${zone.zone_type},
          ST_GeomFromGeoJSON(${JSON.stringify(polygon)}),
          ${zone.capacity_spaces ?? null},
          ${zone.rules}
        )
        ON CONFLICT (name, zone_type) DO UPDATE
        SET
          boundary = EXCLUDED.boundary,
          capacity_spaces = EXCLUDED.capacity_spaces,
          rules_description = EXCLUDED.rules_description
      `;

      importedCount++;
    }

    return Response.json({
      success: true,
      message: `Seeded ${importedCount} sample parking zones in Melbourne CBD`,
      zones: sampleZones.map((zone) => ({ name: zone.name, type: zone.zone_type })),
    });
  } catch (error) {
    console.error('Error seeding sample zones:', error);
    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
