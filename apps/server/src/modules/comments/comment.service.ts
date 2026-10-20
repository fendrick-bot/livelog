import {
  isPublicStatus,
  type AdminCommentDto,
  type AdminListCommentsQuery,
  type CommentDto,
  type CreateCommentInput,
  type Paginated,
  type PaginationQuery,
} from '@livelog/shared';
import { Errors } from '../../lib/errors';
import type { EventBus } from '../../lib/events';
import { paginate } from '../../lib/pagination';
import type { AuthUser } from '../../lib/tokens';
import type { Repositories } from '../repositories';
import { toAdminCommentDto, toCommentDto } from './comment.mapper';

export class CommentService {
  constructor(private readonly deps: { repos: Repositories; events: EventBus }) {}

  async list(
    logId: string,
    page: PaginationQuery,
    viewer: AuthUser | null,
  ): Promise<Paginated<CommentDto>> {
    await this.visibleLog(logId, viewer);
    const { comments } = this.deps.repos;
    const { rows, total } = await comments.listTopLevel(logId, page);
    const replies = await comments.listReplies(rows.map((row) => row.id));
    const repliesByParent = Map.groupBy(replies, (reply) => reply.parentId ?? '');
    const items = rows.map((row) =>
      toCommentDto(
        row,
        (repliesByParent.get(row.id) ?? []).map((reply) => toCommentDto(reply)),
      ),
    );
    return paginate(items, total, page);
  }

  async create(logId: string, auth: AuthUser, input: CreateCommentInput): Promise<CommentDto> {
    const log = await this.visibleLog(logId, auth);
    if (!log.allowComments && auth.role !== 'admin') {
      throw Errors.forbidden('Comments are closed for this entry', 'COMMENTS_CLOSED');
    }

    const { comments } = this.deps.repos;
    if (input.parentId) {
      const parent = await comments.findById(input.parentId);
      if (!parent || parent.logId !== logId || parent.status !== 'visible') {
        throw Errors.notFound('Parent comment');
      }
      if (parent.parentId)
        throw Errors.badRequest('Replies can only be one level deep', 'NESTING_TOO_DEEP');
    }

    const row = await comments.create({
      logId,
      authorId: auth.id,
      parentId: input.parentId ?? null,
      body: input.body,
    });
    const record = await comments.findById(row.id);
    if (!record) throw Errors.notFound('Comment');
    const dto = toCommentDto(record);
    this.deps.events.emit('comment.created', { comment: dto, logTitle: log.title });
    return dto;
  }

  async remove(commentId: string, auth: AuthUser): Promise<void> {
    const { comments } = this.deps.repos;
    const comment = await comments.findById(commentId);
    if (!comment) throw Errors.notFound('Comment');
    if (comment.authorId !== auth.id && auth.role !== 'admin') {
      throw Errors.forbidden('You can only delete your own notes');
    }
    await comments.delete(commentId);
    this.deps.events.emit('comment.removed', { logId: comment.logId, commentId });
  }

  async adminList(query: AdminListCommentsQuery): Promise<Paginated<AdminCommentDto>> {
    const { rows, total } = await this.deps.repos.comments.adminList(query, query);
    return paginate(rows.map(toAdminCommentDto), total, query);
  }

  async moderate(commentId: string, status: CommentDto['status']): Promise<CommentDto> {
    const { comments } = this.deps.repos;
    const existing = await comments.findById(commentId);
    if (!existing) throw Errors.notFound('Comment');
    await comments.setStatus(commentId, status);
    const updated = await comments.findById(commentId);
    if (!updated) throw Errors.notFound('Comment');
    const dto = toCommentDto(updated);

    if (existing.status !== status) {
      if (status === 'hidden') {
        this.deps.events.emit('comment.removed', { logId: dto.logId, commentId });
      } else {
        const log = await this.deps.repos.logs.findById(dto.logId);
        this.deps.events.emit('comment.created', { comment: dto, logTitle: log?.title ?? '' });
      }
    }
    return dto;
  }

  private async visibleLog(logId: string, viewer: AuthUser | null) {
    const log = await this.deps.repos.logs.findById(logId);
    if (!log || (!isPublicStatus(log.status) && viewer?.role !== 'admin'))
      throw Errors.notFound('Log');
    return log;
  }
}
