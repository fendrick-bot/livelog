import { randomBytes } from 'node:crypto';
import {
  canTransition,
  excerptFrom,
  isPublicStatus,
  PUBLIC_LOG_STATUSES,
  readingMinutes,
  slugify,
  type AdminListLogsQuery,
  type CreateLogInput,
  type EndLiveInput,
  type ListLogsQuery,
  type LiveStatusDto,
  type LogDetailDto,
  type LogStatus,
  type LogSummaryDto,
  type Paginated,
  type ScheduleLiveInput,
  type UpdateLogInput,
} from '@livelog/shared';
import type { NewLogRow } from '../../db/schema';
import { iso } from '../../lib/dates';
import { Errors, PG_UNIQUE_VIOLATION, pgErrorCode } from '../../lib/errors';
import type { EventBus } from '../../lib/events';
import { paginate } from '../../lib/pagination';
import type { AuthUser } from '../../lib/tokens';
import type { LiveHub } from '../live/live-hub';
import { emptyReactionCounts } from '../reactions/reaction.mapper';
import type { Repositories, RunInTransaction } from '../repositories';
import { toLogSummary, type LogSummarySource } from './log.mapper';
import type { LogRecord } from './log.repository';

/** Don't email subscribers again if the same entry went live within this window. */
const NOTIFY_COOLDOWN_MS = 30 * 60_000;
/** A scheduled entry keeps showing as "next" for a while after its start time passes. */
const SCHEDULE_GRACE_MS = 2 * 60 * 60_000;

export interface LogServiceDeps {
  repos: Repositories;
  transaction: RunInTransaction;
  live: LiveHub;
  events: EventBus;
}

export class LogService {
  constructor(private readonly deps: LogServiceDeps) {}

  // ─── Reads ─────────────────────────────────────────────────────────────

  async listPublic(query: ListLogsQuery): Promise<Paginated<LogSummaryDto>> {
    const { rows, total } = await this.deps.repos.logs.list(
      { statuses: [...PUBLIC_LOG_STATUSES], kind: query.kind, tagSlug: query.tag, q: query.q },
      query,
      'recent',
    );
    return paginate(await this.summaries(rows), total, query);
  }

  async adminList(query: AdminListLogsQuery): Promise<Paginated<LogSummaryDto>> {
    const { rows, total } = await this.deps.repos.logs.list(
      {
        statuses: query.status ? [query.status] : undefined,
        kind: query.kind,
        tagSlug: query.tag,
        q: query.q,
      },
      query,
      'updated',
    );
    return paginate(await this.summaries(rows), total, query);
  }

  async getPublicBySlug(slug: string, viewer: AuthUser | null): Promise<LogDetailDto> {
    const record = await this.deps.repos.logs.findBySlug(slug);
    const isAdmin = viewer?.role === 'admin';
    if (!record || (!isPublicStatus(record.status) && !isAdmin)) throw Errors.notFound('Log');
    if (!isAdmin && isPublicStatus(record.status)) {
      await this.deps.repos.logs.incrementViews(record.id);
      record.viewCount += 1;
    }
    return this.detail(record, viewer);
  }

  async adminGet(id: string, viewer: AuthUser): Promise<LogDetailDto> {
    const record = await this.deps.repos.logs.findById(id);
    if (!record) throw Errors.notFound('Log');
    return this.detail(record, viewer);
  }

  async getLiveStatus(): Promise<LiveStatusDto> {
    const { logs } = this.deps.repos;
    const [live, next] = await Promise.all([
      logs.findLive(),
      logs.findNextScheduled(new Date(Date.now() - SCHEDULE_GRACE_MS)),
    ]);
    const [liveDto, nextDto] = await this.summaries([live, next]);
    return {
      live: liveDto ?? null,
      next: nextDto ?? null,
      viewers: live ? this.deps.live.viewerCount(live.id) : 0,
      serverTime: iso(new Date()),
    };
  }

  /** Minimal data for share previews (Open Graph tags). */
  async shareMeta(slug: string) {
    const record = await this.deps.repos.logs.findBySlug(slug);
    if (!record || !isPublicStatus(record.status)) return null;
    return {
      title: record.title,
      description: record.excerpt ?? excerptFrom(record.content, 200),
      isLive: record.status === 'live',
      author: record.byline ?? record.author.displayName,
    };
  }

  // ─── Writes ────────────────────────────────────────────────────────────

  async create(author: AuthUser, input: CreateLogInput): Promise<LogDetailDto> {
    const tagIds = this.uniqueIds(input.tagIds);
    await this.assertTagsExist(tagIds);
    const content = input.content ?? '';

    const id = await this.deps.transaction(async (repos) => {
      const log = await repos.logs.create({
        authorId: author.id,
        title: input.title,
        slug: await this.uniqueSlug(input.title, repos),
        content,
        excerpt: input.excerpt || null,
        coverImageUrl: input.coverImageUrl ?? null,
        allowComments: input.allowComments ?? true,
        allowReactions: input.allowReactions ?? true,
        readingMinutes: readingMinutes(content),
      });
      if (tagIds.length > 0) await repos.logs.setTags(log.id, tagIds);
      return log.id;
    });
    return this.detailById(id, author);
  }

  async update(id: string, input: UpdateLogInput, editor: AuthUser): Promise<LogDetailDto> {
    const current = await this.deps.repos.logs.findById(id);
    if (!current) throw Errors.notFound('Log');
    const tagIds = input.tagIds ? this.uniqueIds(input.tagIds) : undefined;
    if (tagIds) await this.assertTagsExist(tagIds);

    const patch: Partial<NewLogRow> = {};
    if (input.title !== undefined && input.title !== current.title) {
      patch.title = input.title;
      // Slugs are permanent once an entry has been public; links must not break.
      if (!current.publishedAt && !current.liveStartedAt) {
        patch.slug = await this.uniqueSlug(input.title, this.deps.repos, id);
      }
    }
    if (input.content !== undefined) {
      patch.content = input.content;
      patch.readingMinutes = readingMinutes(input.content);
    }
    if (input.excerpt !== undefined) patch.excerpt = input.excerpt || null;
    if (input.coverImageUrl !== undefined) patch.coverImageUrl = input.coverImageUrl;
    if (input.allowComments !== undefined) patch.allowComments = input.allowComments;
    if (input.allowReactions !== undefined) patch.allowReactions = input.allowReactions;

    await this.deps.transaction(async (repos) => {
      if (Object.keys(patch).length > 0) await repos.logs.update(id, patch);
      if (tagIds) await repos.logs.setTags(id, tagIds);
    });

    if (current.status === 'live' && input.content !== undefined) {
      const result = await this.deps.live.replace(id, input.content);
      if (result.ok) {
        this.deps.events.emit('live.replaced', {
          logId: id,
          content: input.content,
          version: result.version,
        });
      }
    }

    const dto = await this.detailById(id, editor);
    this.deps.events.emit('log.changed', { log: dto, previousStatus: current.status });
    return dto;
  }

  async remove(id: string): Promise<void> {
    const current = await this.deps.repos.logs.findById(id);
    if (!current) throw Errors.notFound('Log');
    if (current.status === 'live') {
      throw Errors.conflict('End the live session before deleting this entry', 'LOG_IS_LIVE');
    }
    await this.deps.repos.logs.delete(id);
    this.deps.events.emit('log.deleted', { logId: id, wasPublic: isPublicStatus(current.status) });
  }

  publish(id: string, editor: AuthUser) {
    return this.changeStatus(id, 'published', editor, (log) => ({
      publishedAt: log.publishedAt ?? new Date(),
      scheduledFor: null,
    }));
  }

  unpublish(id: string, editor: AuthUser) {
    return this.changeStatus(id, 'draft', editor, () => ({ scheduledFor: null }));
  }

  archive(id: string, editor: AuthUser) {
    return this.changeStatus(id, 'archived', editor, () => ({ scheduledFor: null }));
  }

  schedule(id: string, input: ScheduleLiveInput, editor: AuthUser) {
    return this.changeStatus(id, 'scheduled', editor, () => ({
      scheduledFor: new Date(input.scheduledFor),
    }));
  }

  async unschedule(id: string, editor: AuthUser) {
    const current = await this.deps.repos.logs.findById(id);
    if (!current) throw Errors.notFound('Log');
    if (current.status !== 'scheduled') {
      throw Errors.conflict('This entry is not scheduled', 'INVALID_TRANSITION');
    }
    return this.changeStatus(id, 'draft', editor, () => ({ scheduledFor: null }));
  }

  /**
   * Starts streaming an entry. In one transaction: flips the status, opens a
   * live_session row and queues a "live now" email for every active
   * subscriber (unless this entry was already live in the last 30 minutes).
   */
  async goLive(id: string, admin: AuthUser): Promise<LogDetailDto> {
    let result: { sessionId: string; content: string };
    try {
      result = await this.deps.transaction(async (repos) => {
        const log = await repos.logs.findById(id);
        if (!log) throw Errors.notFound('Log');
        if (log.status === 'live')
          throw Errors.conflict('This entry is already live', 'ALREADY_LIVE');
        if (!canTransition(log.status, 'live')) {
          throw Errors.conflict(`A ${log.status} entry cannot go live`, 'INVALID_TRANSITION');
        }
        const liveId = await repos.logs.liveLogId();
        if (liveId && liveId !== id) {
          throw Errors.conflict(
            'Another entry is live right now. End it first.',
            'ANOTHER_LOG_LIVE',
          );
        }

        const now = new Date();
        await repos.logs.update(id, {
          status: 'live',
          liveStartedAt: now,
          liveEndedAt: null,
          scheduledFor: null,
        });
        const recentlyLive = await repos.liveSessions.hasStartedSince(
          id,
          new Date(now.getTime() - NOTIFY_COOLDOWN_MS),
        );
        const session = await repos.liveSessions.create({ logId: id, startedById: admin.id });

        if (!recentlyLive) {
          const recipients = await repos.subscribers.listActiveRecipients();
          const excerpt = log.excerpt ?? (excerptFrom(log.content) || null);
          await repos.outbox.enqueue(
            recipients.map((recipient) => ({
              kind: 'live_started' as const,
              toEmail: recipient.email,
              payload: {
                logTitle: log.title,
                logSlug: log.slug,
                excerpt,
                unsubscribeToken: recipient.unsubscribeToken,
              },
            })),
          );
          await repos.liveSessions.setNotified(session.id, recipients.length);
        }
        return { sessionId: session.id, content: log.content };
      });
    } catch (error) {
      if (pgErrorCode(error) === PG_UNIQUE_VIOLATION) {
        throw Errors.conflict('Another entry is live right now. End it first.', 'ANOTHER_LOG_LIVE');
      }
      throw error;
    }

    this.deps.live.open(id, result.content);
    const dto = await this.detailById(id, admin);
    this.deps.events.emit('log.liveStarted', { log: dto, sessionId: result.sessionId });
    return dto;
  }

  async endLive(id: string, input: EndLiveInput, admin: AuthUser): Promise<LogDetailDto> {
    const current = await this.deps.repos.logs.findById(id);
    if (!current) throw Errors.notFound('Log');
    if (current.status !== 'live') throw Errors.conflict('This entry is not live', 'NOT_LIVE');

    const { live } = this.deps;
    await live.flush(id);
    const peakViewers = live.peak(id);
    const now = new Date();

    await this.deps.transaction(async (repos) => {
      await repos.logs.update(id, {
        status: input.publish ? 'published' : 'draft',
        liveEndedAt: now,
        publishedAt: input.publish ? (current.publishedAt ?? now) : current.publishedAt,
      });
      await repos.liveSessions.endOpen(id, peakViewers, now);
    });
    await live.close(id);

    const dto = await this.detailById(id, admin);
    this.deps.events.emit('log.liveEnded', { log: dto });
    return dto;
  }

  // ─── Helpers shared with other services ────────────────────────────────

  async assertTagsExist(tagIds: string[]): Promise<void> {
    if (tagIds.length === 0) return;
    const found = await this.deps.repos.tags.findByIds(tagIds);
    if (found.length !== new Set(tagIds).size) {
      throw Errors.validation({ fieldErrors: { tagIds: ['One or more tags no longer exist'] } });
    }
  }

  /** `the-first-page`, or `the-first-page-3fa9c1` when that is taken. */
  async uniqueSlug(title: string, repos: Repositories, excludeId?: string): Promise<string> {
    const base = slugify(title) || 'entry';
    if (!(await repos.logs.slugTaken(base, excludeId))) return base;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = `${base}-${randomBytes(3).toString('hex')}`;
      if (!(await repos.logs.slugTaken(candidate, excludeId))) return candidate;
    }
    return `${base}-${randomBytes(6).toString('hex')}`;
  }

  /** Emits `log.changed` for a log created/changed outside this service (e.g. accepted stories). */
  async announce(id: string, previousStatus: LogStatus | null): Promise<void> {
    const record = await this.deps.repos.logs.findById(id);
    if (!record) return;
    const [summary] = await this.summaries([record]);
    if (summary) this.deps.events.emit('log.changed', { log: summary, previousStatus });
  }

  // ─── Internals ─────────────────────────────────────────────────────────

  private async changeStatus(
    id: string,
    to: LogStatus,
    editor: AuthUser,
    patch: (log: LogRecord) => Partial<NewLogRow>,
  ): Promise<LogDetailDto> {
    const current = await this.deps.repos.logs.findById(id);
    if (!current) throw Errors.notFound('Log');
    if (current.status === 'live') {
      throw Errors.conflict('End the live session first', 'LOG_IS_LIVE');
    }
    const reschedule = current.status === 'scheduled' && to === 'scheduled';
    if (!reschedule && !canTransition(current.status, to)) {
      throw Errors.conflict(`Cannot move a ${current.status} entry to ${to}`, 'INVALID_TRANSITION');
    }
    await this.deps.repos.logs.update(id, { status: to, ...patch(current) });
    const dto = await this.detailById(id, editor);
    this.deps.events.emit('log.changed', { log: dto, previousStatus: current.status });
    return dto;
  }

  private async detailById(id: string, viewer: AuthUser | null): Promise<LogDetailDto> {
    const record = await this.deps.repos.logs.findById(id);
    if (!record) throw Errors.notFound('Log');
    return this.detail(record, viewer);
  }

  private async detail(record: LogRecord, viewer: AuthUser | null): Promise<LogDetailDto> {
    const [summary, viewerReactions] = await Promise.all([
      this.summaries([record]).then(([dto]) => dto!),
      viewer ? this.deps.repos.reactions.forUser(record.id, viewer.id) : Promise.resolve([]),
    ]);
    const liveContent =
      record.status === 'live' ? this.deps.live.peek(record.id)?.content : undefined;
    return { ...summary, content: liveContent ?? record.content, viewerReactions };
  }

  /** Maps records to DTOs with comment/reaction counts in two grouped queries (no N+1). */
  private async summaries(records: LogSummarySource[]): Promise<LogSummaryDto[]>;
  private async summaries(
    records: Array<LogSummarySource | null>,
  ): Promise<Array<LogSummaryDto | null>>;
  private async summaries(
    records: Array<LogSummarySource | null>,
  ): Promise<Array<LogSummaryDto | null>> {
    const ids = records.filter((record) => record !== null).map((record) => record.id);
    const [commentCounts, reactionCounts] = await Promise.all([
      this.deps.repos.comments.countVisibleByLogIds(ids),
      this.deps.repos.reactions.countsByLogIds(ids),
    ]);
    return records.map((record) =>
      record
        ? toLogSummary(record, {
            comments: commentCounts.get(record.id) ?? 0,
            reactions: reactionCounts.get(record.id) ?? emptyReactionCounts(),
          })
        : null,
    );
  }

  private uniqueIds(ids: string[] | undefined): string[] {
    return [...new Set(ids ?? [])];
  }
}
