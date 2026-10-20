/**
 * Socket.IO contract. Writes (comments, reactions, status changes) go through
 * the REST API; sockets only fan out events and carry the live-typing stream.
 */
import type { LogStatus } from './constants';
import type { CommentDto, LiveStatusDto, LogSummaryDto, ReactionCounts } from './dto';
import type { ReactionType } from './constants';
import type { TextOp } from './text';

export const SOCKET_PATH = '/socket.io';

export const ROOMS = {
  /** Every connected client. Receives site-wide live status changes. */
  site: 'site',
  /** Admin sockets. Receives moderation notifications. */
  admin: 'admin',
  log: (logId: string) => `log:${logId}`,
} as const;

export interface LiveSnapshot {
  logId: string;
  content: string;
  version: number;
}

export interface LiveOpPayload {
  logId: string;
  /** The version the writer's text was at before this op. */
  baseVersion: number;
  op: TextOp;
}

export interface LiveOpBroadcast {
  logId: string;
  op: TextOp;
  /** Version after applying the op. Viewers expect `localVersion + 1`. */
  version: number;
}

export interface PresencePayload {
  logId: string;
  viewers: number;
}

export interface ReactionUpdatePayload {
  logId: string;
  type: ReactionType;
  delta: 1 | -1;
  counts: ReactionCounts;
}

export interface LiveEndedPayload {
  logId: string;
  slug: string;
  status: LogStatus;
}

export interface AdminNotification {
  kind: 'story' | 'comment' | 'subscriber';
  message: string;
  href?: string;
}

export type AckResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string };
export type Ack<T> = (result: AckResult<T>) => void;

export interface JoinResult {
  viewers: number;
  /** Present only while the log is live. */
  snapshot: LiveSnapshot | null;
}

export interface ClientToServerEvents {
  'log:join': (logId: string, ack: Ack<JoinResult>) => void;
  'log:leave': (logId: string) => void;
  'live:op': (payload: LiveOpPayload, ack: Ack<{ version: number }>) => void;
  'live:replace': (
    payload: { logId: string; content: string },
    ack: Ack<{ version: number }>,
  ) => void;
}

export interface ServerToClientEvents {
  'live:status': (status: LiveStatusDto) => void;
  'live:op': (payload: LiveOpBroadcast) => void;
  'live:snapshot': (payload: LiveSnapshot) => void;
  'live:ended': (payload: LiveEndedPayload) => void;
  presence: (payload: PresencePayload) => void;
  'log:updated': (log: LogSummaryDto) => void;
  'comment:new': (comment: CommentDto) => void;
  'comment:removed': (payload: { logId: string; commentId: string }) => void;
  'reaction:update': (payload: ReactionUpdatePayload) => void;
  'admin:notify': (payload: AdminNotification) => void;
}
