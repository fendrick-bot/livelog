import { pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamptz } from './columns';
import { reactionTypeEnum } from './enums';
import { logs } from './logs';
import { users } from './users';

/** A user can leave each reaction type once per log (toggle semantics). */
export const reactions = pgTable(
  'reactions',
  {
    id: primaryId(),
    logId: uuid('log_id')
      .notNull()
      .references(() => logs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: reactionTypeEnum('type').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('reactions_log_user_type_idx').on(t.logId, t.userId, t.type)],
);

export type ReactionRow = typeof reactions.$inferSelect;
