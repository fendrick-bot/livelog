import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from 'drizzle-orm/pg-core';
import type * as schema from './schema';

export type Schema = typeof schema;

/** Driver-agnostic database type: node-postgres in prod, PGlite in tests / zero-setup dev. */
export type Database = PgDatabase<PgQueryResultHKT, Schema>;

export type Transaction = PgTransaction<
  PgQueryResultHKT,
  Schema,
  ExtractTablesWithRelations<Schema>
>;

/** Repositories accept either, so the same code runs inside or outside a transaction. */
export type DbExecutor = Database | Transaction;
