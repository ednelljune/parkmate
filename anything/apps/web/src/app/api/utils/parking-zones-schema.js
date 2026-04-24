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
    })().catch((error) => {
      parkingZonesSchemaPromise = null;
      throw error;
    });
  }

  return parkingZonesSchemaPromise;
};
