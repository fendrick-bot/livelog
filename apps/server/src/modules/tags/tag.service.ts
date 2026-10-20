import { slugify, type TagDto, type TagInput } from '@livelog/shared';
import { Errors, PG_UNIQUE_VIOLATION, pgErrorCode } from '../../lib/errors';
import type { Repositories } from '../repositories';
import { toTagDto } from './tag.mapper';

export class TagService {
  constructor(private readonly deps: { repos: Repositories }) {}

  async list(includePrivate = false): Promise<TagDto[]> {
    const rows = await this.deps.repos.tags.listWithCounts(includePrivate);
    return rows.map((row) => toTagDto(row, row.logCount));
  }

  async create(input: TagInput): Promise<TagDto> {
    const slug = this.slugFor(input.name);
    try {
      return toTagDto(await this.deps.repos.tags.create({ name: input.name, slug }));
    } catch (error) {
      throw this.translate(error);
    }
  }

  async update(id: string, input: TagInput): Promise<TagDto> {
    try {
      const row = await this.deps.repos.tags.update(id, {
        name: input.name,
        slug: this.slugFor(input.name),
      });
      if (!row) throw Errors.notFound('Tag');
      return toTagDto(row);
    } catch (error) {
      throw this.translate(error);
    }
  }

  async remove(id: string): Promise<void> {
    if (!(await this.deps.repos.tags.delete(id))) throw Errors.notFound('Tag');
  }

  private slugFor(name: string): string {
    const slug = slugify(name, 60);
    if (!slug)
      throw Errors.validation({ fieldErrors: { name: ['Use at least one letter or number'] } });
    return slug;
  }

  private translate(error: unknown): unknown {
    if (pgErrorCode(error) === PG_UNIQUE_VIOLATION) {
      return Errors.conflict('A tag with that name already exists', 'TAG_EXISTS');
    }
    return error;
  }
}
