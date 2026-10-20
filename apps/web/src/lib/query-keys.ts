import type { Query } from './api';

/** Every cache key in one place, so invalidation is predictable. */
export const qk = {
  liveStatus: ['live', 'status'] as const,
  logs: (params: Query) => ['logs', 'list', params] as const,
  logsAll: ['logs'] as const,
  log: (slug: string) => ['logs', 'detail', slug] as const,
  comments: (logId: string) => ['comments', logId] as const,
  tags: ['tags'] as const,
  myStories: ['stories', 'mine'] as const,
  sessions: ['auth', 'sessions'] as const,
  admin: {
    all: ['admin'] as const,
    stats: ['admin', 'stats'] as const,
    logs: (params: Query) => ['admin', 'logs', params] as const,
    log: (id: string) => ['admin', 'log', id] as const,
    tags: ['admin', 'tags'] as const,
    comments: (params: Query) => ['admin', 'comments', params] as const,
    stories: (params: Query) => ['admin', 'stories', params] as const,
    subscribers: (params: Query) => ['admin', 'subscribers', params] as const,
    history: (page: number) => ['admin', 'history', page] as const,
  },
};
