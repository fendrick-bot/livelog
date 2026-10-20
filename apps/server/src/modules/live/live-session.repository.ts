import type { PaginationQuery } from '@livelog/shared';
import { and, count, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import { liveSessions, type LiveSessionRow } from '../../db/schema';
import type { DbExecutor } from '../../db/types';
import { toOffset } from '../../lib/pagination';

export class LiveSessionRepository {
  constructor(private readonly db: DbExecutor) {}

  async create(values: { logId: string; startedById: string | null }): Promise<LiveSessionRow> {
    const [row] = await this.db.insert(liveSessions).values(values).returning();
    if (!row) throw new Error('Failed to insert live session');
    return row;
  }

  async hasStartedSince(logId: string, since: Date): Promise<boolean> {
    const [row] = await this.db
      .select({ id: liveSessions.id })
      .from(liveSessions)
      .where(and(eq(liveSessions.logId, logId), gte(liveSessions.startedAt, since)))
      .limit(1);
    return Boolean(row);
  }

  async setNotified(id: string, notifiedSubscribers: number): Promise<void> {
    await this.db.update(liveSessions).set({ notifiedSubscribers }).where(eq(liveSessions.id, id));
  }

  /** Closes whichever session for this log is still open. */
  async endOpen(logId: string, peakViewers: number, endedAt = new Date()): Promise<void> {
    await this.db
      .update(liveSessions)
      .set({ endedAt, peakViewers: sql`greatest(${liveSessions.peakViewers}, ${peakViewers})` })
      .where(and(eq(liveSessions.logId, logId), isNull(liveSessions.endedAt)));
  }

  async list(page: PaginationQuery) {
    const { limit, offset } = toOffset(page);
    const [rows, totals] = await Promise.all([
      this.db.query.liveSessions.findMany({
        with: { log: { columns: { id: true, title: true, slug: true, status: true } } },
        orderBy: [desc(liveSessions.startedAt)],
        limit,
        offset,
      }),
      this.db.select({ value: count() }).from(liveSessions),
    ]);
    return { rows, total: totals[0]?.value ?? 0 };
  }

  async countAll(): Promise<number> {
    const [row] = await this.db.select({ value: count() }).from(liveSessions);
    return row?.value ?? 0;
  }
}
