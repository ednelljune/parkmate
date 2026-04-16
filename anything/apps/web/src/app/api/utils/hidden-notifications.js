import sql from "@/app/api/utils/sql";

let hiddenNotificationsSchemaPromise = null;

export const HIDDEN_NOTIFICATION_FEED_TYPES = {
  activity: "activity",
  mailbox: "mailbox",
};

const getDisplayNameFallback = (user) => {
  const metadataName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    null;

  if (metadataName) {
    return metadataName;
  }

  const email = typeof user?.email === "string" ? user.email.trim() : "";
  const [localPart] = email.split("@");
  return localPart || null;
};

export const ensureHiddenNotificationsSchema = () => {
  if (!hiddenNotificationsSchemaPromise) {
    hiddenNotificationsSchemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS user_hidden_notifications (
          id BIGSERIAL PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          feed_type TEXT NOT NULL,
          notification_id TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `;

      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_user_hidden_notifications_unique_item
        ON user_hidden_notifications (user_id, feed_type, notification_id);
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_user_hidden_notifications_user_feed_created
        ON user_hidden_notifications (user_id, feed_type, created_at DESC);
      `;
    })().catch((error) => {
      hiddenNotificationsSchemaPromise = null;
      throw error;
    });
  }

  return hiddenNotificationsSchemaPromise;
};

export const normalizeHiddenNotificationIds = (ids = []) =>
  Array.isArray(ids)
    ? ids.map((value) => String(value || "").trim()).filter(Boolean)
    : [];

export const ensureHiddenNotificationsUserRow = async (user) => {
  if (!user?.id) {
    throw new Error("Authenticated user is required");
  }

  const fullName = getDisplayNameFallback(user);
  const email = user.email || "";

  await sql`
    INSERT INTO users (id, email, full_name)
    VALUES (${user.id}, ${email}, ${fullName})
    ON CONFLICT (id) DO UPDATE
    SET
      email = COALESCE(NULLIF(EXCLUDED.email, ''), users.email),
      full_name = COALESCE(users.full_name, EXCLUDED.full_name);
  `;
};

export const getHiddenNotificationIds = async ({ userId, feedType }) => {
  await ensureHiddenNotificationsSchema();

  const rows = await sql`
    SELECT notification_id
    FROM user_hidden_notifications
    WHERE user_id = ${userId}
      AND feed_type = ${feedType};
  `;

  return new Set(
    rows.map((row) => String(row?.notification_id || "").trim()).filter(Boolean),
  );
};

export const hideNotifications = async ({
  userId,
  feedType,
  notificationIds = [],
}) => {
  await ensureHiddenNotificationsSchema();

  const normalizedIds = normalizeHiddenNotificationIds(notificationIds);
  if (normalizedIds.length === 0) {
    return [];
  }

  const insertedRows = await sql(
    `
      INSERT INTO user_hidden_notifications (user_id, feed_type, notification_id)
      SELECT $1::uuid, $2::text, value
      FROM unnest($3::text[]) AS value
      ON CONFLICT (user_id, feed_type, notification_id) DO NOTHING
      RETURNING notification_id
    `,
    [userId, feedType, normalizedIds],
  );

  return insertedRows
    .map((row) => String(row?.notification_id || "").trim())
    .filter(Boolean);
};
