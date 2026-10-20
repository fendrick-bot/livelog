import { REACTION_TYPES, type ReactionCounts } from '@livelog/shared';

export function emptyReactionCounts(): ReactionCounts {
  return Object.fromEntries(REACTION_TYPES.map((type) => [type, 0])) as ReactionCounts;
}
