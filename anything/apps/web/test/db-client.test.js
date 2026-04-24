import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDatabasePool, getDatabaseUrl, parseDatabaseUrl } from '../db/client.js';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe('db client env handling', () => {
  it('returns null for placeholder or malformed database urls', async () => {
    process.env.DATABASE_URL = 'postgres://USER:PASSWORD@HOST:PORT/DATABASE';

    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(parseDatabaseUrl(process.env.DATABASE_URL)).toBeNull();
    expect(getDatabaseUrl()).toBeNull();
    expect(consoleWarn).toHaveBeenCalledOnce();
  });

  it('prefers the first valid configured database url', async () => {
    process.env.DATABASE_POOLER_URL = 'postgres://USER:PASSWORD@HOST:PORT/DATABASE';
    process.env.DATABASE_URL = 'postgres://postgres:secret@127.0.0.1:5432/parkmate';

    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(parseDatabaseUrl(process.env.DATABASE_URL)?.toString()).toBe(
      'postgres://postgres:secret@127.0.0.1:5432/parkmate',
    );
    expect(getDatabaseUrl()).toBe('postgres://postgres:secret@127.0.0.1:5432/parkmate');
    expect(consoleWarn).not.toHaveBeenCalledWith(
      expect.stringContaining('DATABASE_URL=postgres://postgres:secret@127.0.0.1:5432/parkmate'),
      expect.anything(),
    );
  });

  it('throws a clear error when creating a pool with an invalid database url', async () => {
    expect(() => createDatabasePool('postgres://USER:PASSWORD@HOST:PORT/DATABASE')).toThrow(
      'A valid DATABASE_URL is required to create a database pool.',
    );
  });
});
