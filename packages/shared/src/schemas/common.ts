import { z } from 'zod';
import { LIMITS } from '../constants';

export const idParams = z.object({ id: z.uuid() });
export type IdParams = z.infer<typeof idParams>;

export const slugParams = z.object({ slug: z.string().trim().min(1).max(200) });

export const logIdParams = z.object({ logId: z.uuid() });

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(LIMITS.pageSize.max)
    .default(LIMITS.pageSize.default),
});
export type PaginationQuery = z.infer<typeof paginationQuery>;

export const searchTerm = z.string().trim().max(100);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(LIMITS.email.max)
  .pipe(z.email({ error: 'Enter a valid email address' }));

export const tokenInput = z.object({ token: z.string().trim().min(16).max(256) });
export type TokenInput = z.infer<typeof tokenInput>;
