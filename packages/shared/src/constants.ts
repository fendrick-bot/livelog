/**
 * Domain enums. These tuples are the single source of truth: the database
 * enums (server/db/schema/enums.ts), zod schemas and UI all derive from them.
 */

export const ROLES = ['admin', 'reader'] as const;
export type Role = (typeof ROLES)[number];

export const LOG_STATUSES = ['draft', 'scheduled', 'live', 'published', 'archived'] as const;
export type LogStatus = (typeof LOG_STATUSES)[number];

/** Statuses a non-admin visitor is allowed to see. */
export const PUBLIC_LOG_STATUSES = ['live', 'published'] as const satisfies readonly LogStatus[];

/** `author` = written by the diarist, `community` = an accepted reader story. */
export const LOG_KINDS = ['author', 'community'] as const;
export type LogKind = (typeof LOG_KINDS)[number];

export const REACTION_TYPES = ['like', 'love', 'inspired', 'moved'] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export const REACTION_META: Record<ReactionType, { emoji: string; label: string }> = {
  like: { emoji: '👍', label: 'Like' },
  love: { emoji: '❤️', label: 'Love' },
  inspired: { emoji: '✨', label: 'Inspired' },
  moved: { emoji: '🥹', label: 'Moved' },
};

export const COMMENT_STATUSES = ['visible', 'hidden'] as const;
export type CommentStatus = (typeof COMMENT_STATUSES)[number];

export const STORY_STATUSES = ['pending', 'accepted', 'rejected'] as const;
export type StoryStatus = (typeof STORY_STATUSES)[number];

export const STORY_MOODS = [
  'hopeful',
  'nostalgic',
  'grateful',
  'heartbroken',
  'curious',
  'brave',
] as const;
export type StoryMood = (typeof STORY_MOODS)[number];

export const SUBSCRIBER_STATUSES = ['pending', 'active', 'unsubscribed'] as const;
export type SubscriberStatus = (typeof SUBSCRIBER_STATUSES)[number];

export const LIMITS = {
  email: { max: 254 },
  displayName: { min: 2, max: 60 },
  password: { min: 8, max: 128 },
  title: { min: 1, max: 160 },
  excerpt: { max: 300 },
  content: { max: 200_000 },
  comment: { min: 1, max: 2_000 },
  tagName: { min: 1, max: 40 },
  tagsPerLog: 10,
  storyTitle: { min: 4, max: 160 },
  storyPitch: { min: 20, max: 600 },
  storyContent: { min: 200, max: 50_000 },
  adminNote: { max: 1_000 },
  pageSize: { default: 12, max: 50 },
} as const;

/**
 * Allowed log status transitions. Enforced by the server (LogService) and
 * used by the admin UI to decide which actions to show.
 */
export const LOG_TRANSITIONS: Record<LogStatus, readonly LogStatus[]> = {
  draft: ['scheduled', 'live', 'published', 'archived'],
  scheduled: ['draft', 'live', 'published', 'archived'],
  live: ['published', 'draft'],
  published: ['draft', 'live', 'archived'],
  archived: ['draft', 'published'],
};

export function canTransition(from: LogStatus, to: LogStatus): boolean {
  return LOG_TRANSITIONS[from].includes(to);
}

export function isPublicStatus(status: LogStatus): boolean {
  return (PUBLIC_LOG_STATUSES as readonly LogStatus[]).includes(status);
}
