import sql from '@/app/api/utils/sql';

let usersSchemaPromise = null;

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
