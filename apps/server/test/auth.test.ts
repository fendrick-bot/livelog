import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  cookieValue,
  createTestContext,
  PASSWORD,
  signup,
  signupAdmin,
  toCookieArray,
  type TestContext,
} from './helpers';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(() => ctx.close());

describe('auth', () => {
  it('signs up a reader and sets session cookies', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/signup')
      .send({ email: '  Ada@Example.com ', password: PASSWORD, displayName: 'Ada' })
      .expect(201);

    expect(res.body.data.user).toMatchObject({ email: 'ada@example.com', role: 'reader' });
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    const cookies = toCookieArray(res.headers['set-cookie']);
    expect(cookies.find((c) => c.startsWith('ll_rt='))).toMatch(/HttpOnly/i);
    expect(cookies.find((c) => c.startsWith('ll_session='))).toBeDefined();
  });

  it('rejects a duplicate email and invalid input', async () => {
    await request(ctx.app)
      .post('/api/auth/signup')
      .send({ email: 'ada@example.com', password: PASSWORD, displayName: 'Ada again' })
      .expect(409)
      .expect((res) => expect(res.body.error.code).toBe('EMAIL_TAKEN'));

    const invalid = await request(ctx.app)
      .post('/api/auth/signup')
      .send({ email: 'not-an-email', password: 'short', displayName: 'A' })
      .expect(400);
    expect(invalid.body.error.code).toBe('VALIDATION_FAILED');
    expect(Object.keys(invalid.body.error.details.fieldErrors)).toEqual(
      expect.arrayContaining(['email', 'password', 'displayName']),
    );
  });

  it('grants the admin role to configured admin emails', async () => {
    const admin = await signupAdmin(ctx.app);
    const me = await request(ctx.app).get('/api/auth/me').set(admin.auth).expect(200);
    expect(me.body.data.role).toBe('admin');
  });

  it('logs in with the right password only', async () => {
    await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'ada@example.com', password: 'wrong password' })
      .expect(401)
      .expect((res) => expect(res.body.error.code).toBe('INVALID_CREDENTIALS'));
    await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'ADA@example.com', password: PASSWORD })
      .expect(200);
  });

  it('rotates refresh tokens and detects reuse', async () => {
    const user = await signup(ctx.app);
    const original = cookieValue(user.cookies, 'll_rt')!;

    const first = await request(ctx.app)
      .post('/api/auth/refresh')
      .set('Cookie', original)
      .expect(200);
    const rotated = cookieValue(toCookieArray(first.headers['set-cookie']), 'll_rt')!;
    expect(rotated).not.toBe(original);

    // Re-using the old token right away is treated as a harmless race between tabs.
    await request(ctx.app)
      .post('/api/auth/refresh')
      .set('Cookie', original)
      .expect(401)
      .expect((res) => expect(res.body.error.code).toBe('REFRESH_STALE'));

    // The rotated token keeps working.
    await request(ctx.app).post('/api/auth/refresh').set('Cookie', rotated).expect(200);
  });

  it('rejects expired/invalid access tokens with a refreshable error code', async () => {
    await request(ctx.app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-token')
      .expect(401)
      .expect((res) => expect(res.body.error.code).toBe('TOKEN_INVALID'));
  });

  it('lists and revokes device sessions, and logout ends the session', async () => {
    const user = await signup(ctx.app);
    const sessions = await request(ctx.app).get('/api/auth/sessions').set(user.auth).expect(200);
    expect(sessions.body.data).toHaveLength(1);
    expect(sessions.body.data[0].current).toBe(true);

    const refreshCookie = cookieValue(user.cookies, 'll_rt')!;
    await request(ctx.app).post('/api/auth/logout').set('Cookie', refreshCookie).expect(204);
    await request(ctx.app)
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie)
      .expect(401)
      .expect((res) => expect(res.body.error.code).toBe('SESSION_EXPIRED'));
  });

  it('keeps admin routes away from readers', async () => {
    const reader = await signup(ctx.app);
    await request(ctx.app).get('/api/admin/stats').set(reader.auth).expect(403);
    await request(ctx.app).get('/api/admin/stats').expect(401);
  });
});
