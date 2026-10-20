import { idParams, loginInput, signupInput } from '@livelog/shared';
import { Router, type Response } from 'express';
import { AppError } from '../../lib/errors';
import { clientMeta, route } from '../../lib/http';
import type { Container } from '../../container';
import { clearSessionCookies, REFRESH_COOKIE, setSessionCookies } from './cookies';
import type { IssuedSession } from './auth.service';

const TERMINAL_REFRESH_CODES = new Set(['NO_SESSION', 'SESSION_EXPIRED']);

export function createAuthRouter({ services, limiters, config }: Container): Router {
  const router = Router();
  const secure = config.auth.cookieSecure;

  const respond = (res: Response, issued: IssuedSession) => {
    setSessionCookies(res, issued.refreshToken, issued.refreshExpiresAt, secure);
    return issued.session;
  };

  router.post(
    '/signup',
    limiters.auth,
    route({ body: signupInput }, async ({ body, req, res }) => ({
      status: 201,
      data: respond(res, await services.auth.signup(body, clientMeta(req))),
    })),
  );

  router.post(
    '/login',
    limiters.auth,
    route({ body: loginInput }, async ({ body, req, res }) => ({
      data: respond(res, await services.auth.login(body, clientMeta(req))),
    })),
  );

  router.post(
    '/refresh',
    limiters.refresh,
    route({}, async ({ req, res }) => {
      try {
        const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
        return { data: respond(res, await services.auth.refresh(token, clientMeta(req))) };
      } catch (error) {
        if (error instanceof AppError && TERMINAL_REFRESH_CODES.has(error.code)) {
          clearSessionCookies(res, secure);
        }
        throw error;
      }
    }),
  );

  router.post(
    '/logout',
    route({}, async ({ req, res }) => {
      await services.auth.logout(req.cookies?.[REFRESH_COOKIE] as string | undefined);
      clearSessionCookies(res, secure);
    }),
  );

  router.get(
    '/me',
    route({ auth: 'user' }, async ({ auth }) => ({ data: await services.auth.me(auth.id) })),
  );

  router.get(
    '/sessions',
    route({ auth: 'user' }, async ({ auth }) => ({ data: await services.auth.listSessions(auth) })),
  );

  router.delete(
    '/sessions/:id',
    route({ auth: 'user', params: idParams }, async ({ auth, params }) => {
      await services.auth.revokeSession(auth, params.id);
    }),
  );

  return router;
}
