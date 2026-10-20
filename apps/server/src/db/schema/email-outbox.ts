import { index, integer, jsonb, pgTable, text, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamptz } from './columns';
import { emailKindEnum, emailStatusEnum } from './enums';

/**
 * Transactional outbox for emails. Rows are inserted in the same transaction
 * as the change that caused them and delivered by the OutboxWorker, so a
 * crash can never "lose" a go-live notification or send one for a rolled
 * back change.
 */
export const emailOutbox = pgTable(
  'email_outbox',
  {
    id: primaryId(),
    kind: emailKindEnum('kind').notNull(),
    toEmail: varchar('to_email', { length: 254 }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: emailStatusEnum('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    sendAfter: timestamptz('send_after').notNull().defaultNow(),
    lockedAt: timestamptz('locked_at'),
    sentAt: timestamptz('sent_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [index('email_outbox_status_send_after_idx').on(t.status, t.sendAfter)],
);

export type EmailOutboxRow = typeof emailOutbox.$inferSelect;
export type NewEmailOutboxRow = typeof emailOutbox.$inferInsert;
