import type { SubscriberDto } from '@livelog/shared';
import type { SubscriberRow } from '../../db/schema';
import { iso, isoOrNull } from '../../lib/dates';

export function toSubscriberDto(row: SubscriberRow): SubscriberDto {
  return {
    id: row.id,
    email: row.email,
    status: row.status,
    confirmedAt: isoOrNull(row.confirmedAt),
    createdAt: iso(row.createdAt),
  };
}
