import type { AdminCommentDto, CommentDto } from '@livelog/shared';
import type { CommentRow, LogRow } from '../../db/schema';
import { iso } from '../../lib/dates';
import { toPublicUser, type PublicUserFields } from '../users/user.mapper';

type CommentSource = CommentRow & { author: PublicUserFields };

export function toCommentDto(row: CommentSource, replies: CommentDto[] = []): CommentDto {
  return {
    id: row.id,
    logId: row.logId,
    parentId: row.parentId,
    body: row.body,
    status: row.status,
    author: toPublicUser(row.author),
    createdAt: iso(row.createdAt),
    replies,
  };
}

export function toAdminCommentDto(
  row: CommentSource & { log: Pick<LogRow, 'id' | 'title' | 'slug'> },
): AdminCommentDto {
  return {
    ...toCommentDto(row),
    log: { id: row.log.id, title: row.log.title, slug: row.log.slug },
  };
}
