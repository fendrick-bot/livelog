import {
  adminListLogsQuery,
  createLogInput,
  endLiveInput,
  idParams,
  listLogsQuery,
  scheduleLiveInput,
  slugParams,
  updateLogInput,
} from '@livelog/shared';
import { Router } from 'express';
import type { Container } from '../../container';
import { route } from '../../lib/http';

/** Mounted at /api/logs */
export function createLogsRouter({ services }: Container): Router {
  const router = Router();

  router.get(
    '/',
    route({ query: listLogsQuery }, async ({ query }) => ({
      data: await services.logs.listPublic(query),
    })),
  );

  router.get(
    '/:slug',
    route({ params: slugParams }, async ({ params, auth }) => ({
      data: await services.logs.getPublicBySlug(params.slug, auth),
    })),
  );

  return router;
}

/** Mounted at /api/live */
export function createLiveRouter({ services }: Container): Router {
  const router = Router();
  router.get(
    '/status',
    route({}, async () => ({ data: await services.logs.getLiveStatus() })),
  );
  return router;
}

/** Mounted at /api/admin/logs */
export function createAdminLogsRouter({ services }: Container): Router {
  const router = Router();
  const logs = services.logs;

  router.get(
    '/',
    route({ auth: 'admin', query: adminListLogsQuery }, async ({ query }) => ({
      data: await logs.adminList(query),
    })),
  );

  router.post(
    '/',
    route({ auth: 'admin', body: createLogInput }, async ({ auth, body }) => ({
      status: 201,
      data: await logs.create(auth, body),
    })),
  );

  router.get(
    '/:id',
    route({ auth: 'admin', params: idParams }, async ({ auth, params }) => ({
      data: await logs.adminGet(params.id, auth),
    })),
  );

  router.patch(
    '/:id',
    route(
      { auth: 'admin', params: idParams, body: updateLogInput },
      async ({ auth, params, body }) => ({
        data: await logs.update(params.id, body, auth),
      }),
    ),
  );

  router.delete(
    '/:id',
    route({ auth: 'admin', params: idParams }, async ({ params }) => {
      await logs.remove(params.id);
    }),
  );

  // Status transitions — one endpoint per intent keeps the API self-describing.
  router.post(
    '/:id/publish',
    route({ auth: 'admin', params: idParams }, async ({ auth, params }) => ({
      data: await logs.publish(params.id, auth),
    })),
  );
  router.post(
    '/:id/unpublish',
    route({ auth: 'admin', params: idParams }, async ({ auth, params }) => ({
      data: await logs.unpublish(params.id, auth),
    })),
  );
  router.post(
    '/:id/archive',
    route({ auth: 'admin', params: idParams }, async ({ auth, params }) => ({
      data: await logs.archive(params.id, auth),
    })),
  );
  router.post(
    '/:id/schedule',
    route(
      { auth: 'admin', params: idParams, body: scheduleLiveInput },
      async ({ auth, params, body }) => ({
        data: await logs.schedule(params.id, body, auth),
      }),
    ),
  );
  router.post(
    '/:id/unschedule',
    route({ auth: 'admin', params: idParams }, async ({ auth, params }) => ({
      data: await logs.unschedule(params.id, auth),
    })),
  );
  router.post(
    '/:id/go-live',
    route({ auth: 'admin', params: idParams }, async ({ auth, params }) => ({
      data: await logs.goLive(params.id, auth),
    })),
  );
  router.post(
    '/:id/end-live',
    route(
      { auth: 'admin', params: idParams, body: endLiveInput },
      async ({ auth, params, body }) => ({
        data: await logs.endLive(params.id, body, auth),
      }),
    ),
  );

  return router;
}
