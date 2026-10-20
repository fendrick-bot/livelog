import { z } from 'zod';
import { REACTION_TYPES } from '../constants';

export const reactionParams = z.object({
  logId: z.uuid(),
  type: z.enum(REACTION_TYPES),
});
export type ReactionParams = z.infer<typeof reactionParams>;
