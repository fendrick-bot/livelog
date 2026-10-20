import { index, integer, pgTable, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamptz } from './columns';
import { logs } from './logs';
import { users } from './users';

/** One row per broadcast. Powers the admin "history" of live logs. */
export const liveSessions = pgTable(
  'live_sessions',
  {
    id: primaryId(),
    logId: uuid('log_id')
      .notNull()
      .references(() => logs.id, { onDelete: 'cascade' }),
    startedById: uuid('started_by_id').references(() => users.id, { onDelete: 'set null' }),
    startedAt: timestamptz('started_at').notNull().defaultNow(),
    endedAt: timestamptz('ended_at'),
    peakViewers: integer('peak_viewers').notNull().default(0),
    notifiedSubscribers: integer('notified_subscribers').notNull().default(0),
  },
  (t) => [
    index('live_sessions_log_id_idx').on(t.logId),
    index('live_sessions_started_at_idx').on(t.startedAt),
  ],
);

export type LiveSessionRow = typeof liveSessions.$inferSelect;
