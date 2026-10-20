import type { Config } from './config/env';
import type { DatabaseHandle } from './db/client';
import { EventBus } from './lib/events';
import type { Logger } from './lib/logger';
import { AccessTokens } from './lib/tokens';
import { createRateLimiters } from './middleware/rate-limit';
import { AdminService } from './modules/admin/admin.service';
import { AuthService } from './modules/auth/auth.service';
import { CommentService } from './modules/comments/comment.service';
import { LiveHub } from './modules/live/live-hub';
import { LogService } from './modules/logs/log.service';
import type { Mailer } from './modules/notifications/mailer';
import { OutboxWorker } from './modules/notifications/outbox.worker';
import { ReactionService } from './modules/reactions/reaction.service';
import { createRepositories, createTransactionRunner } from './modules/repositories';
import { StoryService } from './modules/stories/story.service';
import { SubscriberService } from './modules/subscribers/subscriber.service';
import { TagService } from './modules/tags/tag.service';

/**
 * Composition root: the only place that knows how the pieces fit together.
 * Tests build the same container around an in-memory PGlite database.
 */
export function createContainer(deps: {
  config: Config;
  logger: Logger;
  database: DatabaseHandle;
  mailer: Mailer;
}) {
  const { config, logger, database, mailer } = deps;
  const repos = createRepositories(database.db);
  const transaction = createTransactionRunner(database.db);
  const events = new EventBus(logger);
  const tokens = new AccessTokens(config.auth.accessSecret, config.auth.accessTtlSeconds);
  const live = new LiveHub({ logs: repos.logs, logger });

  const logs = new LogService({ repos, transaction, live, events });
  const services = {
    auth: new AuthService({ repos, tokens, config: config.auth }),
    logs,
    tags: new TagService({ repos }),
    comments: new CommentService({ repos, events }),
    reactions: new ReactionService({ repos, events }),
    stories: new StoryService({ repos, transaction, events, logs }),
    subscribers: new SubscriberService({ repos, transaction, events }),
    admin: new AdminService({ repos }),
  };

  const outboxWorker = new OutboxWorker({
    outbox: repos.outbox,
    mailer,
    logger,
    publicUrl: config.publicUrl,
    pollMs: config.mail.pollMs,
  });

  return {
    config,
    logger,
    database,
    events,
    tokens,
    live,
    repos,
    services,
    outboxWorker,
    limiters: createRateLimiters(config.rateLimitEnabled),
  };
}

export type Container = ReturnType<typeof createContainer>;
