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
        CREATE UNIQUE INDEX IF NOT EXISTS idx_user_activity_logs_unique_event
        ON user_activity_logs (user_id, report_id, activity_type);
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
      occurred_at
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
      ${resolvedOccurredAt}
    )
    ON CONFLICT (user_id, report_id, activity_type) DO NOTHING;
  `;
};
