import type {
  ListSubscribersQuery,
  MessageDto,
  Paginated,
  SubscribeInput,
  SubscriberDto,
} from '@livelog/shared';
import { randomToken, sha256 } from '../../lib/crypto';
import { Errors } from '../../lib/errors';
import type { EventBus } from '../../lib/events';
import { paginate } from '../../lib/pagination';
import type { Repositories, RunInTransaction } from '../repositories';
import { toSubscriberDto } from './subscriber.mapper';

const CONFIRM_TTL_MS = 48 * 60 * 60 * 1000;

/** Same answer whether or not the address is known, so the endpoint can't be used to probe emails. */
const SUBSCRIBE_MESSAGE =
  'Check your inbox: a confirmation letter is on its way (if you were not already subscribed).';

export class SubscriberService {
  constructor(
    private readonly deps: { repos: Repositories; transaction: RunInTransaction; events: EventBus },
  ) {}

  async subscribe(input: SubscribeInput): Promise<MessageDto> {
    await this.deps.transaction(async (repos) => {
      const existing = await repos.subscribers.findByEmail(input.email);
      if (existing?.status === 'active') return;

      const token = randomToken(32);
      const confirmation = {
        confirmTokenHash: sha256(token),
        confirmTokenExpiresAt: new Date(Date.now() + CONFIRM_TTL_MS),
      };
      if (existing) {
        await repos.subscribers.update(existing.id, { ...confirmation, status: 'pending' });
      } else {
        await repos.subscribers.create({
          email: input.email,
          unsubscribeToken: randomToken(32),
          ...confirmation,
        });
      }
      await repos.outbox.enqueue([
        { kind: 'subscribe_confirm', toEmail: input.email, payload: { token } },
      ]);
    });
    return { message: SUBSCRIBE_MESSAGE };
  }

  async confirm(token: string): Promise<MessageDto> {
    const { subscribers } = this.deps.repos;
    const subscriber = await subscribers.findByConfirmTokenHash(sha256(token));
    if (
      !subscriber ||
      !subscriber.confirmTokenExpiresAt ||
      subscriber.confirmTokenExpiresAt < new Date()
    ) {
      throw Errors.badRequest(
        'This confirmation link has expired. Please subscribe again.',
        'TOKEN_EXPIRED_LINK',
      );
    }
    await subscribers.update(subscriber.id, {
      status: 'active',
      confirmedAt: new Date(),
      confirmTokenHash: null,
      confirmTokenExpiresAt: null,
      unsubscribedAt: null,
    });
    this.deps.events.emit('subscriber.confirmed', { email: subscriber.email });
    return { message: 'You are on the list. You will get a letter the moment I start writing.' };
  }

  async unsubscribe(token: string): Promise<MessageDto> {
    const { subscribers } = this.deps.repos;
    const subscriber = await subscribers.findByUnsubscribeToken(token);
    if (!subscriber) throw Errors.notFound('Subscription');
    if (subscriber.status !== 'unsubscribed') {
      await subscribers.update(subscriber.id, {
        status: 'unsubscribed',
        unsubscribedAt: new Date(),
      });
    }
    return { message: 'You have been unsubscribed. No more letters, promise.' };
  }

  async adminList(query: ListSubscribersQuery): Promise<Paginated<SubscriberDto>> {
    const { rows, total } = await this.deps.repos.subscribers.list(query, query);
    return paginate(rows.map(toSubscriberDto), total, query);
  }

  async adminRemove(id: string): Promise<void> {
    if (!(await this.deps.repos.subscribers.delete(id))) throw Errors.notFound('Subscriber');
  }
}
