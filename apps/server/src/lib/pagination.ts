import type { Paginated, PaginationQuery } from '@livelog/shared';

export function toOffset({ page, pageSize }: PaginationQuery) {
  return { limit: pageSize, offset: (page - 1) * pageSize };
}

export function paginate<T>(
  items: T[],
  total: number,
  { page, pageSize }: PaginationQuery,
): Paginated<T> {
  return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Escape LIKE wildcards in user input. */
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
