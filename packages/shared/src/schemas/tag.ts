import { z } from 'zod';
import { LIMITS } from '../constants';

export const tagInput = z.object({
  name: z.string().trim().min(LIMITS.tagName.min, 'Name the tag').max(LIMITS.tagName.max),
});
export type TagInput = z.infer<typeof tagInput>;
