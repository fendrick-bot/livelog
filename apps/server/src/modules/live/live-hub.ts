import { applyOp, isValidOp, LIMITS, readingMinutes, type TextOp } from '@livelog/shared';
import type { Logger } from '../../lib/logger';
import type { LogRepository } from '../logs/log.repository';

interface LiveBuffer {
  content: string;
  version: number;
  dirty: boolean;
}

export type OpResult =
  | { ok: true; version: number }
  | {
      ok: false;
      code: 'NOT_LIVE' | 'VERSION_MISMATCH' | 'INVALID_OP' | 'TOO_LONG';
      version?: number;
    };

/**
 * In-memory source of truth for entries that are being written live.
 *
 * Every keystroke batch from the writer arrives as a small TextOp and is
 * applied here (O(1) DB work per keystroke = none). Dirty buffers are flushed
 * to Postgres on an interval, when the stream ends and on shutdown. After a
 * restart, buffers re-hydrate lazily from the database.
 *
 * Single-instance by design (phase 1). Scaling out needs a shared store
 * (e.g. Redis) plus the socket.io Redis adapter.
 */
export class LiveHub {
  private readonly buffers = new Map<string, LiveBuffer>();
  private readonly viewers = new Map<string, number>();
  private readonly peaks = new Map<string, number>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly deps: { logs: LogRepository; logger: Logger; flushIntervalMs?: number },
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.flushAll(), this.deps.flushIntervalMs ?? 2_000);
    this.timer.unref();
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.flushAll();
  }

  open(logId: string, content: string): void {
    this.buffers.set(logId, { content, version: 0, dirty: false });
    this.peaks.set(logId, this.viewers.get(logId) ?? 0);
  }

  peek(logId: string): Readonly<LiveBuffer> | undefined {
    return this.buffers.get(logId);
  }

  /** Buffer for a live log, re-hydrating from the database after a restart. */
  async get(logId: string): Promise<Readonly<LiveBuffer> | null> {
    return this.ensure(logId);
  }

  async applyOp(logId: string, baseVersion: number, op: TextOp): Promise<OpResult> {
    const buffer = await this.ensure(logId);
    if (!buffer) return { ok: false, code: 'NOT_LIVE' };
    if (baseVersion !== buffer.version) {
      return { ok: false, code: 'VERSION_MISMATCH', version: buffer.version };
    }
    if (!isValidOp(buffer.content, op))
      return { ok: false, code: 'INVALID_OP', version: buffer.version };
    const next = applyOp(buffer.content, op);
    if (next.length > LIMITS.content.max)
      return { ok: false, code: 'TOO_LONG', version: buffer.version };
    buffer.content = next;
    buffer.version += 1;
    buffer.dirty = true;
    return { ok: true, version: buffer.version };
  }

  async replace(logId: string, content: string): Promise<OpResult> {
    const buffer = await this.ensure(logId);
    if (!buffer) return { ok: false, code: 'NOT_LIVE' };
    if (content.length > LIMITS.content.max)
      return { ok: false, code: 'TOO_LONG', version: buffer.version };
    buffer.content = content;
    buffer.version += 1;
    buffer.dirty = true;
    return { ok: true, version: buffer.version };
  }

  async flush(logId: string): Promise<void> {
    const buffer = this.buffers.get(logId);
    if (!buffer?.dirty) return;
    const content = buffer.content;
    buffer.dirty = false;
    try {
      await this.deps.logs.updateContent(logId, content, readingMinutes(content));
    } catch (error) {
      buffer.dirty = true;
      this.deps.logger.error({ err: error, logId }, 'failed to persist live content');
      throw error;
    }
  }

  async flushAll(): Promise<void> {
    await Promise.allSettled([...this.buffers.keys()].map((logId) => this.flush(logId)));
  }

  /** Persists anything pending, then forgets the buffer. */
  async close(logId: string): Promise<void> {
    await this.flush(logId).catch(() => undefined);
    this.buffers.delete(logId);
    this.peaks.delete(logId);
  }

  setViewers(logId: string, count: number): void {
    if (count <= 0) this.viewers.delete(logId);
    else this.viewers.set(logId, count);
    if (this.buffers.has(logId)) {
      this.peaks.set(logId, Math.max(this.peaks.get(logId) ?? 0, count));
    }
  }

  viewerCount(logId: string): number {
    return this.viewers.get(logId) ?? 0;
  }

  peak(logId: string): number {
    return this.peaks.get(logId) ?? this.viewerCount(logId);
  }

  private async ensure(logId: string): Promise<LiveBuffer | null> {
    const existing = this.buffers.get(logId);
    if (existing) return existing;
    const log = await this.deps.logs.findStatus(logId);
    if (!log || log.status !== 'live') return null;
    // Another caller may have hydrated it while we were awaiting.
    const raced = this.buffers.get(logId);
    if (raced) return raced;
    const buffer: LiveBuffer = { content: log.content, version: 0, dirty: false };
    this.buffers.set(logId, buffer);
    this.peaks.set(logId, this.viewers.get(logId) ?? 0);
    return buffer;
  }
}
