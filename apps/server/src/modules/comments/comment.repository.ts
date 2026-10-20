import type { CommentStatus, PaginationQuery } from '@livelog/shared';
import { and, asc, count, desc, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import { comments, type CommentRow, type NewCommentRow } from '../../db/schema';
import type { DbExecutor } from '../../db/types';
import { toOffset } from '../../lib/pagination';
import { publicUserColumns } from '../users/user.mapper';

const withAuthor = { author: { columns: publicUserColumns } } as const;

export class CommentRepository {
  constructor(private readonly db: DbExecutor) {}

  async create(values: NewCommentRow): Promise<CommentRow> {
    const [row] = await this.db.insert(comments).values(values).returning();
    if (!row) throw new Error('Failed to insert comment');
    return row;
  }

  async findById(id: string) {
    const row = await this.db.query.comments.findFirst({
      where: eq(comments.id, id),
      with: withAuthor,
    });
    return row ?? null;
  }

  /** Newest top-level comments first; replies are fetched separately. */
  async listTopLevel(logId: string, page: PaginationQuery) {
    const where = and(
      eq(comments.logId, logId),
      isNull(comments.parentId),
      eq(comments.status, 'visible'),
    );
    const { limit, offset } = toOffset(page);
    const [rows, totals] = await Promise.all([
      this.db.query.comments.findMany({
        where,
        with: withAuthor,
        orderBy: [desc(comments.createdAt), desc(comments.id)],
        limit,
        offset,
      }),
      this.db.select({ value: count() }).from(comments).where(where),
    ]);
    return { rows, total: totals[0]?.value ?? 0 };
  }

  async listReplies(parentIds: string[]) {
    if (parentIds.length === 0) return [];
    return this.db.query.comments.findMany({
      where: and(inArray(comments.parentId, parentIds), eq(comments.status, 'visible')),
      with: withAuthor,
      orderBy: [asc(comments.createdAt)],
    });
  }

  async countVisibleByLogIds(logIds: string[]): Promise<Map<string, number>> {
    if (logIds.length === 0) return new Map();
    const rows = await this.db
      .select({ logId: comments.logId, value: count() })
      .from(comments)
      .where(and(inArray(comments.logId, logIds), eq(comments.status, 'visible')))
      .groupBy(comments.logId);
    return new Map(rows.map((row) => [row.logId, row.value]));
  }

  async adminList(filter: { status?: CommentStatus; logId?: string }, page: PaginationQuery) {
    const parts: SQL[] = [];
    if (filter.status) parts.push(eq(comments.status, filter.status));
    if (filter.logId) parts.push(eq(comments.logId, filter.logId));
    const where = and(...parts);
    const { limit, offset } = toOffset(page);
    const [rows, totals] = await Promise.all([
      this.db.query.comments.findMany({
        where,
        with: { ...withAuthor, log: { columns: { id: true, title: true, slug: true } } },
        orderBy: [desc(comments.createdAt)],
        limit,
        offset,
      }),
      this.db.select({ value: count() }).from(comments).where(where),
    ]);
    return { rows, total: totals[0]?.value ?? 0 };
  }

  async setStatus(id: string, status: CommentStatus): Promise<CommentRow | null> {
    const [row] = await this.db
      .update(comments)
      .set({ status })
      .where(eq(comments.id, id))
      .returning();
    return row ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db
      .delete(comments)
      .where(eq(comments.id, id))
      .returning({ id: comments.id });
    return rows.length > 0;
  }

  async countAll(): Promise<number> {
    const [row] = await this.db.select({ value: count() }).from(comments);
    return row?.value ?? 0;
  }
}

export type CommentRecord = NonNullable<Awaited<ReturnType<CommentRepository['findById']>>>;
