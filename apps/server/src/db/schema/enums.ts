import { pgEnum } from 'drizzle-orm/pg-core';
import {
  COMMENT_STATUSES,
  LOG_KINDS,
  LOG_STATUSES,
  REACTION_TYPES,
  ROLES,
  STORY_MOODS,
  STORY_STATUSES,
  SUBSCRIBER_STATUSES,
} from '@livelog/shared';

// Values come from @livelog/shared so the database, API and UI cannot drift.
export const roleEnum = pgEnum('user_role', ROLES);
export const logStatusEnum = pgEnum('log_status', LOG_STATUSES);
export const logKindEnum = pgEnum('log_kind', LOG_KINDS);
export const reactionTypeEnum = pgEnum('reaction_type', REACTION_TYPES);
export const commentStatusEnum = pgEnum('comment_status', COMMENT_STATUSES);
export const storyStatusEnum = pgEnum('story_status', STORY_STATUSES);
export const storyMoodEnum = pgEnum('story_mood', STORY_MOODS);
export const subscriberStatusEnum = pgEnum('subscriber_status', SUBSCRIBER_STATUSES);

// Server-only enums.
export const EMAIL_KINDS = ['subscribe_confirm', 'live_started', 'story_reviewed'] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];
export const emailKindEnum = pgEnum('email_kind', EMAIL_KINDS);

export const EMAIL_STATUSES = ['pending', 'sending', 'sent', 'failed'] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];
export const emailStatusEnum = pgEnum('email_status', EMAIL_STATUSES);
