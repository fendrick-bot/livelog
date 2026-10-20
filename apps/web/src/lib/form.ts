import type { ZodType } from 'zod';
import { z } from 'zod';
import { ApiError } from './api';

export type FieldErrors = Record<string, string | undefined>;

/** First message per field from a zod error tree. */
function firstMessages(fieldErrors: Record<string, string[] | undefined>): FieldErrors {
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([key, messages]) => [key, messages?.[0]]),
  );
}

/** Client-side validation with the same zod schema the server uses. */
export function validate<T extends ZodType>(
  schema: T,
  values: unknown,
): { ok: true; data: z.output<T> } | { ok: false; errors: FieldErrors } {
  const result = schema.safeParse(values);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    errors: firstMessages(z.flattenError(result.error).fieldErrors as Record<string, string[]>),
  };
}

/** Field errors carried by an API validation error. */
export function apiFieldErrors(error: unknown): FieldErrors {
  if (
    error instanceof ApiError &&
    error.code === 'VALIDATION_FAILED' &&
    error.details?.fieldErrors
  ) {
    return firstMessages(error.details.fieldErrors);
  }
  return {};
}
