import type { TagDto } from '@livelog/shared';
import type { TagRow } from '../../db/schema';

export function toTagDto(row: Pick<TagRow, 'id' | 'name' | 'slug'>, logCount = 0): TagDto {
  return { id: row.id, name: row.name, slug: row.slug, logCount };
}
