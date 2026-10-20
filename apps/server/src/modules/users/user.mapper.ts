import type { PublicUserDto, UserDto } from '@livelog/shared';
import type { UserRow } from '../../db/schema';
import { iso } from '../../lib/dates';

export type PublicUserFields = Pick<UserRow, 'id' | 'displayName' | 'avatarUrl' | 'role'>;

export const publicUserColumns = {
  id: true,
  displayName: true,
  avatarUrl: true,
  role: true,
} as const;

export function toUserDto(row: UserRow): UserDto {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
    avatarUrl: row.avatarUrl,
    createdAt: iso(row.createdAt),
  };
}

/** `byline` (e.g. "Anonymous") hides the real author entirely. */
export function toPublicUser(user: PublicUserFields | null, byline?: string | null): PublicUserDto {
  if (byline) return { id: null, displayName: byline, avatarUrl: null, isAdmin: false };
  if (!user) return { id: null, displayName: 'A former reader', avatarUrl: null, isAdmin: false };
  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isAdmin: user.role === 'admin',
  };
}
