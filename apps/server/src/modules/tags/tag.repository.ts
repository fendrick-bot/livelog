import { PUBLIC_LOG_STATUSES } from '@livelog/shared';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { logs, logTags, tags, type NewTagRow, type TagRow } from '../../db/schema';
import type { DbExecutor } from '../../db/types';

export type TagWithCount = TagRow & { logCount: number };

export class TagRepository {
  constructor(private readonly db: DbExecutor) {}

  /** All tags with how many logs use them (public logs only, unless `includePrivate`). */
  async listWithCounts(includePrivate: boolean): Promise<TagWithCount[]> {
    return this.db
      .select({
        id: tags.id,
        name: tags.name,
        slug: tags.slug,
        createdAt: tags.createdAt,
        updatedAt: tags.updatedAt,
        logCount: sql<number>`count(${logs.id})::int`,
      })
      .from(tags)
      .leftJoin(logTags, eq(logTags.tagId, tags.id))
      .leftJoin(
        logs,
        and(
          eq(logs.id, logTags.logId),
          includePrivate ? undefined : inArray(logs.status, [...PUBLIC_LOG_STATUSES]),
        ),
      )
      .groupBy(tags.id)
      .orderBy(asc(tags.name));
  }

  async findById(id: string): Promise<TagRow | null> {
    const [row] = await this.db.select().from(tags).where(eq(tags.id, id)).limit(1);
    return row ?? null;
  }

  async findByIds(ids: string[]): Promise<TagRow[]> {
    if (ids.length === 0) return [];
    return this.db.select().from(tags).where(inArray(tags.id, ids));
  }

  async create(values: NewTagRow): Promise<TagRow> {
    const [row] = await this.db.insert(tags).values(values).returning();
    if (!row) throw new Error('Failed to insert tag');
    return row;
  }

  async update(id: string, values: Pick<NewTagRow, 'name' | 'slug'>): Promise<TagRow | null> {
    const [row] = await this.db.update(tags).set(values).where(eq(tags.id, id)).returning();
    return row ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.delete(tags).where(eq(tags.id, id)).returning({ id: tags.id });
    return rows.length > 0;
  }
}
