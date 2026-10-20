import {
  LOG_STATUSES,
  SUBSCRIBER_STATUSES,
  type AdminStatsDto,
  type LiveSessionDto,
  type Paginated,
  type PaginationQuery,
} from '@livelog/shared';
import { iso, isoOrNull } from '../../lib/dates';
import { paginate } from '../../lib/pagination';
import type { Repositories } from '../repositories';

function fill<K extends string>(
  keys: readonly K[],
  partial: Partial<Record<K, number>>,
): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, partial[key] ?? 0])) as Record<K, number>;
}

export class AdminService {
  constructor(private readonly deps: { repos: Repositories }) {}

  async stats(): Promise<AdminStatsDto> {
    const { logs, subscribers, stories, comments, reactions, liveSessions } = this.deps.repos;
    const [
      logCounts,
      communityLogs,
      subscriberCounts,
      pendingStories,
      commentCount,
      reactionCount,
      sessions,
      views,
    ] = await Promise.all([
      logs.countByStatus('author'),
      logs.countByKind('community'),
      subscribers.countByStatus(),
      stories.countByStatus('pending'),
      comments.countAll(),
      reactions.countAll(),
      liveSessions.countAll(),
      logs.totalViews(),
    ]);
    return {
      logs: fill(LOG_STATUSES, logCounts),
      communityLogs,
      subscribers: fill(SUBSCRIBER_STATUSES, subscriberCounts),
      pendingStories,
      comments: commentCount,
      reactions: reactionCount,
      liveSessions: sessions,
      totalViews: views,
    };
  }

  async liveHistory(page: PaginationQuery): Promise<Paginated<LiveSessionDto>> {
    const { rows, total } = await this.deps.repos.liveSessions.list(page);
    const items = rows.map((row) => ({
      id: row.id,
      log: { id: row.log.id, title: row.log.title, slug: row.log.slug, status: row.log.status },
      startedAt: iso(row.startedAt),
      endedAt: isoOrNull(row.endedAt),
      durationSeconds: row.endedAt
        ? Math.max(0, Math.round((row.endedAt.getTime() - row.startedAt.getTime()) / 1000))
        : null,
      peakViewers: row.peakViewers,
      notifiedSubscribers: row.notifiedSubscribers,
    }));
    return paginate(items, total, page);
  }
}
