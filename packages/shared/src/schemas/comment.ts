import { z } from 'zod';
import { COMMENT_STATUSES, LIMITS } from '../constants';
import { paginationQuery } from './common';

export const createCommentInput = z.object({
  body: z
    .string()
    .trim()
    .min(LIMITS.comment.min, 'Write something first')
    .max(LIMITS.comment.max, `Keep it under ${LIMITS.comment.max} characters`),
  parentId: z.uuid().nullish(),
});
export type CreateCommentInput = z.infer<typeof createCommentInput>;

export const moderateCommentInput = z.object({ status: z.enum(COMMENT_STATUSES) });
export type ModerateCommentInput = z.infer<typeof moderateCommentInput>;

export const listCommentsQuery = paginationQuery;

export const adminListCommentsQuery = paginationQuery.extend({
  status: z.enum(COMMENT_STATUSES).optional(),
  logId: z.uuid().optional(),
});
export type AdminListCommentsQuery = z.infer<typeof adminListCommentsQuery>;
