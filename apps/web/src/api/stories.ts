import type { StoryRequestDto, SubmitStoryInput } from '@livelog/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { qk } from '../lib/query-keys';

export function useMyStories(enabled: boolean) {
  return useQuery({
    queryKey: qk.myStories,
    enabled,
    queryFn: ({ signal }) => api.get<StoryRequestDto[]>('/stories/mine', undefined, signal),
  });
}

export function useSubmitStory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitStoryInput) => api.post<StoryRequestDto>('/stories', input),
    onSuccess: () => client.invalidateQueries({ queryKey: qk.myStories }),
  });
}
