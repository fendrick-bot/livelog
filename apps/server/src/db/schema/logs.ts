import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { primaryId, timestamps, timestamptz } from './columns';
import { logKindEnum, logStatusEnum } from './enums';
import { users } from './users';

/**
 * A "log" is a diary entry. It can be written privately (draft), announced
 * (scheduled), streamed while being typed (live) and finally published.
 */
export const logs = pgTable(
  'logs',
  {
    id: primaryId(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    kind: logKindEnum('kind').notNull().default('author'),
    status: logStatusEnum('status').notNull().default('draft'),
    title: varchar('title', { length: 160 }).notNull(),
    slug: varchar('slug', { length: 200 }).notNull(),
    excerpt: varchar('excerpt', { length: 300 }),
    content: text('content').notNull().default(''),
    coverImageUrl: text('cover_image_url'),
    /** Overrides the author's display name, e.g. "Anonymous" for community stories. */
    byline: varchar('byline', { length: 60 }),
    allowComments: boolean('allow_comments').notNull().default(true),
    allowReactions: boolean('allow_reactions').notNull().default(true),
    readingMinutes: integer('reading_minutes').notNull().default(1),
    viewCount: integer('view_count').notNull().default(0),
    scheduledFor: timestamptz('scheduled_for'),
    liveStartedAt: timestamptz('live_started_at'),
    liveEndedAt: timestamptz('live_ended_at'),
    publishedAt: timestamptz('published_at'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('logs_slug_idx').on(t.slug),
    index('logs_status_published_at_idx').on(t.status, t.publishedAt),
    index('logs_kind_status_idx').on(t.kind, t.status),
    index('logs_author_id_idx').on(t.authorId),
    index('logs_scheduled_for_idx')
      .on(t.scheduledFor)
      .where(sql`status = 'scheduled'`),
    // At most one entry can be streaming at any moment.
    uniqueIndex('logs_single_live_idx')
      .on(t.status)
      .where(sql`status = 'live'`),
  ],
);

export type LogRow = typeof logs.$inferSelect;
export type NewLogRow = typeof logs.$inferInsert;
