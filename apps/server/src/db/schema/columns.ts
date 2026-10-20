import { timestamp, uuid } from 'drizzle-orm/pg-core';

/** Fresh builders per table: column builders must never be shared between tables. */
export const primaryId = () => uuid('id').primaryKey().defaultRandom();

export const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const timestamps = () => ({
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
