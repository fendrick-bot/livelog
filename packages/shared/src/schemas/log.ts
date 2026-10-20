import { z } from 'zod';
import { LIMITS, LOG_KINDS, LOG_STATUSES } from '../constants';
import { paginationQuery, searchTerm } from './common';

const fields = {
  title: z.string().trim().min(LIMITS.title.min, 'Give this entry a title').max(LIMITS.title.max),
  content: z.string().max(LIMITS.content.max),
  excerpt: z.string().trim().max(LIMITS.excerpt.max).nullable(),
  coverImageUrl: z.url().max(2048).nullable(),
  tagIds: z.array(z.uuid()).max(LIMITS.tagsPerLog, `At most ${LIMITS.tagsPerLog} tags`),
  allowComments: z.boolean(),
  allowReactions: z.boolean(),
};

/** Defaults are applied by LogService, not by the schema, so create/update stay symmetric. */
export const createLogInput = z.object({
  title: fields.title,
  content: fields.content.optional(),
  excerpt: fields.excerpt.optional(),
  coverImageUrl: fields.coverImageUrl.optional(),
  tagIds: fields.tagIds.optional(),
  allowComments: fields.allowComments.optional(),
  allowReactions: fields.allowReactions.optional(),
});
export type CreateLogInput = z.infer<typeof createLogInput>;

export const updateLogInput = z.object(fields).partial();
export type UpdateLogInput = z.infer<typeof updateLogInput>;

export const scheduleLiveInput = z.object({
  scheduledFor: z.iso
    .datetime({ offset: true })
    .refine(
      (value) => new Date(value).getTime() > Date.now() - 60_000,
      'Pick a time in the future',
    ),
});
export type ScheduleLiveInput = z.infer<typeof scheduleLiveInput>;

export const endLiveInput = z.object({ publish: z.boolean().default(true) });
export type EndLiveInput = z.infer<typeof endLiveInput>;

export const listLogsQuery = paginationQuery.extend({
  kind: z.enum(LOG_KINDS).optional(),
  tag: z.string().trim().max(60).optional(),
  q: searchTerm.optional(),
});
export type ListLogsQuery = z.infer<typeof listLogsQuery>;

export const adminListLogsQuery = listLogsQuery.extend({
  status: z.enum(LOG_STATUSES).optional(),
});
export type AdminListLogsQuery = z.infer<typeof adminListLogsQuery>;
