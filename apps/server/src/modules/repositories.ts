import type { Database, DbExecutor } from '../db/types';
import { SessionRepository } from './auth/session.repository';
import { CommentRepository } from './comments/comment.repository';
import { LiveSessionRepository } from './live/live-session.repository';
import { LogRepository } from './logs/log.repository';
import { OutboxRepository } from './notifications/outbox.repository';
import { ReactionRepository } from './reactions/reaction.repository';
import { StoryRepository } from './stories/story.repository';
import { SubscriberRepository } from './subscribers/subscriber.repository';
import { TagRepository } from './tags/tag.repository';
import { UserRepository } from './users/user.repository';

/**
 * Every repository bound to one executor (the pool, or a transaction).
 * Services receive `repos` for plain reads/writes and `transaction(fn)` to
 * get a fresh set bound to a transaction, so atomic work never leaks.
 */
export function createRepositories(db: DbExecutor) {
  return {
    users: new UserRepository(db),
    sessions: new SessionRepository(db),
    logs: new LogRepository(db),
    tags: new TagRepository(db),
    comments: new CommentRepository(db),
    reactions: new ReactionRepository(db),
    stories: new StoryRepository(db),
    subscribers: new SubscriberRepository(db),
    liveSessions: new LiveSessionRepository(db),
    outbox: new OutboxRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;

export type RunInTransaction = <T>(work: (repos: Repositories) => Promise<T>) => Promise<T>;

export function createTransactionRunner(db: Database): RunInTransaction {
  return (work) => db.transaction((tx) => work(createRepositories(tx)));
}
