import { isPublicStatus, type ReactionStateDto, type ReactionType } from '@livelog/shared';
import { Errors } from '../../lib/errors';
import type { EventBus } from '../../lib/events';
import type { AuthUser } from '../../lib/tokens';
import type { Repositories } from '../repositories';

export class ReactionService {
  constructor(private readonly deps: { repos: Repositories; events: EventBus }) {}

  /** Idempotent: setting a reaction that already exists (or removing a missing one) is a no-op. */
  async set(
    logId: string,
    auth: AuthUser,
    type: ReactionType,
    active: boolean,
  ): Promise<ReactionStateDto> {
    const { logs, reactions } = this.deps.repos;
    const log = await logs.findById(logId);
    if (!log || (!isPublicStatus(log.status) && auth.role !== 'admin'))
      throw Errors.notFound('Log');
    if (!log.allowReactions && auth.role !== 'admin') {
      throw Errors.forbidden('Reactions are turned off for this entry', 'REACTIONS_CLOSED');
    }

    const changed = active
      ? await reactions.add(logId, auth.id, type)
      : await reactions.remove(logId, auth.id, type);

    const [counts, viewerReactions] = await Promise.all([
      reactions.countsFor(logId),
      reactions.forUser(logId, auth.id),
    ]);
    if (changed) {
      this.deps.events.emit('reaction.changed', { logId, type, delta: active ? 1 : -1, counts });
    }
    return { logId, counts, viewerReactions };
  }
}
