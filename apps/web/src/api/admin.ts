import type {
  AcceptStoryInput,
  AdminCommentDto,
  AdminStatsDto,
  CommentDto,
  CommentStatus,
  CreateLogInput,
  EndLiveInput,
  LiveSessionDto,
  LogDetailDto,
  LogSummaryDto,
  Paginated,
  StoryRequestDto,
  SubscriberDto,
  TagDto,
  UpdateLogInput,
} from '@livelog/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Query } from '../lib/api';
import { queryClient } from '../lib/query-client';
import { qk } from '../lib/query-keys';

// ── Dashboard & history ────────────────────────────────────────────────────
export function useAdminStats() {
  return useQuery({
    queryKey: qk.admin.stats,
    queryFn: ({ signal }) => api.get<AdminStatsDto>('/admin/stats', undefined, signal),
  });
}

export function useLiveHistory(page: number) {
  return useQuery({
    queryKey: qk.admin.history(page),
    queryFn: ({ signal }) =>
      api.get<Paginated<LiveSessionDto>>('/admin/live-sessions', { page, pageSize: 20 }, signal),
    placeholderData: keepPreviousData,
  });
}

// ── Logs ───────────────────────────────────────────────────────────────────
export function useAdminLogs(params: Query) {
  return useQuery({
    queryKey: qk.admin.logs(params),
    queryFn: ({ signal }) => api.get<Paginated<LogSummaryDto>>('/admin/logs', params, signal),
    placeholderData: keepPreviousData,
  });
}

export function useAdminLog(id: string) {
  return useQuery({
    queryKey: qk.admin.log(id),
    queryFn: ({ signal }) => api.get<LogDetailDto>(`/admin/logs/${id}`, undefined, signal),
    staleTime: 0,
  });
}

/** After any log write: refresh lists, stats and public views; keep the detail cache exact. */
function syncLog(log: LogDetailDto) {
  queryClient.setQueryData(qk.admin.log(log.id), log);
  void queryClient.invalidateQueries({ queryKey: ['admin', 'logs'] });
  void queryClient.invalidateQueries({ queryKey: qk.admin.stats });
  void queryClient.invalidateQueries({ queryKey: qk.logsAll });
  void queryClient.invalidateQueries({ queryKey: qk.liveStatus });
}

export function useCreateLog() {
  return useMutation({
    mutationFn: (input: CreateLogInput) => api.post<LogDetailDto>('/admin/logs', input),
    onSuccess: syncLog,
  });
}

export function useUpdateLog(id: string, options: { silent?: boolean } = {}) {
  return useMutation({
    mutationFn: (input: UpdateLogInput) => api.patch<LogDetailDto>(`/admin/logs/${id}`, input),
    onSuccess: syncLog,
    meta: options.silent ? { silent: true } : undefined,
  });
}

export function useDeleteLog() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/logs/${id}`),
    onSuccess: (_data, id) => {
      client.removeQueries({ queryKey: qk.admin.log(id) });
      void client.invalidateQueries({ queryKey: ['admin'] });
      void client.invalidateQueries({ queryKey: qk.logsAll });
    },
    meta: { success: 'Entry torn out of the diary.' },
  });
}

export type LogAction = 'publish' | 'unpublish' | 'archive' | 'unschedule' | 'go-live';

export function useLogAction(id: string) {
  return useMutation({
    mutationFn: (action: LogAction) => api.post<LogDetailDto>(`/admin/logs/${id}/${action}`),
    onSuccess: syncLog,
  });
}

export function useScheduleLog(id: string) {
  return useMutation({
    mutationFn: (scheduledFor: string) =>
      api.post<LogDetailDto>(`/admin/logs/${id}/schedule`, { scheduledFor }),
    onSuccess: syncLog,
    meta: { success: 'Scheduled. Readers will see a countdown.' },
  });
}

export function useEndLive(id: string) {
  return useMutation({
    mutationFn: (input: EndLiveInput) =>
      api.post<LogDetailDto>(`/admin/logs/${id}/end-live`, input),
    onSuccess: (log) => {
      syncLog(log);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'history'] });
    },
  });
}

// ── Tags ───────────────────────────────────────────────────────────────────
export function useAdminTags() {
  return useQuery({
    queryKey: qk.admin.tags,
    queryFn: ({ signal }) => api.get<TagDto[]>('/admin/tags', undefined, signal),
  });
}

function invalidateTags() {
  void queryClient.invalidateQueries({ queryKey: qk.admin.tags });
  void queryClient.invalidateQueries({ queryKey: qk.tags });
}

export function useCreateTag() {
  return useMutation({
    mutationFn: (name: string) => api.post<TagDto>('/admin/tags', { name }),
    onSuccess: invalidateTags,
  });
}

export function useRenameTag() {
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.patch<TagDto>(`/admin/tags/${id}`, { name }),
    onSuccess: invalidateTags,
    meta: { success: 'Tag renamed.' },
  });
}

export function useDeleteTag() {
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/tags/${id}`),
    onSuccess: invalidateTags,
    meta: { success: 'Tag removed.' },
  });
}

// ── Comments ───────────────────────────────────────────────────────────────
export function useAdminComments(params: Query) {
  return useQuery({
    queryKey: qk.admin.comments(params),
    queryFn: ({ signal }) => api.get<Paginated<AdminCommentDto>>('/admin/comments', params, signal),
    placeholderData: keepPreviousData,
  });
}

export function useModerateComment() {
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: CommentStatus }) =>
      api.patch<CommentDto>(`/admin/comments/${id}`, { status }),
    onSuccess: (comment) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'comments'] });
      void queryClient.invalidateQueries({ queryKey: qk.comments(comment.logId) });
    },
  });
}

export function useAdminDeleteComment() {
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/comments/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'comments'] }),
    meta: { success: 'Comment deleted.' },
  });
}

// ── Stories ────────────────────────────────────────────────────────────────
export function useAdminStories(params: Query) {
  return useQuery({
    queryKey: qk.admin.stories(params),
    queryFn: ({ signal }) => api.get<Paginated<StoryRequestDto>>('/admin/stories', params, signal),
    placeholderData: keepPreviousData,
  });
}

function afterReview() {
  void queryClient.invalidateQueries({ queryKey: ['admin', 'stories'] });
  void queryClient.invalidateQueries({ queryKey: qk.admin.stats });
  void queryClient.invalidateQueries({ queryKey: qk.logsAll });
}

export function useAcceptStory() {
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AcceptStoryInput }) =>
      api.post<StoryRequestDto>(`/admin/stories/${id}/accept`, input),
    onSuccess: afterReview,
    meta: { success: 'Published in “Other diaries”. The writer has been emailed.' },
  });
}

export function useRejectStory() {
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      api.post<StoryRequestDto>(`/admin/stories/${id}/reject`, { note }),
    onSuccess: afterReview,
    meta: { success: 'Story declined. The writer has been emailed kindly.' },
  });
}

// ── Subscribers ────────────────────────────────────────────────────────────
export function useAdminSubscribers(params: Query) {
  return useQuery({
    queryKey: qk.admin.subscribers(params),
    queryFn: ({ signal }) =>
      api.get<Paginated<SubscriberDto>>('/admin/subscribers', params, signal),
    placeholderData: keepPreviousData,
  });
}

export function useRemoveSubscriber() {
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/subscribers/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'subscribers'] });
      void queryClient.invalidateQueries({ queryKey: qk.admin.stats });
    },
    meta: { success: 'Subscriber removed.' },
  });
}
