import { Router } from 'express';
import type { Container } from '../container';
import { route } from '../lib/http';
import { createAdminRouter } from './admin/admin.controller';
import { createAuthRouter } from './auth/auth.controller';
import { createCommentsRouter, createLogCommentsRouter } from './comments/comment.controller';
import { createLiveRouter, createLogsRouter } from './logs/log.controller';
import { createReactionsRouter } from './reactions/reaction.controller';
import { createStoriesRouter } from './stories/story.controller';
import { createSubscribersRouter } from './subscribers/subscriber.controller';
import { createTagsRouter } from './tags/tag.controller';

export function createApiRouter(container: Container): Router {
  const api = Router();

  api.get(
    '/health',
    route({}, async () => ({
      data: {
        status: 'ok',
        database: await container.database.ping(),
        time: new Date().toISOString(),
      },
    })),
  );

  api.use('/auth', createAuthRouter(container));
  api.use('/live', createLiveRouter(container));
  api.use('/logs/:logId/comments', createLogCommentsRouter(container));
  api.use('/logs/:logId/reactions', createReactionsRouter(container));
  api.use('/logs', createLogsRouter(container));
  api.use('/tags', createTagsRouter(container));
  api.use('/comments', createCommentsRouter(container));
  api.use('/stories', createStoriesRouter(container));
  api.use('/subscribers', createSubscribersRouter(container));
  api.use('/admin', createAdminRouter(container));

  return api;
}
