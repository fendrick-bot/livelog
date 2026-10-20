/**
 * Seeds an admin account (from ADMIN_EMAIL / ADMIN_PASSWORD), a few tags and
 * a welcome entry. Safe to run repeatedly.
 */
import { eq } from 'drizzle-orm';
import { readingMinutes, slugify } from '@livelog/shared';
import { loadConfig, loadDotEnv } from '../config/env';
import { hashPassword } from '../lib/crypto';
import { createLogger } from '../lib/logger';
import { createDatabase } from './client';
import { logs, logTags, tags, users } from './schema';

loadDotEnv();
const config = loadConfig();
const logger = createLogger(config);
const handle = await createDatabase(config, logger);
const { db } = handle;

const adminEmail = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD ?? '';
const adminName = process.env.ADMIN_NAME?.trim() || 'The Diarist';

try {
  if (config.db.autoMigrate) await handle.migrate();
  if (!adminEmail || adminPassword.length < 8) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (8+ chars) to seed the admin account');
  }

  let [admin] = await db.select().from(users).where(eq(users.email, adminEmail));
  if (!admin) {
    [admin] = await db
      .insert(users)
      .values({
        email: adminEmail,
        displayName: adminName,
        role: 'admin',
        passwordHash: await hashPassword(adminPassword),
      })
      .returning();
    logger.info({ email: adminEmail }, 'admin account created');
  } else if (admin.role !== 'admin') {
    [admin] = await db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.id, admin.id))
      .returning();
    logger.info({ email: adminEmail }, 'existing account promoted to admin');
  } else {
    logger.info({ email: adminEmail }, 'admin account already exists');
  }
  if (!admin) throw new Error('Failed to create the admin account');

  const tagNames = ['Reflections', 'Late nights', 'Letters', 'Small joys', 'Becoming'];
  await db
    .insert(tags)
    .values(tagNames.map((name) => ({ name, slug: slugify(name) })))
    .onConflictDoNothing();

  const welcomeSlug = 'the-first-page';
  const [existing] = await db.select({ id: logs.id }).from(logs).where(eq(logs.slug, welcomeSlug));
  if (!existing) {
    const content = [
      '# The first page',
      '',
      'Every diary starts with a blank page and a little nerve.',
      '',
      'This one is different: you can **watch it being written**. When I go live, every word',
      'appears on your screen as I type it — the hesitations, the crossed-out lines, the',
      'sudden rush of a sentence that finally lands.',
      '',
      'Pull up a chair. Turn the soundscape on. Leave a note in the margin if something',
      'moves you.',
      '',
      '> Some things are only true while they are being written.',
    ].join('\n');
    const [log] = await db
      .insert(logs)
      .values({
        authorId: admin.id,
        title: 'The first page',
        slug: welcomeSlug,
        content,
        readingMinutes: readingMinutes(content),
        status: 'published',
        publishedAt: new Date(),
      })
      .returning();
    const [reflections] = await db.select().from(tags).where(eq(tags.slug, 'reflections'));
    if (log && reflections)
      await db.insert(logTags).values({ logId: log.id, tagId: reflections.id });
    logger.info('welcome entry created');
  }
  logger.info('seed complete');
} catch (error) {
  logger.error({ err: error }, 'seed failed');
  process.exitCode = 1;
} finally {
  await handle.close();
}
