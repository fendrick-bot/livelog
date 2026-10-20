import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { sessions, type NewSessionRow, type SessionRow } from '../../db/schema';
import type { DbExecutor } from '../../db/types';

export class SessionRepository {
  constructor(private readonly db: DbExecutor) {}

  async create(values: NewSessionRow): Promise<SessionRow> {
    const [row] = await this.db.insert(sessions).values(values).returning();
    if (!row) throw new Error('Failed to insert session');
    return row;
  }

  async findById(id: string): Promise<SessionRow | null> {
    const [row] = await this.db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    return row ?? null;
  }

  async findByTokenHash(tokenHash: string): Promise<SessionRow | null> {
    const [row] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, tokenHash))
      .limit(1);
    return row ?? null;
  }

  async findByPreviousTokenHash(tokenHash: string): Promise<SessionRow | null> {
    const [row] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.previousTokenHash, tokenHash))
      .limit(1);
    return row ?? null;
  }

  /**
   * Optimistic rotation: only succeeds if the presented token is still the
   * current one, so two concurrent refreshes cannot both win.
   */
  async rotate(
    id: string,
    expectedTokenHash: string,
    next: { tokenHash: string; expiresAt: Date; ip: string | null; userAgent: string | null },
  ): Promise<boolean> {
    const now = new Date();
    const rows = await this.db
      .update(sessions)
      .set({
        tokenHash: next.tokenHash,
        previousTokenHash: expectedTokenHash,
        rotatedAt: now,
        lastUsedAt: now,
        expiresAt: next.expiresAt,
        ip: next.ip,
        userAgent: next.userAgent,
      })
      .where(and(eq(sessions.id, id), eq(sessions.tokenHash, expectedTokenHash)))
      .returning({ id: sessions.id });
    return rows.length === 1;
  }

  async revoke(id: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.id, id), isNull(sessions.revokedAt)));
  }

  async listActive(userId: string): Promise<SessionRow[]> {
    return this.db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(sessions.lastUsedAt));
  }
}
