import { index, pgTable, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamptz } from './columns';
import { users } from './users';

/**
 * One row per signed-in device. Holds the SHA-256 of the current refresh
 * token (rotated on every refresh) and the previous one for reuse detection.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    previousTokenHash: varchar('previous_token_hash', { length: 64 }),
    rotatedAt: timestamptz('rotated_at'),
    userAgent: varchar('user_agent', { length: 512 }),
    ip: varchar('ip', { length: 64 }),
    expiresAt: timestamptz('expires_at').notNull(),
    lastUsedAt: timestamptz('last_used_at').notNull().defaultNow(),
    revokedAt: timestamptz('revoked_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('sessions_token_hash_idx').on(t.tokenHash),
    index('sessions_previous_token_hash_idx').on(t.previousTokenHash),
    index('sessions_user_id_idx').on(t.userId),
  ],
);

export type SessionRow = typeof sessions.$inferSelect;
export type NewSessionRow = typeof sessions.$inferInsert;
