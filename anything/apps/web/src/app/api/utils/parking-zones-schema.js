import sql from '@/app/api/utils/sql';

let parkingZonesSchemaPromise = null;

export const ensureParkingZonesSchema = () => {
  if (!parkingZonesSchemaPromise) {
    parkingZonesSchemaPromise = (async () => {
      await sql`
        ALTER TABLE parking_zones
        ADD COLUMN IF NOT EXISTS source_registry_key TEXT;
      `;

      await sql`
        ALTER TABLE parking_zones
        ADD COLUMN IF NOT EXISTS source_owner TEXT;
      `;

      await sql`
        ALTER TABLE parking_zones
        ADD COLUMN IF NOT EXISTS source_dataset TEXT;
      `;

      await sql(
        `
          DO $$
          BEGIN
            IF EXISTS (
              SELECT 1
              FROM pg_constraint
              WHERE conname = 'parking_zones_name_zone_type_key'
                AND conrelid = 'parking_zones'::regclass
            ) THEN
              ALTER TABLE parking_zones
              DROP CONSTRAINT parking_zones_name_zone_type_key;
            END IF;
          END
          $$;
        `,
      );

      await sql(
        `
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1
              FROM pg_constraint
              WHERE conname = 'parking_zones_source_registry_key_key'
                AND conrelid = 'parking_zones'::regclass
            ) THEN
              ALTER TABLE parking_zones
              ADD CONSTRAINT parking_zones_source_registry_key_key UNIQUE (source_registry_key);
            END IF;
          END
          $$;
        `,
      );

      await sql(
        `
          CREATE INDEX IF NOT EXISTS idx_parking_zones_boundary_gist
          ON parking_zones USING GIST (boundary);
        `,
      );

      await sql(
        `
          CREATE INDEX IF NOT EXISTS idx_parking_zones_source_owner
          ON parking_zones (source_owner);
        `,
      );

      await sql(
        `
          CREATE INDEX IF NOT EXISTS idx_parking_zones_source_dataset
          ON parking_zones (source_dataset);
        `,
      );

      await sql(
        `
          DO $$
          BEGIN
            IF EXISTS (
              SELECT 1
              FROM information_schema.tables
              WHERE table_schema = 'public'
                AND table_name = 'suggested_parking_zones'
            ) THEN
              UPDATE parking_zones
              SET
                source_owner = COALESCE(parking_zones.source_owner, 'ParkMate Community'),
                source_dataset = COALESCE(parking_zones.source_dataset, 'Approved missing public zones')
              FROM suggested_parking_zones
              WHERE suggested_parking_zones.approved_zone_id = parking_zones.id
                AND suggested_parking_zones.status = 'approved'
                AND (
                  parking_zones.source_owner IS NULL
                  OR parking_zones.source_dataset IS NULL
                );
            END IF;
          END
          $$;
        `,
      );
    })().catch((error) => {
      parkingZonesSchemaPromise = null;
      throw error;
    });
  }

  return parkingZonesSchemaPromise;
};
