import type { LogDetailDto, ReactionStateDto, ReactionType } from '@livelog/shared';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryClient } from '../lib/query-client';
import { qk } from '../lib/query-keys';

/** Optimistic toggle: the stamp lights up instantly, the server confirms the counts. */
export function useToggleReaction(log: Pick<LogDetailDto, 'id' | 'slug'>) {
  const key = qk.log(log.slug);
  return useMutation({
    mutationFn: ({ type, active }: { type: ReactionType; active: boolean }) =>
      active
        ? api.put<ReactionStateDto>(`/logs/${log.id}/reactions/${type}`)
        : api.delete<ReactionStateDto>(`/logs/${log.id}/reactions/${type}`),
    onMutate: async ({ type, active }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<LogDetailDto>(key);
      if (previous) {
        const already = previous.viewerReactions.includes(type);
        if (already !== active) {
          queryClient.setQueryData<LogDetailDto>(key, {
            ...previous,
            viewerReactions: active
              ? [...previous.viewerReactions, type]
              : previous.viewerReactions.filter((item) => item !== type),
            reactionCounts: {
              ...previous.reactionCounts,
              [type]: Math.max(0, previous.reactionCounts[type] + (active ? 1 : -1)),
            },
          });
        }
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (state) => {
      queryClient.setQueryData<LogDetailDto>(key, (current) =>
        current
          ? { ...current, reactionCounts: state.counts, viewerReactions: state.viewerReactions }
          : current,
      );
    },
  });
}
