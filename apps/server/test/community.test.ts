import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, signup, signupAdmin, type TestContext, type TestUser } from './helpers';

let ctx: TestContext;
let admin: TestUser;
let writer: TestUser;

const story = {
  title: 'The summer I learned to swim',
  pitch: 'A small story about fear, a lake, and a very patient grandmother.',
  content: 'It was the summer the lake felt endless. '.repeat(10),
  mood: 'nostalgic',
  consent: true,
};

beforeAll(async () => {
  ctx = await createTestContext();
  admin = await signupAdmin(ctx.app);
  writer = await signup(ctx.app, { displayName: 'Ines', email: 'ines@livelog.test' });
});
afterAll(() => ctx.close());

describe('story requests', () => {
  it('requires an account, consent and enough words', async () => {
    await request(ctx.app).post('/api/stories').send(story).expect(401);
    const invalid = await request(ctx.app)
      .post('/api/stories')
      .set(writer.auth)
      .send({ ...story, consent: false, content: 'too short' })
      .expect(400);
    expect(Object.keys(invalid.body.error.details.fieldErrors)).toEqual(
      expect.arrayContaining(['consent', 'content']),
    );
  });

  it('publishes accepted stories in the community section and emails the writer', async () => {
    const submitted = await request(ctx.app)
      .post('/api/stories')
      .set(writer.auth)
      .send(story)
      .expect(201);
    expect(submitted.body.data.status).toBe('pending');

    const mine = await request(ctx.app).get('/api/stories/mine').set(writer.auth).expect(200);
    expect(mine.body.data).toHaveLength(1);

    const accepted = await request(ctx.app)
      .post(`/api/admin/stories/${submitted.body.data.id}/accept`)
      .set(admin.auth)
      .send({ note: 'Beautiful.' })
      .expect(200);
    expect(accepted.body.data.status).toBe('accepted');
    const slug = accepted.body.data.publishedLog.slug;

    const community = await request(ctx.app).get('/api/logs?kind=community').expect(200);
    expect(community.body.data.items).toHaveLength(1);
    expect(community.body.data.items[0]).toMatchObject({
      kind: 'community',
      slug,
      author: { displayName: 'Ines' },
    });

    await request(ctx.app)
      .post(`/api/admin/stories/${submitted.body.data.id}/reject`)
      .set(admin.auth)
      .send({})
      .expect(409);

    await ctx.container.outboxWorker.drain();
    const mail = ctx.mailer.sent.find((m) => m.to === 'ines@livelog.test');
    expect(mail?.subject).toContain('is now part of the diary');
    expect(mail?.text).toContain(`http://diary.test/logs/${slug}`);
  });

  it('publishes anonymous stories without revealing the writer', async () => {
    const submitted = await request(ctx.app)
      .post('/api/stories')
      .set(writer.auth)
      .send({ ...story, title: 'Things I never said', isAnonymous: true })
      .expect(201);
    const accepted = await request(ctx.app)
      .post(`/api/admin/stories/${submitted.body.data.id}/accept`)
      .set(admin.auth)
      .send({})
      .expect(200);
    const log = await request(ctx.app)
      .get(`/api/logs/${accepted.body.data.publishedLog.slug}`)
      .expect(200);
    expect(log.body.data.author).toEqual({
      id: null,
      displayName: 'Anonymous',
      avatarUrl: null,
      isAdmin: false,
    });
  });
});

describe('subscribers', () => {
  it('runs double opt-in and unsubscribe through emailed links', async () => {
    const res = await request(ctx.app)
      .post('/api/subscribers')
      .send({ email: 'Reader@Mail.test' })
      .expect(202);
    expect(res.body.data.message).toMatch(/inbox/);
    await ctx.container.outboxWorker.drain();

    const confirmMail = ctx.mailer.sent.find((m) => m.to === 'reader@mail.test');
    const token = /token=([\w-]+)/.exec(confirmMail!.text)![1]!;
    await request(ctx.app).post('/api/subscribers/confirm').send({ token }).expect(200);
    await request(ctx.app).post('/api/subscribers/confirm').send({ token }).expect(400);

    const list = await request(ctx.app)
      .get('/api/admin/subscribers?status=active')
      .set(admin.auth)
      .expect(200);
    expect(list.body.data.items.map((s: { email: string }) => s.email)).toContain(
      'reader@mail.test',
    );

    // Confirmation tokens are scrubbed from the outbox once sent.
    const outbox = await ctx.container.repos.outbox.findAll();
    const confirmRow = outbox.find((row) => row.kind === 'subscribe_confirm');
    expect(confirmRow?.payload).toEqual({});

    const subscriber = await ctx.container.repos.subscribers.findByEmail('reader@mail.test');
    await request(ctx.app)
      .post('/api/subscribers/unsubscribe')
      .send({ token: subscriber!.unsubscribeToken })
      .expect(200);
    const after = await ctx.container.repos.subscribers.findByEmail('reader@mail.test');
    expect(after?.status).toBe('unsubscribed');
  });

  it('retries failed deliveries with backoff', async () => {
    ctx.mailer.failNext = 1;
    await request(ctx.app).post('/api/subscribers').send({ email: 'retry@mail.test' }).expect(202);
    await ctx.container.outboxWorker.drain();
    const rows = await ctx.container.repos.outbox.findAll();
    const row = rows.find((r) => r.toEmail === 'retry@mail.test');
    expect(row).toMatchObject({ status: 'pending', attempts: 1 });
    expect(row!.sendAfter.getTime()).toBeGreaterThan(Date.now());
  });
});
