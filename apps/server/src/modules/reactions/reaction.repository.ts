import type { ReactionCounts, ReactionType } from '@livelog/shared';
import { and, count, eq, inArray } from 'drizzle-orm';
import { reactions } from '../../db/schema';
import type { DbExecutor } from '../../db/types';
import { emptyReactionCounts } from './reaction.mapper';

export class ReactionRepository {
  constructor(private readonly db: DbExecutor) {}

  /** Returns true when a new reaction was stored (false if it already existed). */
  async add(logId: string, userId: string, type: ReactionType): Promise<boolean> {
    const rows = await this.db
      .insert(reactions)
      .values({ logId, userId, type })
      .onConflictDoNothing()
      .returning({ id: reactions.id });
    return rows.length > 0;
  }

  async remove(logId: string, userId: string, type: ReactionType): Promise<boolean> {
    const rows = await this.db
      .delete(reactions)
      .where(
        and(eq(reactions.logId, logId), eq(reactions.userId, userId), eq(reactions.type, type)),
      )
      .returning({ id: reactions.id });
    return rows.length > 0;
  }

  async countsByLogIds(logIds: string[]): Promise<Map<string, ReactionCounts>> {
    const result = new Map<string, ReactionCounts>();
    if (logIds.length === 0) return result;
    const rows = await this.db
      .select({ logId: reactions.logId, type: reactions.type, value: count() })
      .from(reactions)
      .where(inArray(reactions.logId, logIds))
      .groupBy(reactions.logId, reactions.type);
    for (const row of rows) {
      const counts = result.get(row.logId) ?? emptyReactionCounts();
      counts[row.type] = row.value;
      result.set(row.logId, counts);
    }
    return result;
  }

  async countsFor(logId: string): Promise<ReactionCounts> {
    return (await this.countsByLogIds([logId])).get(logId) ?? emptyReactionCounts();
  }

  async forUser(logId: string, userId: string): Promise<ReactionType[]> {
    const rows = await this.db
      .select({ type: reactions.type })
      .from(reactions)
      .where(and(eq(reactions.logId, logId), eq(reactions.userId, userId)));
    return rows.map((row) => row.type);
  }

  async countAll(): Promise<number> {
    const [row] = await this.db.select({ value: count() }).from(reactions);
    return row?.value ?? 0;
  }
}
