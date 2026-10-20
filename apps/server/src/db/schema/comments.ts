import { index, pgTable, text, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './columns';
import { commentStatusEnum } from './enums';
import { logs } from './logs';
import { users } from './users';

export const comments = pgTable(
  'comments',
  {
    id: primaryId(),
    logId: uuid('log_id')
      .notNull()
      .references(() => logs.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Replies are one level deep: a reply's parent is always a top-level comment. */
    parentId: uuid('parent_id').references((): AnyPgColumn => comments.id, {
      onDelete: 'cascade',
    }),
    body: text('body').notNull(),
    status: commentStatusEnum('status').notNull().default('visible'),
    ...timestamps(),
  },
  (t) => [
    index('comments_log_id_created_at_idx').on(t.logId, t.createdAt),
    index('comments_parent_id_idx').on(t.parentId),
    index('comments_author_id_idx').on(t.authorId),
  ],
);

export type CommentRow = typeof comments.$inferSelect;
export type NewCommentRow = typeof comments.$inferInsert;
