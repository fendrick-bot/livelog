import type { LogKind, LogStatus, PaginationQuery } from '@livelog/shared';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  ne,
  or,
  sql,
  sum,
  type SQL,
} from 'drizzle-orm';
import { logs, logTags, tags, type LogRow, type NewLogRow } from '../../db/schema';
import type { DbExecutor } from '../../db/types';
import { likePattern, toOffset } from '../../lib/pagination';
import { publicUserColumns } from '../users/user.mapper';

export interface LogFilter {
  statuses?: LogStatus[];
  kind?: LogKind;
  tagSlug?: string;
  q?: string;
}

/** `recent` = newest public activity first (live entries on top); `updated` = admin view. */
export type LogOrder = 'recent' | 'updated';

const withRelations = {
  author: { columns: publicUserColumns },
  logTags: { with: { tag: true } },
} as const;

/** Lists skip the (potentially huge) content column and fetch a short preview instead. */
const listShape = {
  columns: { content: false },
  extras: { contentPreview: sql<string>`left(${logs.content}, 600)`.as('content_preview') },
  with: withRelations,
} as const;

export class LogRepository {
  constructor(private readonly db: DbExecutor) {}

  async findById(id: string) {
    const row = await this.db.query.logs.findFirst({ where: eq(logs.id, id), with: withRelations });
    return row ?? null;
  }

  async findBySlug(slug: string) {
    const row = await this.db.query.logs.findFirst({
      where: eq(logs.slug, slug),
      with: withRelations,
    });
    return row ?? null;
  }

  async findLive() {
    const row = await this.db.query.logs.findFirst({
      ...listShape,
      where: eq(logs.status, 'live'),
    });
    return row ?? null;
  }

  /** Earliest scheduled entry whose start time is after `notBefore`. */
  async findNextScheduled(notBefore: Date) {
    const row = await this.db.query.logs.findFirst({
      ...listShape,
      where: and(eq(logs.status, 'scheduled'), gte(logs.scheduledFor, notBefore)),
      orderBy: [asc(logs.scheduledFor)],
    });
    return row ?? null;
  }

  async findStatus(id: string): Promise<Pick<LogRow, 'id' | 'status' | 'slug' | 'content'> | null> {
    const [row] = await this.db
      .select({ id: logs.id, status: logs.status, slug: logs.slug, content: logs.content })
      .from(logs)
      .where(eq(logs.id, id))
      .limit(1);
    return row ?? null;
  }

  async list(filter: LogFilter, page: PaginationQuery, order: LogOrder) {
    const where = this.conditions(filter);
    const orderBy =
      order === 'recent'
        ? [
            desc(sql`(${logs.status} = 'live')`),
            desc(sql`coalesce(${logs.publishedAt}, ${logs.liveStartedAt}, ${logs.createdAt})`),
            desc(logs.id),
          ]
        : [desc(logs.updatedAt), desc(logs.id)];
    const { limit, offset } = toOffset(page);

    const [rows, totals] = await Promise.all([
      this.db.query.logs.findMany({ ...listShape, where, orderBy, limit, offset }),
      this.db.select({ value: count() }).from(logs).where(where),
    ]);
    return { rows, total: totals[0]?.value ?? 0 };
  }

  async create(values: NewLogRow): Promise<LogRow> {
    const [row] = await this.db.insert(logs).values(values).returning();
    if (!row) throw new Error('Failed to insert log');
    return row;
  }

  async update(id: string, patch: Partial<NewLogRow>): Promise<LogRow | null> {
    const [row] = await this.db.update(logs).set(patch).where(eq(logs.id, id)).returning();
    return row ?? null;
  }

  async updateContent(id: string, content: string, readingMinutes: number): Promise<void> {
    await this.db.update(logs).set({ content, readingMinutes }).where(eq(logs.id, id));
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.delete(logs).where(eq(logs.id, id)).returning({ id: logs.id });
    return rows.length > 0;
  }

  async setTags(logId: string, tagIds: string[]): Promise<void> {
    await this.db.delete(logTags).where(eq(logTags.logId, logId));
    if (tagIds.length > 0) {
      await this.db.insert(logTags).values(tagIds.map((tagId) => ({ logId, tagId })));
    }
  }

  async slugTaken(slug: string, excludeId?: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: logs.id })
      .from(logs)
      .where(and(eq(logs.slug, slug), excludeId ? ne(logs.id, excludeId) : undefined))
      .limit(1);
    return Boolean(row);
  }

  async liveLogId(): Promise<string | null> {
    const [row] = await this.db
      .select({ id: logs.id })
      .from(logs)
      .where(eq(logs.status, 'live'))
      .limit(1);
    return row?.id ?? null;
  }

  async incrementViews(id: string): Promise<void> {
    await this.db
      .update(logs)
      .set({ viewCount: sql`${logs.viewCount} + 1`, updatedAt: sql`${logs.updatedAt}` })
      .where(eq(logs.id, id));
  }

  async countByStatus(kind?: LogKind): Promise<Partial<Record<LogStatus, number>>> {
    const rows = await this.db
      .select({ status: logs.status, value: count() })
      .from(logs)
      .where(kind ? eq(logs.kind, kind) : undefined)
      .groupBy(logs.status);
    return Object.fromEntries(rows.map((row) => [row.status, row.value]));
  }

  async countByKind(kind: LogKind): Promise<number> {
    const [row] = await this.db.select({ value: count() }).from(logs).where(eq(logs.kind, kind));
    return row?.value ?? 0;
  }

  async totalViews(): Promise<number> {
    const [row] = await this.db.select({ value: sum(logs.viewCount) }).from(logs);
    return Number(row?.value ?? 0);
  }

  private conditions(filter: LogFilter): SQL | undefined {
    const parts: Array<SQL | undefined> = [];
    if (filter.statuses?.length) parts.push(inArray(logs.status, filter.statuses));
    if (filter.kind) parts.push(eq(logs.kind, filter.kind));
    if (filter.tagSlug) {
      parts.push(
        inArray(
          logs.id,
          this.db
            .select({ id: logTags.logId })
            .from(logTags)
            .innerJoin(tags, eq(tags.id, logTags.tagId))
            .where(eq(tags.slug, filter.tagSlug)),
        ),
      );
    }
    if (filter.q) {
      const pattern = likePattern(filter.q);
      parts.push(or(ilike(logs.title, pattern), ilike(logs.excerpt, pattern)));
    }
    return and(...parts);
  }
}

export type LogRecord = NonNullable<Awaited<ReturnType<LogRepository['findById']>>>;
export type LogListRecord = Awaited<ReturnType<LogRepository['list']>>['rows'][number];
