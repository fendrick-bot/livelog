import type { PaginationQuery, StoryStatus } from '@livelog/shared';
import { count, desc, eq } from 'drizzle-orm';
import { storyRequests, type NewStoryRequestRow, type StoryRequestRow } from '../../db/schema';
import type { DbExecutor } from '../../db/types';
import { toOffset } from '../../lib/pagination';

const withRelations = {
  submitter: { columns: { id: true, displayName: true, email: true } },
  publishedLog: { columns: { id: true, slug: true } },
} as const;

export class StoryRepository {
  constructor(private readonly db: DbExecutor) {}

  async create(values: NewStoryRequestRow): Promise<StoryRequestRow> {
    const [row] = await this.db.insert(storyRequests).values(values).returning();
    if (!row) throw new Error('Failed to insert story request');
    return row;
  }

  async findById(id: string) {
    const row = await this.db.query.storyRequests.findFirst({
      where: eq(storyRequests.id, id),
      with: withRelations,
    });
    return row ?? null;
  }

  async listBySubmitter(submitterId: string) {
    return this.db.query.storyRequests.findMany({
      where: eq(storyRequests.submitterId, submitterId),
      with: withRelations,
      orderBy: [desc(storyRequests.createdAt)],
    });
  }

  async list(filter: { status?: StoryStatus }, page: PaginationQuery) {
    const where = filter.status ? eq(storyRequests.status, filter.status) : undefined;
    const { limit, offset } = toOffset(page);
    const [rows, totals] = await Promise.all([
      this.db.query.storyRequests.findMany({
        where,
        with: withRelations,
        orderBy: [desc(storyRequests.createdAt)],
        limit,
        offset,
      }),
      this.db.select({ value: count() }).from(storyRequests).where(where),
    ]);
    return { rows, total: totals[0]?.value ?? 0 };
  }

  async update(id: string, patch: Partial<NewStoryRequestRow>): Promise<StoryRequestRow | null> {
    const [row] = await this.db
      .update(storyRequests)
      .set(patch)
      .where(eq(storyRequests.id, id))
      .returning();
    return row ?? null;
  }

  async countByStatus(status: StoryStatus): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(storyRequests)
      .where(eq(storyRequests.status, status));
    return row?.value ?? 0;
  }
}

export type StoryRecord = NonNullable<Awaited<ReturnType<StoryRepository['findById']>>>;
