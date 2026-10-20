import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createLog,
  createTestContext,
  publishedLog,
  signup,
  signupAdmin,
  type TestContext,
  type TestUser,
} from './helpers';

let ctx: TestContext;
let admin: TestUser;

beforeAll(async () => {
  ctx = await createTestContext();
  admin = await signupAdmin(ctx.app);
});
afterAll(() => ctx.close());

describe('logs', () => {
  it('creates drafts that are invisible to the public', async () => {
    const draft = await createLog(ctx.app, admin, { title: 'Secret draft' });
    expect(draft).toMatchObject({ status: 'draft', slug: 'secret-draft' });

    await request(ctx.app).get(`/api/logs/${draft.slug}`).expect(404);
    const list = await request(ctx.app).get('/api/logs').expect(200);
    expect(list.body.data.items.map((l: { id: string }) => l.id)).not.toContain(draft.id);
  });

  it('publishes, counts views and keeps the slug stable after publishing', async () => {
    const log = await publishedLog(ctx.app, admin, { title: 'Morning pages' });
    const read = await request(ctx.app).get(`/api/logs/${log.slug}`).expect(200);
    expect(read.body.data).toMatchObject({
      status: 'published',
      viewCount: 1,
      title: 'Morning pages',
    });
    expect(read.body.data.publishedAt).toEqual(expect.any(String));

    const renamed = await request(ctx.app)
      .patch(`/api/admin/logs/${log.id}`)
      .set(admin.auth)
      .send({ title: 'Morning pages, revisited' })
      .expect(200);
    expect(renamed.body.data.slug).toBe(log.slug);
  });

  it('generates unique slugs for duplicate titles', async () => {
    const a = await createLog(ctx.app, admin, { title: 'Twin title' });
    const b = await createLog(ctx.app, admin, { title: 'Twin title' });
    expect(a.slug).toBe('twin-title');
    expect(b.slug).toMatch(/^twin-title-[0-9a-f]{6}$/);
  });

  it('enforces the status state machine', async () => {
    const log = await createLog(ctx.app, admin);
    await request(ctx.app).post(`/api/admin/logs/${log.id}/archive`).set(admin.auth).expect(200);
    await request(ctx.app)
      .post(`/api/admin/logs/${log.id}/schedule`)
      .set(admin.auth)
      .send({ scheduledFor: new Date(Date.now() + 3_600_000).toISOString() })
      .expect(409)
      .expect((res) => expect(res.body.error.code).toBe('INVALID_TRANSITION'));
  });

  it('filters by tag and searches titles', async () => {
    const tag = await request(ctx.app)
      .post('/api/admin/tags')
      .set(admin.auth)
      .send({ name: 'Rainy days' })
      .expect(201);
    await publishedLog(ctx.app, admin, {
      title: 'Puddles and umbrellas',
      tagIds: [tag.body.data.id],
    });

    const byTag = await request(ctx.app).get('/api/logs?tag=rainy-days').expect(200);
    expect(byTag.body.data.items).toHaveLength(1);
    expect(byTag.body.data.items[0].tags[0]).toMatchObject({ slug: 'rainy-days' });

    const search = await request(ctx.app).get('/api/logs?q=umbrella').expect(200);
    expect(search.body.data.items[0].title).toBe('Puddles and umbrellas');

    const tags = await request(ctx.app).get('/api/tags').expect(200);
    expect(tags.body.data.find((t: { slug: string }) => t.slug === 'rainy-days').logCount).toBe(1);
  });

  it('shows the next scheduled entry in the live status', async () => {
    const log = await createLog(ctx.app, admin, { title: 'Tomorrow at dawn' });
    const when = new Date(Date.now() + 86_400_000).toISOString();
    await request(ctx.app)
      .post(`/api/admin/logs/${log.id}/schedule`)
      .set(admin.auth)
      .send({ scheduledFor: when })
      .expect(200);

    const status = await request(ctx.app).get('/api/live/status').expect(200);
    expect(status.body.data.live).toBeNull();
    expect(status.body.data.next).toMatchObject({ id: log.id, scheduledFor: when });

    await request(ctx.app).post(`/api/admin/logs/${log.id}/unschedule`).set(admin.auth).expect(200);
  });

  it('goes live, notifies active subscribers once, and publishes on end', async () => {
    const { repos } = ctx.container;
    await repos.subscribers.create({
      email: 'active@livelog.test',
      status: 'active',
      unsubscribeToken: 'u'.repeat(40),
    });
    await repos.subscribers.create({
      email: 'pending@livelog.test',
      status: 'pending',
      unsubscribeToken: 'p'.repeat(40),
    });

    const log = await createLog(ctx.app, admin, { title: 'Writing in the open' });
    const live = await request(ctx.app)
      .post(`/api/admin/logs/${log.id}/go-live`)
      .set(admin.auth)
      .expect(200);
    expect(live.body.data.status).toBe('live');

    // Only one entry may be live at a time.
    const other = await createLog(ctx.app, admin, { title: 'Second stream' });
    await request(ctx.app)
      .post(`/api/admin/logs/${other.id}/go-live`)
      .set(admin.auth)
      .expect(409)
      .expect((res) => expect(res.body.error.code).toBe('ANOTHER_LOG_LIVE'));

    const status = await request(ctx.app).get('/api/live/status').expect(200);
    expect(status.body.data.live.id).toBe(log.id);
    await request(ctx.app).get(`/api/logs/${log.slug}`).expect(200);

    // Typing reaches the hub, and is persisted when the stream ends.
    const hub = ctx.container.live;
    const result = await hub.applyOp(log.id, 0, { pos: 0, del: 0, ins: 'Live words. ' });
    expect(result).toEqual({ ok: true, version: 1 });

    const ended = await request(ctx.app)
      .post(`/api/admin/logs/${log.id}/end-live`)
      .set(admin.auth)
      .send({ publish: true })
      .expect(200);
    expect(ended.body.data).toMatchObject({ status: 'published' });
    expect(ended.body.data.content.startsWith('Live words. ')).toBe(true);

    const sent = await ctx.container.outboxWorker.drain();
    expect(sent).toBe(1);
    expect(ctx.mailer.sent.map((m) => m.to)).toEqual(['active@livelog.test']);
    expect(ctx.mailer.sent[0]!.subject).toContain('Writing in the open');

    // Going live again within the cooldown does not email again.
    await request(ctx.app).post(`/api/admin/logs/${log.id}/go-live`).set(admin.auth).expect(200);
    await request(ctx.app)
      .post(`/api/admin/logs/${log.id}/end-live`)
      .set(admin.auth)
      .send({})
      .expect(200);
    expect(await ctx.container.outboxWorker.drain()).toBe(0);

    const history = await request(ctx.app)
      .get('/api/admin/live-sessions')
      .set(admin.auth)
      .expect(200);
    expect(history.body.data.items).toHaveLength(2);
    expect(history.body.data.items[1].notifiedSubscribers).toBe(1);
  });

  it('refuses to delete a live entry', async () => {
    const log = await createLog(ctx.app, admin, { title: 'Cannot delete me' });
    await request(ctx.app).post(`/api/admin/logs/${log.id}/go-live`).set(admin.auth).expect(200);
    await request(ctx.app).delete(`/api/admin/logs/${log.id}`).set(admin.auth).expect(409);
    await request(ctx.app)
      .post(`/api/admin/logs/${log.id}/end-live`)
      .set(admin.auth)
      .send({ publish: false })
      .expect(200);
    await request(ctx.app).delete(`/api/admin/logs/${log.id}`).set(admin.auth).expect(204);
  });

  it('reports admin stats', async () => {
    const reader = await signup(ctx.app);
    await request(ctx.app).get('/api/admin/logs').set(reader.auth).expect(403);
    const stats = await request(ctx.app).get('/api/admin/stats').set(admin.auth).expect(200);
    expect(stats.body.data.logs.published).toBeGreaterThan(0);
    expect(stats.body.data.subscribers.active).toBe(1);
  });
});
