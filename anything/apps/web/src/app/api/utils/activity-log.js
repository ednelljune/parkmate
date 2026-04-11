import sql from "@/app/api/utils/sql";

let activityLogSchemaPromise = null;

export const ensureActivityLogSchema = () => {
  if (!activityLogSchemaPromise) {
    activityLogSchemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS user_activity_logs (
          id BIGSERIAL PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          report_id BIGINT,
          activity_type TEXT NOT NULL,
          parking_type TEXT,
          quantity INTEGER NOT NULL DEFAULT 1,
          longitude DOUBLE PRECISION,
          latitude DOUBLE PRECISION,
          zone_type TEXT,
          zone_name TEXT,
          spot_status TEXT,
          occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id
        ON user_activity_logs (user_id, occurred_at DESC);
      `;

      await sql`
        ALTER TABLE user_activity_logs
        ADD COLUMN IF NOT EXISTS event_key TEXT;
      `;

      await sql`
        DROP INDEX IF EXISTS idx_user_activity_logs_unique_event;
      `;

      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_user_activity_logs_unique_legacy_event
        ON user_activity_logs (user_id, report_id, activity_type)
        WHERE event_key IS NULL;
      `;

      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_user_activity_logs_unique_event_key
        ON user_activity_logs (user_id, event_key)
        WHERE event_key IS NOT NULL;
      `;
    })().catch((error) => {
      activityLogSchemaPromise = null;
      throw error;
    });
  }

  return activityLogSchemaPromise;
};

export const logUserActivity = async ({
  userId,
  reportId = null,
  activityType,
  parkingType = null,
  quantity = 1,
  longitude = null,
  latitude = null,
  zoneType = null,
  zoneName = null,
  spotStatus = null,
  occurredAt = null,
  eventKey = null,
}) => {
  await ensureActivityLogSchema();
  const resolvedOccurredAt = occurredAt || new Date().toISOString();

  await sql`
    INSERT INTO user_activity_logs (
      user_id,
      report_id,
      activity_type,
      parking_type,
      quantity,
      longitude,
      latitude,
      zone_type,
      zone_name,
      spot_status,
      occurred_at,
      event_key
    )
    VALUES (
      ${userId},
      ${reportId},
      ${activityType},
      ${parkingType},
      ${Math.max(1, Number(quantity) || 1)},
      ${longitude},
      ${latitude},
      ${zoneType},
      ${zoneName},
      ${spotStatus},
      ${resolvedOccurredAt},
      ${eventKey}
    )
    ON CONFLICT DO NOTHING;
  `;
};
