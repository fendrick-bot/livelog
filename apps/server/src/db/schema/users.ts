import { pgTable, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps, timestamptz } from './columns';
import { roleEnum } from './enums';

export const users = pgTable(
  'users',
  {
    id: primaryId(),
    /** Always stored lower-cased (normalised by the shared zod emailSchema). */
    email: varchar('email', { length: 254 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    displayName: varchar('display_name', { length: 60 }).notNull(),
    role: roleEnum('role').notNull().default('reader'),
    avatarUrl: text('avatar_url'),
    lastLoginAt: timestamptz('last_login_at'),
    ...timestamps(),
  },
  (t) => [uniqueIndex('users_email_idx').on(t.email)],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
