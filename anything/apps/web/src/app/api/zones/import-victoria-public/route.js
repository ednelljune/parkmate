import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sql from '@/app/api/utils/sql';
import { ensureParkingZonesSchema } from '@/app/api/utils/parking-zones-schema';
import { VICTORIA_PUBLIC_PARKING_SOURCE_CATALOG } from '../sourceCatalog';

const COUNCIL_SOURCE_OWNER_PATTERN =
  /(?:^| )(?:City|Shire|Borough|Town|Rural City|Regional Council|Council)(?: of|$)/i;

const PUBLISHED_PUBLIC_PARKING_ZONE_DATASETS = new Set([
  'Car Parking Zones',
  'City of Casey Parking Restriction Zones',
  'Parking zones linked to street segments',
]);

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

function createSourceRegistryKey(parking) {
  const lat = Number(parking?.latitude ?? 0).toFixed(6);
  const lng = Number(parking?.longitude ?? 0).toFixed(6);
  return [
    String(parking?.sourceOwner || '').trim(),
    String(parking?.sourceDataset || '').trim(),
    String(parking?.name || '').trim(),
    String(parking?.type || '').trim(),
    lat,
    lng,
  ].join('::');
}

async function loadVictoriaPublicRegistry() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const researchedRegistryCandidatePaths = [
    path.resolve(
      currentDir,
      '../../../../../../mobile/src/constants/researchedPublicParkingZones.js'
    ),
    path.resolve(process.cwd(), '../mobile/src/constants/researchedPublicParkingZones.js'),
    path.resolve(process.cwd(), '../../apps/mobile/src/constants/researchedPublicParkingZones.js'),
  ];
  const researchedRegistryPath = researchedRegistryCandidatePaths.find((candidatePath) =>
    fs.existsSync(candidatePath),
  );

  if (!researchedRegistryPath) {
    throw new Error('Could not locate mobile/src/constants/researchedPublicParkingZones.js');
  }

  const localCouncilCandidatePaths = [
    path.resolve(currentDir, '../../../../../../mobile/src/constants/localCouncilParkings.js'),
    path.resolve(process.cwd(), '../mobile/src/constants/localCouncilParkings.js'),
    path.resolve(process.cwd(), '../../apps/mobile/src/constants/localCouncilParkings.js'),
  ];
  const localCouncilSourcePath = localCouncilCandidatePaths.find((candidatePath) =>
    fs.existsSync(candidatePath),
  );

  const moduleUrl = pathToFileURL(researchedRegistryPath).href;
  const module = await import(
    /* @vite-ignore */
    moduleUrl
  );
  const researchedRegistry = module.RESEARCHED_PUBLIC_PARKING_ZONES || [];
  const activeRegistry = researchedRegistry.filter(
    (zone) =>
      COUNCIL_SOURCE_OWNER_PATTERN.test(String(zone?.sourceOwner || '')) &&
      PUBLISHED_PUBLIC_PARKING_ZONE_DATASETS.has(String(zone?.sourceDataset || '')),
  );

  const legacyResearchedCouncilNames = researchedRegistry
    .filter((zone) =>
      COUNCIL_SOURCE_OWNER_PATTERN.test(String(zone?.sourceOwner || '')),
    )
    .map((zone) => String(zone?.name || '').trim())
    .filter(Boolean);

  const baseLocalParkingNames = localCouncilSourcePath
    ? [...fs.readFileSync(localCouncilSourcePath, 'utf8').matchAll(/name:\s*"([^"]+)"/g)]
        .map((match) => String(match[1] || '').trim())
        .filter(Boolean)
    : [];

  return {
    activeRegistry,
    legacyRegistryNames: [
      ...new Set([...legacyResearchedCouncilNames, ...baseLocalParkingNames]),
    ],
  };
}

export async function POST(request) {
  try {
    await ensureParkingZonesSchema();

    const body = await request.json().catch(() => ({}));
    const { clearExisting = false, limit } = body;

    const { activeRegistry, legacyRegistryNames } = await loadVictoriaPublicRegistry();
    const parkings =
      typeof limit === 'number' && limit > 0
        ? activeRegistry.slice(0, limit)
        : activeRegistry;

    let importedCount = 0;
    const errors = [];

    await sql.transaction(async (tx) => {
      if (clearExisting) {
        await tx`
          DELETE FROM parking_zones
          WHERE source_owner IS NOT NULL
            AND source_dataset = ANY(${Array.from(PUBLISHED_PUBLIC_PARKING_ZONE_DATASETS)})
        `;

        for (const parkingName of legacyRegistryNames) {
          await tx`
            DELETE FROM parking_zones
            WHERE source_owner IS NULL
              AND name = ${parkingName}
          `;
        }
      }

      for (const parking of parkings) {
        try {
          const polygon = createBoxPolygon(parking.latitude, parking.longitude);
          const sourceRegistryKey = createSourceRegistryKey(parking);

          await tx`
            INSERT INTO parking_zones (
              name,
              zone_type,
              boundary,
              capacity_spaces,
              rules_description,
              source_registry_key,
              source_owner,
              source_dataset
            )
            VALUES (
              ${parking.name},
              ${parking.type},
              ST_GeomFromGeoJSON(${JSON.stringify(polygon)}),
              ${parking.capacitySpaces ?? null},
              ${parking.rules},
              ${sourceRegistryKey},
              ${parking.sourceOwner ?? null},
              ${parking.sourceDataset ?? null}
            )
            ON CONFLICT (source_registry_key) DO UPDATE
            SET
              name = EXCLUDED.name,
              zone_type = EXCLUDED.zone_type,
              boundary = EXCLUDED.boundary,
              capacity_spaces = EXCLUDED.capacity_spaces,
              rules_description = EXCLUDED.rules_description,
              source_owner = EXCLUDED.source_owner,
              source_dataset = EXCLUDED.source_dataset
          `;

          importedCount++;
        } catch (parkingError) {
          errors.push({ parking: parking.name, error: parkingError.message });
        }
      }
    });

    return Response.json({
      success: true,
      imported: importedCount,
      total: parkings.length,
      skipped: parkings.length - importedCount,
      note: 'Imported the strict published public parking zone registry used by the mobile Victoria map layer.',
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
