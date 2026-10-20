import { index, pgTable, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps, timestamptz } from './columns';
import { subscriberStatusEnum } from './enums';

/**
 * Email subscribers (double opt-in). `confirmTokenHash` is the SHA-256 of the
 * token emailed for confirmation; `unsubscribeToken` is embedded in every mail.
 */
export const subscribers = pgTable(
  'subscribers',
  {
    id: primaryId(),
    email: varchar('email', { length: 254 }).notNull(),
    status: subscriberStatusEnum('status').notNull().default('pending'),
    confirmTokenHash: varchar('confirm_token_hash', { length: 64 }),
    confirmTokenExpiresAt: timestamptz('confirm_token_expires_at'),
    unsubscribeToken: varchar('unsubscribe_token', { length: 64 }).notNull(),
    confirmedAt: timestamptz('confirmed_at'),
    unsubscribedAt: timestamptz('unsubscribed_at'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('subscribers_email_idx').on(t.email),
    uniqueIndex('subscribers_unsubscribe_token_idx').on(t.unsubscribeToken),
    index('subscribers_confirm_token_hash_idx').on(t.confirmTokenHash),
    index('subscribers_status_idx').on(t.status),
  ],
);

export type SubscriberRow = typeof subscribers.$inferSelect;
export type NewSubscriberRow = typeof subscribers.$inferInsert;
