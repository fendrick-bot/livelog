import type { CommentDto, CreateCommentInput, Paginated } from '@livelog/shared';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryClient } from '../lib/query-client';
import { qk } from '../lib/query-keys';

type CommentPages = InfiniteData<Paginated<CommentDto>, number>;

export function useComments(logId: string | undefined) {
  return useInfiniteQuery({
    queryKey: qk.comments(logId ?? 'none'),
    enabled: Boolean(logId),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      api.get<Paginated<CommentDto>>(
        `/logs/${logId}/comments`,
        { page: pageParam, pageSize: 20 },
        signal,
      ),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}

/** Insert a comment into the cached pages (used by both the mutation and the socket). */
export function addCommentToCache(comment: CommentDto) {
  queryClient.setQueryData<CommentPages>(qk.comments(comment.logId), (data) => {
    if (!data) return data;
    const exists = data.pages.some((page) =>
      page.items.some(
        (item) => item.id === comment.id || item.replies.some((reply) => reply.id === comment.id),
      ),
    );
    if (exists) return data;
    const pages = data.pages.map((page, index) => {
      if (comment.parentId) {
        return {
          ...page,
          items: page.items.map((item) =>
            item.id === comment.parentId ? { ...item, replies: [...item.replies, comment] } : item,
          ),
        };
      }
      return index === 0
        ? { ...page, items: [comment, ...page.items], total: page.total + 1 }
        : page;
    });
    return { ...data, pages };
  });
}

export function removeCommentFromCache(logId: string, commentId: string) {
  queryClient.setQueryData<CommentPages>(qk.comments(logId), (data) => {
    if (!data) return data;
    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        items: page.items
          .filter((item) => item.id !== commentId)
          .map((item) => ({
            ...item,
            replies: item.replies.filter((reply) => reply.id !== commentId),
          })),
      })),
    };
  });
}

export function useCreateComment(logId: string) {
  return useMutation({
    mutationFn: (input: CreateCommentInput) =>
      api.post<CommentDto>(`/logs/${logId}/comments`, input),
    onSuccess: addCommentToCache,
  });
}

export function useDeleteComment(logId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => api.delete(`/comments/${commentId}`),
    onSuccess: (_data, commentId) => {
      removeCommentFromCache(logId, commentId);
      void client.invalidateQueries({ queryKey: ['admin', 'comments'] });
    },
    meta: { success: 'Note removed.' },
  });
}
