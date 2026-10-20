import {
  readingMinutes,
  type AcceptStoryInput,
  type ListStoriesQuery,
  type Paginated,
  type RejectStoryInput,
  type StoryRequestDto,
  type SubmitStoryInput,
} from '@livelog/shared';
import { Errors } from '../../lib/errors';
import type { EventBus } from '../../lib/events';
import { paginate } from '../../lib/pagination';
import type { AuthUser } from '../../lib/tokens';
import type { LogService } from '../logs/log.service';
import type { Repositories, RunInTransaction } from '../repositories';
import { toStoryDto } from './story.mapper';

export class StoryService {
  constructor(
    private readonly deps: {
      repos: Repositories;
      transaction: RunInTransaction;
      events: EventBus;
      logs: LogService;
    },
  ) {}

  async submit(auth: AuthUser, input: SubmitStoryInput): Promise<StoryRequestDto> {
    const row = await this.deps.repos.stories.create({
      submitterId: auth.id,
      title: input.title,
      pitch: input.pitch,
      content: input.content,
      mood: input.mood ?? null,
      isAnonymous: input.isAnonymous,
      contactEmail: input.contactEmail ?? null,
    });
    const dto = await this.get(row.id);
    this.deps.events.emit('story.submitted', { story: dto });
    return dto;
  }

  async listMine(auth: AuthUser): Promise<StoryRequestDto[]> {
    const rows = await this.deps.repos.stories.listBySubmitter(auth.id);
    return rows.map(toStoryDto);
  }

  async adminList(query: ListStoriesQuery): Promise<Paginated<StoryRequestDto>> {
    const { rows, total } = await this.deps.repos.stories.list(query, query);
    return paginate(rows.map(toStoryDto), total, query);
  }

  async get(id: string): Promise<StoryRequestDto> {
    const row = await this.deps.repos.stories.findById(id);
    if (!row) throw Errors.notFound('Story');
    return toStoryDto(row);
  }

  /** Publishes the story as a community log, records the decision and emails the writer. */
  async accept(id: string, admin: AuthUser, input: AcceptStoryInput): Promise<StoryRequestDto> {
    if (input.tagIds?.length) await this.deps.logs.assertTagsExist(input.tagIds);

    const logId = await this.deps.transaction(async (repos) => {
      const story = await repos.stories.findById(id);
      if (!story) throw Errors.notFound('Story');
      if (story.status !== 'pending') {
        throw Errors.conflict('This story has already been reviewed', 'STORY_ALREADY_REVIEWED');
      }

      const title = input.title ?? story.title;
      const content = input.content ?? story.content;
      const now = new Date();
      const log = await repos.logs.create({
        authorId: story.submitterId ?? admin.id,
        kind: 'community',
        status: 'published',
        title,
        slug: await this.deps.logs.uniqueSlug(title, repos),
        content,
        excerpt: story.pitch.slice(0, 300),
        readingMinutes: readingMinutes(content),
        byline: story.isAnonymous ? 'Anonymous' : story.submitterId ? null : 'A reader',
        publishedAt: now,
      });
      if (input.tagIds?.length) await repos.logs.setTags(log.id, [...new Set(input.tagIds)]);

      await repos.stories.update(id, {
        status: 'accepted',
        adminNote: input.note ?? null,
        reviewedById: admin.id,
        reviewedAt: now,
        publishedLogId: log.id,
      });

      const recipient = story.contactEmail ?? story.submitter?.email;
      if (recipient) {
        await repos.outbox.enqueue([
          {
            kind: 'story_reviewed',
            toEmail: recipient,
            payload: {
              storyTitle: story.title,
              accepted: true,
              note: input.note ?? null,
              logSlug: log.slug,
            },
          },
        ]);
      }
      return log.id;
    });

    const dto = await this.get(id);
    this.deps.events.emit('story.reviewed', { story: dto });
    await this.deps.logs.announce(logId, null);
    return dto;
  }

  async reject(id: string, admin: AuthUser, input: RejectStoryInput): Promise<StoryRequestDto> {
    await this.deps.transaction(async (repos) => {
      const story = await repos.stories.findById(id);
      if (!story) throw Errors.notFound('Story');
      if (story.status !== 'pending') {
        throw Errors.conflict('This story has already been reviewed', 'STORY_ALREADY_REVIEWED');
      }
      await repos.stories.update(id, {
        status: 'rejected',
        adminNote: input.note ?? null,
        reviewedById: admin.id,
        reviewedAt: new Date(),
      });
      const recipient = story.contactEmail ?? story.submitter?.email;
      if (recipient) {
        await repos.outbox.enqueue([
          {
            kind: 'story_reviewed',
            toEmail: recipient,
            payload: {
              storyTitle: story.title,
              accepted: false,
              note: input.note ?? null,
              logSlug: null,
            },
          },
        ]);
      }
    });
    const dto = await this.get(id);
    this.deps.events.emit('story.reviewed', { story: dto });
    return dto;
  }
}
