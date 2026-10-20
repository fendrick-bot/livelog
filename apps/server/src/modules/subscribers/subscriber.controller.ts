import { idParams, listSubscribersQuery, subscribeInput, tokenInput } from '@livelog/shared';
import { Router } from 'express';
import type { Container } from '../../container';
import { route } from '../../lib/http';

/** Mounted at /api/subscribers */
export function createSubscribersRouter({ services, limiters }: Container): Router {
  const router = Router();

  router.post(
    '/',
    limiters.subscribe,
    route({ body: subscribeInput }, async ({ body }) => ({
      status: 202,
      data: await services.subscribers.subscribe(body),
    })),
  );

  router.post(
    '/confirm',
    route({ body: tokenInput }, async ({ body }) => ({
      data: await services.subscribers.confirm(body.token),
    })),
  );

  router.post(
    '/unsubscribe',
    route({ body: tokenInput }, async ({ body }) => ({
      data: await services.subscribers.unsubscribe(body.token),
    })),
  );

  return router;
}

/** Mounted at /api/admin/subscribers */
export function createAdminSubscribersRouter({ services }: Container): Router {
  const router = Router();

  router.get(
    '/',
    route({ auth: 'admin', query: listSubscribersQuery }, async ({ query }) => ({
      data: await services.subscribers.adminList(query),
    })),
  );

  router.delete(
    '/:id',
    route({ auth: 'admin', params: idParams }, async ({ params }) => {
      await services.subscribers.adminRemove(params.id);
    }),
  );

  return router;
}
