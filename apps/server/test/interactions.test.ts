import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestContext,
  publishedLog,
  signup,
  signupAdmin,
  type TestContext,
  type TestUser,
} from './helpers';

let ctx: TestContext;
let admin: TestUser;
let reader: TestUser;

beforeAll(async () => {
  ctx = await createTestContext();
  admin = await signupAdmin(ctx.app);
  reader = await signup(ctx.app, { displayName: 'Margot' });
});
afterAll(() => ctx.close());

describe('comments', () => {
  it('lets signed-in readers comment and reply, newest first', async () => {
    const log = await publishedLog(ctx.app, admin);
    await request(ctx.app).post(`/api/logs/${log.id}/comments`).send({ body: 'Hi' }).expect(401);

    const first = await request(ctx.app)
      .post(`/api/logs/${log.id}/comments`)
      .set(reader.auth)
      .send({ body: 'This made my evening.' })
      .expect(201);
    expect(first.body.data.author).toMatchObject({ displayName: 'Margot', isAdmin: false });
    expect(first.body.data.author.email).toBeUndefined();

    await request(ctx.app)
      .post(`/api/logs/${log.id}/comments`)
      .set(admin.auth)
      .send({ body: 'Thank you for reading.', parentId: first.body.data.id })
      .expect(201);
    await request(ctx.app)
      .post(`/api/logs/${log.id}/comments`)
      .set(reader.auth)
      .send({ body: 'Second!' })
      .expect(201);

    const list = await request(ctx.app).get(`/api/logs/${log.id}/comments`).expect(200);
    expect(list.body.data.total).toBe(2);
    expect(list.body.data.items[0].body).toBe('Second!');
    expect(list.body.data.items[1].replies[0]).toMatchObject({ body: 'Thank you for reading.' });
  });

  it('respects the allow-comments switch (admins can still write)', async () => {
    const log = await publishedLog(ctx.app, admin, { allowComments: false });
    await request(ctx.app)
      .post(`/api/logs/${log.id}/comments`)
      .set(reader.auth)
      .send({ body: 'Can I?' })
      .expect(403)
      .expect((res) => expect(res.body.error.code).toBe('COMMENTS_CLOSED'));
    await request(ctx.app)
      .post(`/api/logs/${log.id}/comments`)
      .set(admin.auth)
      .send({ body: 'Note to self' })
      .expect(201);
  });

  it('lets authors delete their notes and admins hide others', async () => {
    const log = await publishedLog(ctx.app, admin);
    const other = await signup(ctx.app);
    const comment = await request(ctx.app)
      .post(`/api/logs/${log.id}/comments`)
      .set(reader.auth)
      .send({ body: 'Mine' })
      .expect(201);

    await request(ctx.app)
      .delete(`/api/comments/${comment.body.data.id}`)
      .set(other.auth)
      .expect(403);

    await request(ctx.app)
      .patch(`/api/admin/comments/${comment.body.data.id}`)
      .set(admin.auth)
      .send({ status: 'hidden' })
      .expect(200);
    const list = await request(ctx.app).get(`/api/logs/${log.id}/comments`).expect(200);
    expect(list.body.data.total).toBe(0);

    await request(ctx.app)
      .delete(`/api/comments/${comment.body.data.id}`)
      .set(reader.auth)
      .expect(204);
  });

  it('does not allow comments on drafts', async () => {
    const draft = await request(ctx.app)
      .post('/api/admin/logs')
      .set(admin.auth)
      .send({ title: 'Hidden' })
      .expect(201);
    await request(ctx.app)
      .post(`/api/logs/${draft.body.data.id}/comments`)
      .set(reader.auth)
      .send({ body: 'x' })
      .expect(404);
  });
});

describe('reactions', () => {
  it('toggles reactions idempotently and reports counts', async () => {
    const log = await publishedLog(ctx.app, admin);
    const add = await request(ctx.app)
      .put(`/api/logs/${log.id}/reactions/love`)
      .set(reader.auth)
      .expect(200);
    expect(add.body.data.counts.love).toBe(1);
    expect(add.body.data.viewerReactions).toEqual(['love']);

    const again = await request(ctx.app)
      .put(`/api/logs/${log.id}/reactions/love`)
      .set(reader.auth)
      .expect(200);
    expect(again.body.data.counts.love).toBe(1);

    const detail = await request(ctx.app).get(`/api/logs/${log.slug}`).set(reader.auth).expect(200);
    expect(detail.body.data.viewerReactions).toEqual(['love']);
    expect(detail.body.data.reactionCounts.love).toBe(1);

    const removed = await request(ctx.app)
      .delete(`/api/logs/${log.id}/reactions/love`)
      .set(reader.auth)
      .expect(200);
    expect(removed.body.data.counts.love).toBe(0);

    await request(ctx.app).put(`/api/logs/${log.id}/reactions/shrug`).set(reader.auth).expect(400);
  });

  it('respects the allow-reactions switch', async () => {
    const log = await publishedLog(ctx.app, admin, { allowReactions: false });
    await request(ctx.app)
      .put(`/api/logs/${log.id}/reactions/like`)
      .set(reader.auth)
      .expect(403)
      .expect((res) => expect(res.body.error.code).toBe('REACTIONS_CLOSED'));
  });
});
