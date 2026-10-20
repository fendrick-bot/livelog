/**
 * Every expected failure is an AppError with a stable machine-readable code.
 * The error middleware turns it into `{ error: { code, message, details } }`.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  validation: (details: unknown, message = 'Some fields need another look') =>
    new AppError(400, 'VALIDATION_FAILED', message, details),
  badRequest: (message: string, code = 'BAD_REQUEST') => new AppError(400, code, message),
  unauthenticated: (message = 'Please sign in to continue', code = 'UNAUTHENTICATED') =>
    new AppError(401, code, message),
  forbidden: (message = 'You do not have access to this', code = 'FORBIDDEN') =>
    new AppError(403, code, message),
  notFound: (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found`),
  conflict: (message: string, code = 'CONFLICT') => new AppError(409, code, message),
  tooManyRequests: (message = 'Slow down a little and try again shortly') =>
    new AppError(429, 'RATE_LIMITED', message),
};

/** Postgres SQLSTATE of an error thrown by pg/pglite, unwrapping drizzle's wrapper. */
export function pgErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

export const PG_UNIQUE_VIOLATION = '23505';
export const PG_FOREIGN_KEY_VIOLATION = '23503';
