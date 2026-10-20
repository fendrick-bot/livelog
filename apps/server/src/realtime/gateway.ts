import type { Server as HttpServer } from 'node:http';
import {
  isPublicStatus,
  LIMITS,
  ROOMS,
  SOCKET_PATH,
  type Ack,
  type AckResult,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@livelog/shared';
import { Server, type Socket } from 'socket.io';
import { z } from 'zod';
import type { Container } from '../container';
import type { AuthUser } from '../lib/tokens';

interface SocketData {
  auth: AuthUser | null;
}

type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

const logIdSchema = z.uuid();
const opPayloadSchema = z.object({
  logId: z.uuid(),
  baseVersion: z.number().int().min(0),
  op: z.object({
    pos: z.number().int().min(0),
    del: z.number().int().min(0),
    ins: z.string().max(50_000),
  }),
});
const replacePayloadSchema = z.object({
  logId: z.uuid(),
  content: z.string().max(LIMITS.content.max),
});

const PRESENCE_DEBOUNCE_MS = 300;

const fail = (code: string, message: string): AckResult<never> => ({ ok: false, code, message });

/** Calls the ack only if the client actually supplied one. */
function reply<T>(ack: unknown, result: AckResult<T>): void {
  if (typeof ack === 'function') (ack as Ack<T>)(result);
}

/**
 * Socket.IO gateway. Translates domain events into broadcasts and carries the
 * live-typing stream from the writer to every reader in the log's room.
 */
export function createRealtime(server: HttpServer, container: Container) {
  const { config, tokens, live, events, services, repos, logger } = container;

  const io: IO = new Server(server, {
    path: SOCKET_PATH,
    cors: { origin: config.corsOrigins, credentials: true },
    // Brief network blips resume transparently: rooms and missed events are restored.
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60_000, skipMiddlewares: true },
    pingInterval: 20_000,
    pingTimeout: 20_000,
    maxHttpBufferSize: 1_000_000,
  });

  // ── Presence ───────────────────────────────────────────────────────────
  const presenceTimers = new Map<string, NodeJS.Timeout>();

  /** Readers in a room. The writer's own editor tabs are not counted. */
  const countViewers = (logId: string): number => {
    const ids = io.sockets.adapter.rooms.get(ROOMS.log(logId));
    if (!ids) return 0;
    let viewers = 0;
    for (const id of ids) {
      if (io.sockets.sockets.get(id)?.data.auth?.role !== 'admin') viewers++;
    }
    return viewers;
  };

  const schedulePresence = (logId: string) => {
    if (presenceTimers.has(logId)) return;
    presenceTimers.set(
      logId,
      setTimeout(() => {
        presenceTimers.delete(logId);
        const viewers = countViewers(logId);
        live.setViewers(logId, viewers);
        io.to(ROOMS.log(logId)).emit('presence', { logId, viewers });
        if (live.peek(logId)) void broadcastLiveStatus();
      }, PRESENCE_DEBOUNCE_MS),
    );
  };

  const broadcastLiveStatus = async () => {
    try {
      io.to(ROOMS.site).emit('live:status', await services.logs.getLiveStatus());
    } catch (error) {
      logger.error({ err: error }, 'failed to broadcast live status');
    }
  };

  // ── Connections ────────────────────────────────────────────────────────
  io.use(async (socket, next) => {
    socket.data.auth = null;
    const token: unknown = socket.handshake.auth?.token;
    if (typeof token === 'string' && token.length > 0) {
      try {
        socket.data.auth = await tokens.verify(token);
      } catch {
        // Expired/invalid tokens connect anonymously; reading never requires an account.
      }
    }
    next();
  });

  io.on('connection', (socket: AppSocket) => {
    const isAdmin = () => socket.data.auth?.role === 'admin';
    void socket.join(ROOMS.site);
    if (isAdmin()) void socket.join(ROOMS.admin);

    socket.on('log:join', async (logId, ack) => {
      try {
        if (!logIdSchema.safeParse(logId).success)
          return reply(ack, fail('BAD_REQUEST', 'Invalid log id'));
        const log = await repos.logs.findStatus(logId);
        if (!log || (!isPublicStatus(log.status) && !isAdmin())) {
          return reply(ack, fail('NOT_FOUND', 'Log not found'));
        }
        await socket.join(ROOMS.log(logId));
        schedulePresence(logId);
        const buffer = log.status === 'live' ? await live.get(logId) : null;
        reply(ack, {
          ok: true,
          data: {
            viewers: countViewers(logId),
            snapshot: buffer ? { logId, content: buffer.content, version: buffer.version } : null,
          },
        });
      } catch (error) {
        logger.error({ err: error }, 'log:join failed');
        reply(ack, fail('INTERNAL', 'Could not join this entry'));
      }
    });

    socket.on('log:leave', async (logId) => {
      if (!logIdSchema.safeParse(logId).success) return;
      await socket.leave(ROOMS.log(logId));
      schedulePresence(logId);
    });

    socket.on('live:op', async (payload, ack) => {
      if (!isAdmin()) return reply(ack, fail('FORBIDDEN', 'Only the writer can type here'));
      const parsed = opPayloadSchema.safeParse(payload);
      if (!parsed.success) return reply(ack, fail('BAD_REQUEST', 'Malformed operation'));
      const { logId, baseVersion, op } = parsed.data;
      const result = await live.applyOp(logId, baseVersion, op);
      if (!result.ok) return reply(ack, fail(result.code, `Operation rejected: ${result.code}`));
      socket.to(ROOMS.log(logId)).emit('live:op', { logId, op, version: result.version });
      reply(ack, { ok: true, data: { version: result.version } });
    });

    socket.on('live:replace', async (payload, ack) => {
      if (!isAdmin()) return reply(ack, fail('FORBIDDEN', 'Only the writer can type here'));
      const parsed = replacePayloadSchema.safeParse(payload);
      if (!parsed.success) return reply(ack, fail('BAD_REQUEST', 'Malformed snapshot'));
      const { logId, content } = parsed.data;
      const result = await live.replace(logId, content);
      if (!result.ok) return reply(ack, fail(result.code, `Snapshot rejected: ${result.code}`));
      socket
        .to(ROOMS.log(logId))
        .emit('live:snapshot', { logId, content, version: result.version });
      reply(ack, { ok: true, data: { version: result.version } });
    });

    socket.on('disconnecting', () => {
      for (const room of socket.rooms) {
        if (room.startsWith('log:')) schedulePresence(room.slice('log:'.length));
      }
    });
  });

  // ── Domain events → broadcasts ─────────────────────────────────────────
  const unsubscribers = [
    events.on('log.liveStarted', async ({ log }) => {
      io.to(ROOMS.log(log.id)).emit('log:updated', log);
      await broadcastLiveStatus();
    }),
    events.on('log.liveEnded', async ({ log }) => {
      io.to(ROOMS.log(log.id)).emit('live:ended', {
        logId: log.id,
        slug: log.slug,
        status: log.status,
      });
      io.to(ROOMS.log(log.id)).emit('log:updated', log);
      await broadcastLiveStatus();
    }),
    events.on('live.replaced', ({ logId, content, version }) => {
      io.to(ROOMS.log(logId)).emit('live:snapshot', { logId, content, version });
    }),
    events.on('log.changed', async ({ log, previousStatus }) => {
      io.to(ROOMS.log(log.id)).emit('log:updated', log);
      const affectsStatus = ['live', 'scheduled'].some(
        (status) => status === log.status || status === previousStatus,
      );
      if (affectsStatus) await broadcastLiveStatus();
    }),
    events.on('log.deleted', async () => {
      await broadcastLiveStatus();
    }),
    events.on('comment.created', ({ comment, logTitle }) => {
      io.to(ROOMS.log(comment.logId)).emit('comment:new', comment);
      if (!comment.author.isAdmin) {
        io.to(ROOMS.admin).emit('admin:notify', {
          kind: 'comment',
          message: `${comment.author.displayName} wrote in the margin of “${logTitle}”`,
          href: '/admin/comments',
        });
      }
    }),
    events.on('comment.removed', ({ logId, commentId }) => {
      io.to(ROOMS.log(logId)).emit('comment:removed', { logId, commentId });
    }),
    events.on('reaction.changed', (payload) => {
      io.to(ROOMS.log(payload.logId)).emit('reaction:update', payload);
    }),
    events.on('story.submitted', ({ story }) => {
      io.to(ROOMS.admin).emit('admin:notify', {
        kind: 'story',
        message: `New story request: “${story.title}”`,
        href: '/admin/stories',
      });
    }),
    events.on('subscriber.confirmed', () => {
      io.to(ROOMS.admin).emit('admin:notify', {
        kind: 'subscriber',
        message: 'Someone new subscribed to your live letters',
      });
    }),
  ];

  return {
    io,
    async close(): Promise<void> {
      for (const off of unsubscribers) off();
      for (const timer of presenceTimers.values()) clearTimeout(timer);
      presenceTimers.clear();
      await new Promise<void>((resolve) => {
        io.close(() => resolve());
      });
    },
  };
}

export type Realtime = ReturnType<typeof createRealtime>;
