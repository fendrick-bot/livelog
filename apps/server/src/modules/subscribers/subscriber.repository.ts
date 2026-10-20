import type { PaginationQuery, SubscriberStatus } from '@livelog/shared';
import { and, count, desc, eq, ilike, type SQL } from 'drizzle-orm';
import { subscribers, type NewSubscriberRow, type SubscriberRow } from '../../db/schema';
import type { DbExecutor } from '../../db/types';
import { likePattern, toOffset } from '../../lib/pagination';

export class SubscriberRepository {
  constructor(private readonly db: DbExecutor) {}

  async findByEmail(email: string): Promise<SubscriberRow | null> {
    const [row] = await this.db
      .select()
      .from(subscribers)
      .where(eq(subscribers.email, email))
      .limit(1);
    return row ?? null;
  }

  async findByConfirmTokenHash(hash: string): Promise<SubscriberRow | null> {
    const [row] = await this.db
      .select()
      .from(subscribers)
      .where(eq(subscribers.confirmTokenHash, hash))
      .limit(1);
    return row ?? null;
  }

  async findByUnsubscribeToken(token: string): Promise<SubscriberRow | null> {
    const [row] = await this.db
      .select()
      .from(subscribers)
      .where(eq(subscribers.unsubscribeToken, token))
      .limit(1);
    return row ?? null;
  }

  async create(values: NewSubscriberRow): Promise<SubscriberRow> {
    const [row] = await this.db.insert(subscribers).values(values).returning();
    if (!row) throw new Error('Failed to insert subscriber');
    return row;
  }

  async update(id: string, patch: Partial<NewSubscriberRow>): Promise<SubscriberRow | null> {
    const [row] = await this.db
      .update(subscribers)
      .set(patch)
      .where(eq(subscribers.id, id))
      .returning();
    return row ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db
      .delete(subscribers)
      .where(eq(subscribers.id, id))
      .returning({ id: subscribers.id });
    return rows.length > 0;
  }

  /** Everyone who should get a "live now" email. */
  async listActiveRecipients(): Promise<Array<Pick<SubscriberRow, 'email' | 'unsubscribeToken'>>> {
    return this.db
      .select({ email: subscribers.email, unsubscribeToken: subscribers.unsubscribeToken })
      .from(subscribers)
      .where(eq(subscribers.status, 'active'));
  }

  async list(filter: { status?: SubscriberStatus; q?: string }, page: PaginationQuery) {
    const parts: SQL[] = [];
    if (filter.status) parts.push(eq(subscribers.status, filter.status));
    if (filter.q) parts.push(ilike(subscribers.email, likePattern(filter.q)));
    const where = and(...parts);
    const { limit, offset } = toOffset(page);
    const [rows, totals] = await Promise.all([
      this.db
        .select()
        .from(subscribers)
        .where(where)
        .orderBy(desc(subscribers.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ value: count() }).from(subscribers).where(where),
    ]);
    return { rows, total: totals[0]?.value ?? 0 };
  }

  async countByStatus(): Promise<Partial<Record<SubscriberStatus, number>>> {
    const rows = await this.db
      .select({ status: subscribers.status, value: count() })
      .from(subscribers)
      .groupBy(subscribers.status);
    return Object.fromEntries(rows.map((row) => [row.status, row.value]));
  }
}
