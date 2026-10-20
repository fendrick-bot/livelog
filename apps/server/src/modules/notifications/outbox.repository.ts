import { and, asc, eq, inArray, lt, lte, sql } from 'drizzle-orm';
import { emailOutbox, type EmailOutboxRow } from '../../db/schema';
import type { DbExecutor } from '../../db/types';
import type { EmailJob } from './email-jobs';

const INSERT_CHUNK = 500;

export class OutboxRepository {
  constructor(private readonly db: DbExecutor) {}

  async enqueue(jobs: EmailJob[]): Promise<number> {
    for (let index = 0; index < jobs.length; index += INSERT_CHUNK) {
      const chunk = jobs.slice(index, index + INSERT_CHUNK);
      await this.db.insert(emailOutbox).values(
        chunk.map((job) => ({
          kind: job.kind,
          toEmail: job.toEmail,
          payload: job.payload as unknown as Record<string, unknown>,
        })),
      );
    }
    return jobs.length;
  }

  /**
   * Atomically claims due emails. `FOR UPDATE SKIP LOCKED` lets several
   * workers (or instances) run without ever sending the same email twice.
   */
  async claimBatch(limit: number): Promise<EmailOutboxRow[]> {
    const due = this.db
      .select({ id: emailOutbox.id })
      .from(emailOutbox)
      .where(and(eq(emailOutbox.status, 'pending'), lte(emailOutbox.sendAfter, sql`now()`)))
      .orderBy(asc(emailOutbox.createdAt))
      .limit(limit)
      .for('update', { skipLocked: true });

    return this.db
      .update(emailOutbox)
      .set({ status: 'sending', lockedAt: new Date(), attempts: sql`${emailOutbox.attempts} + 1` })
      .where(inArray(emailOutbox.id, due))
      .returning();
  }

  /** Marks sent and scrubs one-time secrets (confirmation tokens) from the payload. */
  async markSent(id: string): Promise<void> {
    await this.db
      .update(emailOutbox)
      .set({
        status: 'sent',
        sentAt: new Date(),
        lockedAt: null,
        payload: sql`${emailOutbox.payload} - 'token'`,
      })
      .where(eq(emailOutbox.id, id));
  }

  async markRetry(id: string, error: string, retryAt: Date): Promise<void> {
    await this.db
      .update(emailOutbox)
      .set({
        status: 'pending',
        lastError: error.slice(0, 2000),
        sendAfter: retryAt,
        lockedAt: null,
      })
      .where(eq(emailOutbox.id, id));
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.db
      .update(emailOutbox)
      .set({ status: 'failed', lastError: error.slice(0, 2000), lockedAt: null })
      .where(eq(emailOutbox.id, id));
  }

  /** Recovers rows stuck in "sending" (e.g. the process died mid-send). */
  async releaseStale(olderThan: Date): Promise<number> {
    const rows = await this.db
      .update(emailOutbox)
      .set({ status: 'pending', lockedAt: null })
      .where(and(eq(emailOutbox.status, 'sending'), lt(emailOutbox.lockedAt, olderThan)))
      .returning({ id: emailOutbox.id });
    return rows.length;
  }

  async findAll(): Promise<EmailOutboxRow[]> {
    return this.db.select().from(emailOutbox).orderBy(asc(emailOutbox.createdAt));
  }
}
