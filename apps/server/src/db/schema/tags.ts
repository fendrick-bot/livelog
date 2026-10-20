import { index, pgTable, primaryKey, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps, timestamptz } from './columns';
import { logs } from './logs';

export const tags = pgTable(
  'tags',
  {
    id: primaryId(),
    name: varchar('name', { length: 40 }).notNull(),
    slug: varchar('slug', { length: 60 }).notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex('tags_slug_idx').on(t.slug)],
);

export const logTags = pgTable(
  'log_tags',
  {
    logId: uuid('log_id')
      .notNull()
      .references(() => logs.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.logId, t.tagId] }), index('log_tags_tag_id_idx').on(t.tagId)],
);

export type TagRow = typeof tags.$inferSelect;
export type NewTagRow = typeof tags.$inferInsert;
