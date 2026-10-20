import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import type { Config } from '../config/env';
import type { Logger } from '../lib/logger';
import * as schema from './schema';
import type { Database } from './types';

export interface DatabaseHandle {
  db: Database;
  driver: Config['db']['driver'];
  migrate: () => Promise<void>;
  ping: () => Promise<boolean>;
  close: () => Promise<void>;
}

/** Walks up from this file until it finds the drizzle/ migrations folder (works from src and dist). */
export function findMigrationsFolder(start = dirname(fileURLToPath(import.meta.url))): string {
  let dir = start;
  for (let depth = 0; depth < 6; depth++) {
    const candidate = join(dir, 'drizzle');
    if (existsSync(join(candidate, 'meta', '_journal.json'))) return candidate;
    dir = resolve(dir, '..');
  }
  throw new Error('Could not locate the drizzle migrations folder');
}

export async function createDatabase(
  config: Pick<Config, 'db'>,
  logger?: Logger,
): Promise<DatabaseHandle> {
  const migrationsFolder = findMigrationsFolder();

  if (config.db.driver === 'pglite') {
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle } = await import('drizzle-orm/pglite');
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    const dataDir = config.db.pgliteDir === 'memory' ? undefined : resolve(config.db.pgliteDir);
    const client = new PGlite(dataDir);
    const db = drizzle(client, { schema });
    logger?.info({ dataDir: dataDir ?? 'in-memory' }, 'using embedded PGlite database');
    return {
      db: db as unknown as Database,
      driver: 'pglite',
      migrate: () => migrate(db, { migrationsFolder }),
      ping: async () => {
        await db.execute(sql`select 1`);
        return true;
      },
      close: () => client.close(),
    };
  }

  const { default: pg } = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const { migrate } = await import('drizzle-orm/node-postgres/migrator');
  const pool = new pg.Pool({
    connectionString: config.db.url,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  pool.on('error', (error) => logger?.error({ err: error }, 'idle postgres client error'));
  const db = drizzle(pool, { schema });
  return {
    db: db as unknown as Database,
    driver: 'pg',
    migrate: () => migrate(db, { migrationsFolder }),
    ping: async () => {
      await db.execute(sql`select 1`);
      return true;
    },
    close: () => pool.end(),
  };
}
