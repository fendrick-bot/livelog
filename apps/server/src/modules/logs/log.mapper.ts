import { excerptFrom, type LogSummaryDto, type ReactionCounts } from '@livelog/shared';
import type { LogRow, TagRow } from '../../db/schema';
import { iso, isoOrNull } from '../../lib/dates';
import { toTagDto } from '../tags/tag.mapper';
import { toPublicUser, type PublicUserFields } from '../users/user.mapper';

/** Anything shaped like a log row with its author and tags (detail or list query). */
export type LogSummarySource = Omit<LogRow, 'content'> & {
  content?: string;
  contentPreview?: string;
  author: PublicUserFields;
  logTags: Array<{ tag: TagRow }>;
};

export interface LogCounts {
  comments: number;
  reactions: ReactionCounts;
}

export function toLogSummary(record: LogSummarySource, counts: LogCounts): LogSummaryDto {
  const text = record.content ?? record.contentPreview ?? '';
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    excerpt: record.excerpt ?? (excerptFrom(text) || null),
    status: record.status,
    kind: record.kind,
    coverImageUrl: record.coverImageUrl,
    author: toPublicUser(record.author, record.byline),
    tags: record.logTags.map(({ tag }) => toTagDto(tag)),
    allowComments: record.allowComments,
    allowReactions: record.allowReactions,
    readingMinutes: record.readingMinutes,
    viewCount: record.viewCount,
    commentCount: counts.comments,
    reactionCounts: counts.reactions,
    scheduledFor: isoOrNull(record.scheduledFor),
    liveStartedAt: isoOrNull(record.liveStartedAt),
    liveEndedAt: isoOrNull(record.liveEndedAt),
    publishedAt: isoOrNull(record.publishedAt),
    createdAt: iso(record.createdAt),
    updatedAt: iso(record.updatedAt),
  };
}
