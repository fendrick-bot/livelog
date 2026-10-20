import type { StoryRequestDto } from '@livelog/shared';
import { iso, isoOrNull } from '../../lib/dates';
import type { StoryRecord } from './story.repository';

export function toStoryDto(row: StoryRecord): StoryRequestDto {
  return {
    id: row.id,
    title: row.title,
    pitch: row.pitch,
    content: row.content,
    mood: row.mood,
    isAnonymous: row.isAnonymous,
    status: row.status,
    adminNote: row.adminNote,
    submitter: row.submitter
      ? { id: row.submitter.id, displayName: row.submitter.displayName, email: row.submitter.email }
      : { id: null, displayName: 'A former reader', email: null },
    contactEmail: row.contactEmail,
    publishedLog: row.publishedLog
      ? { id: row.publishedLog.id, slug: row.publishedLog.slug }
      : null,
    reviewedAt: isoOrNull(row.reviewedAt),
    createdAt: iso(row.createdAt),
  };
}
