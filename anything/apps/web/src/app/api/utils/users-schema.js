import sql from '@/app/api/utils/sql';

let usersSchemaPromise = null;
const PLACEHOLDER_EMAIL_DOMAIN = 'placeholder.parkmate.local';

export const ensureUsersSchema = () => {
  if (!usersSchemaPromise) {
    usersSchemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          full_name TEXT,
          contribution_score INTEGER NOT NULL DEFAULT 0,
          trust_score INTEGER NOT NULL DEFAULT 100,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `;

      await sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS full_name TEXT;
      `;

      await sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS contribution_score INTEGER NOT NULL DEFAULT 0;
      `;

      await sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS trust_score INTEGER NOT NULL DEFAULT 100;
      `;

      await sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
      `;
    })().catch((error) => {
      usersSchemaPromise = null;
      throw error;
    });
  }

  return usersSchemaPromise;
};

export const getDisplayNameFallback = (user) => {
  const metadataName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    null;

  if (metadataName) {
    return metadataName;
  }

  const email = typeof user?.email === 'string' ? user.email.trim() : '';
  const [localPart] = email.split('@');
  return localPart || null;
};

export const getPlaceholderUserEmail = (userId) =>
  `${String(userId || '').trim()}@${PLACEHOLDER_EMAIL_DOMAIN}`;

export const upsertUserRow = async ({
  id,
  email = '',
  fullName = null,
}) => {
  const userId = String(id || '').trim();
  if (!userId) {
    throw new Error('User id is required');
  }

  await ensureUsersSchema();

  const normalizedEmail = typeof email === 'string' ? email.trim() : '';
  const effectiveEmail = normalizedEmail || getPlaceholderUserEmail(userId);
  const placeholderEmailPattern = `%@${PLACEHOLDER_EMAIL_DOMAIN}`;

  await sql`
    INSERT INTO users (id, email, full_name)
    VALUES (${userId}, ${effectiveEmail}, ${fullName || null})
    ON CONFLICT (id) DO UPDATE
    SET
      email = CASE
        WHEN ${normalizedEmail || null} IS NOT NULL
          AND (
            users.email IS NULL
            OR users.email = ''
            OR users.email LIKE ${placeholderEmailPattern}
          )
        THEN ${normalizedEmail}
        ELSE users.email
      END,
      full_name = COALESCE(users.full_name, EXCLUDED.full_name);
  `;
};

export const ensureUserRow = async (user) =>
  upsertUserRow({
    id: user?.id,
    email: user?.email || '',
    fullName: getDisplayNameFallback(user),
  });

export const ensureUserIdRow = async (userId) =>
  upsertUserRow({
    id: userId,
    email: '',
    fullName: null,
  });
