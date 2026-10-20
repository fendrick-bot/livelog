import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config/env';
import { createContainer, type Container } from '../src/container';
import { createDatabase, type DatabaseHandle } from '../src/db/client';
import { createLogger } from '../src/lib/logger';
import { MemoryMailer } from '../src/modules/notifications/mailer';

export const ADMIN_EMAIL = 'admin@livelog.test';
export const PASSWORD = 'correct horse battery';

export interface TestContext {
  app: Express;
  container: Container;
  database: DatabaseHandle;
  mailer: MemoryMailer;
  close: () => Promise<void>;
}

/** Full application wired to a fresh in-memory Postgres (PGlite) with migrations applied. */
export async function createTestContext(): Promise<TestContext> {
  const config = loadConfig({
    NODE_ENV: 'test',
    DATABASE_DRIVER: 'pglite',
    PGLITE_DATA_DIR: 'memory',
    JWT_ACCESS_SECRET: 'test-secret-that-is-definitely-long-enough',
    ADMIN_EMAILS: ADMIN_EMAIL,
    PUBLIC_URL: 'http://diary.test',
  });
  const logger = createLogger(config);
  const database = await createDatabase(config, logger);
  await database.migrate();
  const mailer = new MemoryMailer();
  const container = createContainer({ config, logger, database, mailer });
  const app = createApp(container);
  return {
    app,
    container,
    database,
    mailer,
    close: async () => {
      container.events.removeAll();
      await database.close();
    },
  };
}

export interface TestUser {
  id: string;
  token: string;
  cookies: string[];
  auth: { Authorization: string };
}

let counter = 0;

export async function signup(
  app: Express,
  overrides: { email?: string; displayName?: string } = {},
): Promise<TestUser> {
  counter++;
  const res = await request(app)
    .post('/api/auth/signup')
    .send({
      email: overrides.email ?? `reader${counter}-${Date.now()}@livelog.test`,
      password: PASSWORD,
      displayName: overrides.displayName ?? `Reader ${counter}`,
    })
    .expect(201);
  const token = res.body.data.accessToken as string;
  return {
    id: res.body.data.user.id,
    token,
    cookies: toCookieArray(res.headers['set-cookie']),
    auth: { Authorization: `Bearer ${token}` },
  };
}

export const signupAdmin = (app: Express) =>
  signup(app, { email: ADMIN_EMAIL, displayName: 'Diarist' });

export function toCookieArray(header: string | string[] | undefined): string[] {
  if (!header) return [];
  return Array.isArray(header) ? header : [header];
}

/** "ll_rt=abc; Path=/api/auth; ..." -> "ll_rt=abc" */
export function cookieValue(cookies: string[], name: string): string | undefined {
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  return match?.split(';')[0];
}

export async function createLog(
  app: Express,
  admin: TestUser,
  body: Record<string, unknown> = {},
): Promise<{ id: string; slug: string; status: string }> {
  const res = await request(app)
    .post('/api/admin/logs')
    .set(admin.auth)
    .send({ title: 'An evening entry', content: 'Dear diary, today the rain was soft.', ...body })
    .expect(201);
  return res.body.data;
}

export async function publishedLog(
  app: Express,
  admin: TestUser,
  body: Record<string, unknown> = {},
) {
  const log = await createLog(app, admin, body);
  await request(app).post(`/api/admin/logs/${log.id}/publish`).set(admin.auth).expect(200);
  return log;
}
