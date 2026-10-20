import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import express, { Router } from 'express';
import type { Container } from './container';

const escapeAttr = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Serves the built SPA (SERVE_WEB=true). Entry pages get Open Graph tags
 * injected so shared links unfurl nicely in chat apps and social networks.
 */
export function createWebHandler(container: Container): Router {
  const router = Router();
  const { distDir } = container.config.web;
  const indexPath = join(distDir, 'index.html');

  if (!existsSync(indexPath)) {
    container.logger.warn({ distDir }, 'SERVE_WEB is on but the web build was not found');
    return router;
  }
  const template = readFileSync(indexPath, 'utf8');

  router.use(
    express.static(distDir, {
      index: false,
      setHeaders(res, path) {
        res.setHeader(
          'Cache-Control',
          path.includes('/assets/')
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=3600',
        );
      },
    }),
  );

  router.get('/{*splat}', async (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    let html = template;
    const match = /^\/logs\/([^/]+)\/?$/.exec(req.path);
    if (match?.[1]) {
      try {
        const meta = await container.services.logs.shareMeta(decodeURIComponent(match[1]));
        if (meta) {
          const title = `${meta.isLive ? '🔴 Live now: ' : ''}${meta.title} · Livelog`;
          const url = `${container.config.publicUrl}${req.path}`;
          const tags = [
            `<title>${escapeAttr(title)}</title>`,
            `<meta name="description" content="${escapeAttr(meta.description)}" />`,
            `<meta property="og:type" content="article" />`,
            `<meta property="og:title" content="${escapeAttr(title)}" />`,
            `<meta property="og:description" content="${escapeAttr(meta.description)}" />`,
            `<meta property="og:url" content="${escapeAttr(url)}" />`,
            `<meta name="twitter:card" content="summary" />`,
            `<meta name="author" content="${escapeAttr(meta.author)}" />`,
          ].join('\n    ');
          html = template.replace(/<!--meta:start-->[\s\S]*?<!--meta:end-->/, tags);
        }
      } catch (error) {
        container.logger.warn({ err: error }, 'failed to build share meta');
      }
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.type('html').send(html);
  });

  return router;
}
