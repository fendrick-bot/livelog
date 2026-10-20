import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ClientToServerEvents, JoinResult, ServerToClientEvents } from '@livelog/shared';
import { io as connect, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRealtime, type Realtime } from '../src/realtime/gateway';
import {
  createLog,
  createTestContext,
  signupAdmin,
  type TestContext,
  type TestUser,
} from './helpers';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let ctx: TestContext;
let server: Server;
let realtime: Realtime;
let url: string;
let admin: TestUser;
const sockets: ClientSocket[] = [];

function client(token?: string): Promise<ClientSocket> {
  const socket: ClientSocket = connect(url, {
    transports: ['websocket'],
    auth: token ? { token } : {},
    forceNew: true,
  });
  sockets.push(socket);
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function next<E extends keyof ServerToClientEvents>(socket: ClientSocket, event: E) {
  return new Promise<Parameters<ServerToClientEvents[E]>[0]>((resolve) => {
    socket.once(event, ((payload: Parameters<ServerToClientEvents[E]>[0]) =>
      resolve(payload)) as never);
  });
}

beforeAll(async () => {
  ctx = await createTestContext();
  admin = await signupAdmin(ctx.app);
  server = createServer(ctx.app);
  realtime = createRealtime(server, ctx.container);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  for (const socket of sockets) socket.disconnect();
  await realtime.close();
  await new Promise((resolve) => server.close(resolve));
  await ctx.close();
});

describe('live writing over sockets', () => {
  it('streams keystrokes from the writer to readers and tracks presence', async () => {
    const log = await createLog(ctx.app, admin, { title: 'Streaming test', content: 'Hello' });
    const viewer = await client();
    const writer = await client(admin.token);

    // Readers cannot join drafts.
    const denied = await viewer.emitWithAck('log:join', log.id);
    expect(denied).toMatchObject({ ok: false, code: 'NOT_FOUND' });

    const statusUpdate = next(viewer, 'live:status');
    await request(ctx.app).post(`/api/admin/logs/${log.id}/go-live`).set(admin.auth).expect(200);
    expect((await statusUpdate).live?.id).toBe(log.id);

    const presence = next(viewer, 'presence');
    const joined = await viewer.emitWithAck('log:join', log.id);
    expect(joined.ok).toBe(true);
    const data = (joined as { ok: true; data: JoinResult }).data;
    expect(data.snapshot).toEqual({ logId: log.id, content: 'Hello', version: 0 });
    expect((await presence).viewers).toBe(1);

    await writer.emitWithAck('log:join', log.id);

    const received = next(viewer, 'live:op');
    const ack = await writer.emitWithAck('live:op', {
      logId: log.id,
      baseVersion: 0,
      op: { pos: 5, del: 0, ins: ', diary' },
    });
    expect(ack).toEqual({ ok: true, data: { version: 1 } });
    expect(await received).toEqual({
      logId: log.id,
      op: { pos: 5, del: 0, ins: ', diary' },
      version: 1,
    });

    // A stale base version is rejected so the writer resyncs with a full snapshot.
    const stale = await writer.emitWithAck('live:op', {
      logId: log.id,
      baseVersion: 0,
      op: { pos: 0, del: 0, ins: 'x' },
    });
    expect(stale).toMatchObject({ ok: false, code: 'VERSION_MISMATCH' });

    const snapshot = next(viewer, 'live:snapshot');
    await writer.emitWithAck('live:replace', { logId: log.id, content: 'Hello, diary!' });
    expect(await snapshot).toMatchObject({ content: 'Hello, diary!', version: 2 });

    // Readers can never write.
    const forbidden = await viewer.emitWithAck('live:op', {
      logId: log.id,
      baseVersion: 2,
      op: { pos: 0, del: 0, ins: 'hack' },
    });
    expect(forbidden).toMatchObject({ ok: false, code: 'FORBIDDEN' });

    const ended = next(viewer, 'live:ended');
    const res = await request(ctx.app)
      .post(`/api/admin/logs/${log.id}/end-live`)
      .set(admin.auth)
      .send({ publish: true })
      .expect(200);
    expect(await ended).toMatchObject({ logId: log.id, status: 'published' });
    expect(res.body.data.content).toBe('Hello, diary!');
  });

  it('broadcasts new comments and reactions to the room', async () => {
    const log = await createLog(ctx.app, admin, { title: 'Chatty entry' });
    await request(ctx.app).post(`/api/admin/logs/${log.id}/publish`).set(admin.auth).expect(200);
    const viewer = await client();
    await viewer.emitWithAck('log:join', log.id);

    const comment = next(viewer, 'comment:new');
    await request(ctx.app)
      .post(`/api/logs/${log.id}/comments`)
      .set(admin.auth)
      .send({ body: 'Welcome in' })
      .expect(201);
    expect((await comment).body).toBe('Welcome in');

    const reaction = next(viewer, 'reaction:update');
    await request(ctx.app)
      .put(`/api/logs/${log.id}/reactions/inspired`)
      .set(admin.auth)
      .expect(200);
    expect(await reaction).toMatchObject({ type: 'inspired', delta: 1, counts: { inspired: 1 } });
  });
});
