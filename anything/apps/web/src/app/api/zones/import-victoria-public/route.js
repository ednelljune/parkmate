import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sql from '@/app/api/utils/sql';
import { VICTORIA_PUBLIC_PARKING_SOURCE_CATALOG } from '../sourceCatalog';

function createBoxPolygon(lat, lng, latOffset = 0.00045, lngOffset = 0.00055) {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [lng - lngOffset, lat - latOffset],
        [lng + lngOffset, lat - latOffset],
        [lng + lngOffset, lat + latOffset],
        [lng - lngOffset, lat + latOffset],
        [lng - lngOffset, lat - latOffset],
      ],
    ],
  };
}

async function loadVictoriaPublicRegistry() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const mobileRegistryPath = path.resolve(
    currentDir,
    '../../../../../../mobile/src/constants/localCouncilParkings.js'
  );
    const moduleUrl = pathToFileURL(mobileRegistryPath).href;
    const module = await import(
      /* @vite-ignore */
      moduleUrl
    );
  return module.LOCAL_COUNCIL_PARKINGS || [];
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { clearExisting = false, limit } = body;

    const registry = await loadVictoriaPublicRegistry();
    const parkings =
      typeof limit === 'number' && limit > 0 ? registry.slice(0, limit) : registry;

    if (clearExisting) {
      for (const parking of parkings) {
        await sql`
          DELETE FROM parking_zones
          WHERE name = ${parking.name}
        `;
      }
    }

    let importedCount = 0;
    const errors = [];

    for (const parking of parkings) {
      try {
        const polygon = createBoxPolygon(parking.latitude, parking.longitude);

        await sql`
          INSERT INTO parking_zones (
            name,
            zone_type,
            boundary,
            capacity_spaces,
            rules_description
          )
          VALUES (
            ${parking.name},
            ${parking.type},
            ST_GeomFromGeoJSON(${JSON.stringify(polygon)}),
            ${parking.capacitySpaces ?? null},
            ${parking.rules}
          )
          ON CONFLICT (name, zone_type) DO UPDATE
          SET
            boundary = EXCLUDED.boundary,
            capacity_spaces = EXCLUDED.capacity_spaces,
            rules_description = EXCLUDED.rules_description
        `;

        importedCount++;
      } catch (parkingError) {
        errors.push({ parking: parking.name, error: parkingError.message });
      }
    }

    return Response.json({
      success: true,
      imported: importedCount,
      total: parkings.length,
      skipped: parkings.length - importedCount,
      note: 'Imported the curated public parking registry used by the mobile Victoria map layer.',
      sourceCatalog: VICTORIA_PUBLIC_PARKING_SOURCE_CATALOG,
      errors: errors.slice(0, 5),
    });
  } catch (error) {
    console.error('Error importing Victoria public parking:', error);
    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
