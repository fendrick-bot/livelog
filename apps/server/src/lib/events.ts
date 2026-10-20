import { EventEmitter } from 'node:events';
import type {
  CommentDto,
  LogSummaryDto,
  ReactionCounts,
  ReactionType,
  StoryRequestDto,
} from '@livelog/shared';
import type { Logger } from './logger';

/**
 * In-process domain events. Services emit facts after a successful commit;
 * the realtime gateway (and anything else) subscribes. Services never import
 * socket.io, which keeps them testable and transport-agnostic.
 */
export interface DomainEvents {
  'log.changed': { log: LogSummaryDto; previousStatus: LogSummaryDto['status'] | null };
  'log.deleted': { logId: string; wasPublic: boolean };
  'log.liveStarted': { log: LogSummaryDto; sessionId: string };
  'log.liveEnded': { log: LogSummaryDto };
  /** The live text was replaced wholesale (e.g. saved through the REST API while live). */
  'live.replaced': { logId: string; content: string; version: number };
  'comment.created': { comment: CommentDto; logTitle: string };
  'comment.removed': { logId: string; commentId: string };
  'reaction.changed': { logId: string; type: ReactionType; delta: 1 | -1; counts: ReactionCounts };
  'story.submitted': { story: StoryRequestDto };
  'story.reviewed': { story: StoryRequestDto };
  'subscriber.confirmed': { email: string };
}

type Handler<K extends keyof DomainEvents> = (payload: DomainEvents[K]) => void | Promise<void>;

export class EventBus {
  private readonly emitter = new EventEmitter({ captureRejections: false });

  constructor(private readonly logger: Logger) {
    this.emitter.setMaxListeners(50);
  }

  emit<K extends keyof DomainEvents>(event: K, payload: DomainEvents[K]): void {
    this.emitter.emit(event, payload);
  }

  on<K extends keyof DomainEvents>(event: K, handler: Handler<K>): () => void {
    const wrapped = (payload: DomainEvents[K]) => {
      try {
        const result = handler(payload);
        if (result instanceof Promise) {
          result.catch((error: unknown) =>
            this.logger.error({ err: error, event }, 'event handler failed'),
          );
        }
      } catch (error) {
        this.logger.error({ err: error, event }, 'event handler failed');
      }
    };
    this.emitter.on(event, wrapped);
    return () => this.emitter.off(event, wrapped);
  }

  removeAll(): void {
    this.emitter.removeAllListeners();
  }
}
