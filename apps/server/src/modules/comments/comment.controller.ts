import {
  adminListCommentsQuery,
  createCommentInput,
  idParams,
  listCommentsQuery,
  logIdParams,
  moderateCommentInput,
} from '@livelog/shared';
import { Router } from 'express';
import type { Container } from '../../container';
import { route } from '../../lib/http';

/** Mounted at /api/logs/:logId/comments */
export function createLogCommentsRouter({ services, limiters }: Container): Router {
  const router = Router({ mergeParams: true });

  router.get(
    '/',
    route({ params: logIdParams, query: listCommentsQuery }, async ({ params, query, auth }) => ({
      data: await services.comments.list(params.logId, query, auth),
    })),
  );

  router.post(
    '/',
    limiters.write,
    route(
      { auth: 'user', params: logIdParams, body: createCommentInput },
      async ({ params, body, auth }) => ({
        status: 201,
        data: await services.comments.create(params.logId, auth, body),
      }),
    ),
  );

  return router;
}

/** Mounted at /api/comments */
export function createCommentsRouter({ services }: Container): Router {
  const router = Router();
  router.delete(
    '/:id',
    route({ auth: 'user', params: idParams }, async ({ params, auth }) => {
      await services.comments.remove(params.id, auth);
    }),
  );
  return router;
}

/** Mounted at /api/admin/comments */
export function createAdminCommentsRouter({ services }: Container): Router {
  const router = Router();

  router.get(
    '/',
    route({ auth: 'admin', query: adminListCommentsQuery }, async ({ query }) => ({
      data: await services.comments.adminList(query),
    })),
  );

  router.patch(
    '/:id',
    route(
      { auth: 'admin', params: idParams, body: moderateCommentInput },
      async ({ params, body }) => ({
        data: await services.comments.moderate(params.id, body.status),
      }),
    ),
  );

  router.delete(
    '/:id',
    route({ auth: 'admin', params: idParams }, async ({ params, auth }) => {
      await services.comments.remove(params.id, auth);
    }),
  );

  return router;
}
