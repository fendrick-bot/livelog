import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { Errors } from '../lib/errors';

const passthrough: RequestHandler = (_req, _res, next) => next();

function limiter(enabled: boolean, windowMs: number, limit: number): RequestHandler {
  if (!enabled) return passthrough;
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(Errors.tooManyRequests()),
  });
}

const MINUTE = 60_000;

export function createRateLimiters(enabled: boolean) {
  return {
    /** Signup / login: brute-force protection. */
    auth: limiter(enabled, 15 * MINUTE, 30),
    /** Token refresh: generous, it happens in the background. */
    refresh: limiter(enabled, 5 * MINUTE, 60),
    /** Comments and reactions. */
    write: limiter(enabled, MINUTE, 60),
    /** Newsletter sign-ups (each one sends an email). */
    subscribe: limiter(enabled, 60 * MINUTE, 10),
    /** Story submissions. */
    story: limiter(enabled, 60 * MINUTE, 5),
  };
}

export type RateLimiters = ReturnType<typeof createRateLimiters>;
