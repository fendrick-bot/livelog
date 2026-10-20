import {
  acceptStoryInput,
  idParams,
  listStoriesQuery,
  rejectStoryInput,
  submitStoryInput,
} from '@livelog/shared';
import { Router } from 'express';
import type { Container } from '../../container';
import { route } from '../../lib/http';

/** Mounted at /api/stories */
export function createStoriesRouter({ services, limiters }: Container): Router {
  const router = Router();

  router.post(
    '/',
    limiters.story,
    route({ auth: 'user', body: submitStoryInput }, async ({ auth, body }) => ({
      status: 201,
      data: await services.stories.submit(auth, body),
    })),
  );

  router.get(
    '/mine',
    route({ auth: 'user' }, async ({ auth }) => ({ data: await services.stories.listMine(auth) })),
  );

  return router;
}

/** Mounted at /api/admin/stories */
export function createAdminStoriesRouter({ services }: Container): Router {
  const router = Router();

  router.get(
    '/',
    route({ auth: 'admin', query: listStoriesQuery }, async ({ query }) => ({
      data: await services.stories.adminList(query),
    })),
  );

  router.get(
    '/:id',
    route({ auth: 'admin', params: idParams }, async ({ params }) => ({
      data: await services.stories.get(params.id),
    })),
  );

  router.post(
    '/:id/accept',
    route(
      { auth: 'admin', params: idParams, body: acceptStoryInput },
      async ({ params, auth, body }) => ({
        data: await services.stories.accept(params.id, auth, body),
      }),
    ),
  );

  router.post(
    '/:id/reject',
    route(
      { auth: 'admin', params: idParams, body: rejectStoryInput },
      async ({ params, auth, body }) => ({
        data: await services.stories.reject(params.id, auth, body),
      }),
    ),
  );

  return router;
}
