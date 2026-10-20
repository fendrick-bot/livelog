import { reactionParams } from '@livelog/shared';
import { Router } from 'express';
import type { Container } from '../../container';
import { route } from '../../lib/http';

/** Mounted at /api/logs/:logId/reactions — PUT adds, DELETE removes (both idempotent). */
export function createReactionsRouter({ services, limiters }: Container): Router {
  const router = Router({ mergeParams: true });

  router.put(
    '/:type',
    limiters.write,
    route({ auth: 'user', params: reactionParams }, async ({ params, auth }) => ({
      data: await services.reactions.set(params.logId, auth, params.type, true),
    })),
  );

  router.delete(
    '/:type',
    limiters.write,
    route({ auth: 'user', params: reactionParams }, async ({ params, auth }) => ({
      data: await services.reactions.set(params.logId, auth, params.type, false),
    })),
  );

  return router;
}
