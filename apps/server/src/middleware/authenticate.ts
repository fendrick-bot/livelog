import type { RequestHandler } from 'express';
import { Errors } from '../lib/errors';
import type { AccessTokens } from '../lib/tokens';

/**
 * Resolves `req.auth` from a Bearer token. Anonymous requests pass through
 * with `req.auth = null`; a present-but-invalid token is a 401 so the client
 * knows to refresh its session and retry.
 */
export function authenticate(tokens: AccessTokens): RequestHandler {
  return async (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      req.auth = null;
      next();
      return;
    }
    req.auth = await tokens.verify(header.slice('Bearer '.length).trim());
    next();
  };
}

/** Router-level guard (defence in depth on top of `route({ auth: 'admin' })`). */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.auth) return next(Errors.unauthenticated());
  if (req.auth.role !== 'admin') return next(Errors.forbidden('Admins only'));
  next();
};
