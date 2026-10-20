import { z } from 'zod';
import { LIMITS, STORY_MOODS, STORY_STATUSES } from '../constants';
import { emailSchema, paginationQuery } from './common';

export const submitStoryInput = z.object({
  title: z
    .string()
    .trim()
    .min(LIMITS.storyTitle.min, 'A few more words for the title')
    .max(LIMITS.storyTitle.max),
  pitch: z
    .string()
    .trim()
    .min(LIMITS.storyPitch.min, 'Tell us a little more (at least 20 characters)')
    .max(LIMITS.storyPitch.max),
  content: z
    .string()
    .trim()
    .min(LIMITS.storyContent.min, `Stories need at least ${LIMITS.storyContent.min} characters`)
    .max(LIMITS.storyContent.max),
  mood: z.enum(STORY_MOODS).nullish(),
  isAnonymous: z.boolean().default(false),
  contactEmail: emailSchema.nullish(),
  consent: z.literal(true, { error: 'Please confirm we may publish your story' }),
});
export type SubmitStoryInput = z.infer<typeof submitStoryInput>;

export const acceptStoryInput = z.object({
  title: z.string().trim().min(LIMITS.title.min).max(LIMITS.title.max).optional(),
  content: z.string().trim().min(1).max(LIMITS.content.max).optional(),
  tagIds: z.array(z.uuid()).max(LIMITS.tagsPerLog).optional(),
  note: z.string().trim().max(LIMITS.adminNote.max).optional(),
});
export type AcceptStoryInput = z.infer<typeof acceptStoryInput>;

export const rejectStoryInput = z.object({
  note: z.string().trim().max(LIMITS.adminNote.max).optional(),
});
export type RejectStoryInput = z.infer<typeof rejectStoryInput>;

export const listStoriesQuery = paginationQuery.extend({
  status: z.enum(STORY_STATUSES).optional(),
});
export type ListStoriesQuery = z.infer<typeof listStoriesQuery>;
