import { paginationQuery } from '@livelog/shared';
import { Router } from 'express';
import type { Container } from '../../container';
import { route } from '../../lib/http';
import { requireAdmin } from '../../middleware/authenticate';
import { createAdminCommentsRouter } from '../comments/comment.controller';
import { createAdminLogsRouter } from '../logs/log.controller';
import { createAdminStoriesRouter } from '../stories/story.controller';
import { createAdminSubscribersRouter } from '../subscribers/subscriber.controller';
import { createAdminTagsRouter } from '../tags/tag.controller';

/** Mounted at /api/admin. Every route below is admin-only. */
export function createAdminRouter(container: Container): Router {
  const router = Router();
  router.use(requireAdmin);

  router.get(
    '/stats',
    route({ auth: 'admin' }, async () => ({ data: await container.services.admin.stats() })),
  );

  router.get(
    '/live-sessions',
    route({ auth: 'admin', query: paginationQuery }, async ({ query }) => ({
      data: await container.services.admin.liveHistory(query),
    })),
  );

  router.use('/logs', createAdminLogsRouter(container));
  router.use('/tags', createAdminTagsRouter(container));
  router.use('/comments', createAdminCommentsRouter(container));
  router.use('/stories', createAdminStoriesRouter(container));
  router.use('/subscribers', createAdminSubscribersRouter(container));
  return router;
}
