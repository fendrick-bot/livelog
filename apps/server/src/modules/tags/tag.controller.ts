import { idParams, tagInput } from '@livelog/shared';
import { Router } from 'express';
import type { Container } from '../../container';
import { route } from '../../lib/http';

export function createTagsRouter({ services }: Container): Router {
  const router = Router();
  router.get(
    '/',
    route({}, async () => ({ data: await services.tags.list(false) })),
  );
  return router;
}

export function createAdminTagsRouter({ services }: Container): Router {
  const router = Router();

  router.get(
    '/',
    route({ auth: 'admin' }, async () => ({ data: await services.tags.list(true) })),
  );

  router.post(
    '/',
    route({ auth: 'admin', body: tagInput }, async ({ body }) => ({
      status: 201,
      data: await services.tags.create(body),
    })),
  );

  router.patch(
    '/:id',
    route({ auth: 'admin', params: idParams, body: tagInput }, async ({ params, body }) => ({
      data: await services.tags.update(params.id, body),
    })),
  );

  router.delete(
    '/:id',
    route({ auth: 'admin', params: idParams }, async ({ params }) => {
      await services.tags.remove(params.id);
    }),
  );

  return router;
}
