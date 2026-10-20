import { boolean, index, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps, timestamptz } from './columns';
import { storyMoodEnum, storyStatusEnum } from './enums';
import { logs } from './logs';
import { users } from './users';

/** A reader's request to have their own story published in the community section. */
export const storyRequests = pgTable(
  'story_requests',
  {
    id: primaryId(),
    submitterId: uuid('submitter_id').references(() => users.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 160 }).notNull(),
    pitch: varchar('pitch', { length: 600 }).notNull(),
    content: text('content').notNull(),
    mood: storyMoodEnum('mood'),
    isAnonymous: boolean('is_anonymous').notNull().default(false),
    contactEmail: varchar('contact_email', { length: 254 }),
    status: storyStatusEnum('status').notNull().default('pending'),
    adminNote: varchar('admin_note', { length: 1000 }),
    reviewedById: uuid('reviewed_by_id').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamptz('reviewed_at'),
    publishedLogId: uuid('published_log_id').references(() => logs.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [
    index('story_requests_status_created_at_idx').on(t.status, t.createdAt),
    index('story_requests_submitter_id_idx').on(t.submitterId),
  ],
);

export type StoryRequestRow = typeof storyRequests.$inferSelect;
export type NewStoryRequestRow = typeof storyRequests.$inferInsert;
