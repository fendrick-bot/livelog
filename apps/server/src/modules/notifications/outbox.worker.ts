import type { Logger } from '../../lib/logger';
import type { Mailer } from './mailer';
import type { OutboxRepository } from './outbox.repository';
import { renderEmail } from './templates';

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 25;
const STALE_AFTER_MS = 10 * 60_000;

/** Polls the email_outbox table and delivers due emails with exponential backoff. */
export class OutboxWorker {
  private timer: NodeJS.Timeout | null = null;
  private running: Promise<void> | null = null;
  private stopped = true;

  constructor(
    private readonly deps: {
      outbox: OutboxRepository;
      mailer: Mailer;
      logger: Logger;
      publicUrl: string;
      pollMs: number;
    },
  ) {}

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.schedule(0);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    await this.running;
  }

  /** Processes due emails until none are left. Exposed for tests and manual triggering. */
  async drain(): Promise<number> {
    let total = 0;
    for (;;) {
      const processed = await this.tick();
      total += processed;
      if (processed < BATCH_SIZE) return total;
    }
  }

  async tick(): Promise<number> {
    const { outbox, mailer, logger, publicUrl } = this.deps;
    await outbox.releaseStale(new Date(Date.now() - STALE_AFTER_MS));
    const batch = await outbox.claimBatch(BATCH_SIZE);

    for (const job of batch) {
      try {
        const rendered = renderEmail(job, { publicUrl });
        await mailer.send({ to: job.toEmail, ...rendered });
        await outbox.markSent(job.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (job.attempts >= MAX_ATTEMPTS) {
          await outbox.markFailed(job.id, message);
          logger.error({ jobId: job.id, kind: job.kind, err: error }, 'email permanently failed');
        } else {
          const delayMs = 30_000 * 2 ** (job.attempts - 1);
          await outbox.markRetry(job.id, message, new Date(Date.now() + delayMs));
          logger.warn(
            { jobId: job.id, kind: job.kind, attempt: job.attempts },
            'email failed, will retry',
          );
        }
      }
    }
    return batch.length;
  }

  private schedule(delay: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      this.running = this.drain()
        .then(() => undefined)
        .catch((error: unknown) => this.deps.logger.error({ err: error }, 'outbox tick failed'))
        .finally(() => {
          this.running = null;
          this.schedule(this.deps.pollMs);
        });
    }, delay);
    this.timer.unref();
  }
}
