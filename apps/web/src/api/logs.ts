import type {
  LiveStatusDto,
  LogDetailDto,
  LogKind,
  LogSummaryDto,
  Paginated,
  TagDto,
} from '@livelog/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryClient } from '../lib/query-client';
import { qk } from '../lib/query-keys';

export interface LogListParams {
  kind?: LogKind;
  tag?: string;
  q?: string;
  page?: number;
  pageSize?: number;
  [key: string]: string | number | undefined;
}

export function useLogs(params: LogListParams) {
  return useQuery({
    queryKey: qk.logs(params),
    queryFn: ({ signal }) => api.get<Paginated<LogSummaryDto>>('/logs', params, signal),
    placeholderData: keepPreviousData,
  });
}

const fetchLog = (slug: string, signal?: AbortSignal) =>
  api.get<LogDetailDto>(`/logs/${encodeURIComponent(slug)}`, undefined, signal);

export function useLog(slug: string) {
  return useQuery({
    queryKey: qk.log(slug),
    queryFn: ({ signal }) => fetchLog(slug, signal),
    staleTime: 10_000,
  });
}

/** Warm the cache on hover/focus so opening an entry feels instant. */
export function prefetchLog(slug: string) {
  void queryClient.prefetchQuery({
    queryKey: qk.log(slug),
    queryFn: () => fetchLog(slug),
    staleTime: 10_000,
  });
}

export function useLiveStatusQuery() {
  return useQuery({
    queryKey: qk.liveStatus,
    queryFn: ({ signal }) => api.get<LiveStatusDto>('/live/status', undefined, signal),
    staleTime: 60_000,
  });
}

export function useTags() {
  return useQuery({
    queryKey: qk.tags,
    queryFn: ({ signal }) => api.get<TagDto[]>('/tags', undefined, signal),
    staleTime: 5 * 60_000,
  });
}
