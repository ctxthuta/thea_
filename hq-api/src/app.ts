import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { pingMongo } from './infrastructure/db/mongo';
import { AppError } from './domain/errors';
import { errorHandler } from './middleware/errorHandler';
import {
  createCorsMiddleware,
  requestContextMiddleware,
  securityHeadersMiddleware,
} from './middleware/security';
import type { AppEnv } from './middleware/context';
import { createAuthRoutes } from './routes/auth';
import { createPublicRoutes } from './routes/public';
import { createOverviewRoutes } from './routes/overview';
import { createAccountingRoutes } from './routes/accounting';
import { createAssociatesRoutes } from './routes/associates';
import { createCmsRoutes } from './routes/cms';
import { createCrmRoutes } from './routes/crm';
import { createAdminRoutes } from './routes/admin';

const startedAtMs = Date.now();

export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use('*', requestContextMiddleware());
  app.use('*', securityHeadersMiddleware());
  app.use('/api/*', createCorsMiddleware());

  app.onError(errorHandler);

  // Health endpoint
  app.get('/api/v1/health', async (c) => {
    const connected = await pingMongo();
    return c.json(
      {
        status: connected ? 'ok' : 'degraded',
        db: connected ? 'connected' : 'disconnected',
        uptimeSeconds: Math.floor((Date.now() - startedAtMs) / 1000),
      },
      connected ? 200 : 503
    );
  });

  // Mount API routes
  app.route('/api/v1/auth', createAuthRoutes());
  app.route('/api/v1/public', createPublicRoutes());
  app.route('/api/v1/overview', createOverviewRoutes());
  app.route('/api/v1/accounting', createAccountingRoutes());
  app.route('/api/v1/associates', createAssociatesRoutes());
  app.route('/api/v1/cms', createCmsRoutes());
  app.route('/api/v1/crm', createCrmRoutes());
  app.route('/api/v1/admin', createAdminRoutes());

  // Unknown /api/* routes return RFC 7807 404
  app.all('/api/*', (c) => {
    throw AppError.notFound(`Endpoint ${c.req.method} ${c.req.path} does not exist.`);
  });

  // Serve compiled ../hq-portal/dist statically with SPA fallback when present
  const portalDistDir = resolve(import.meta.dir, '../..', 'hq-portal', 'dist');
  const portalIndexPath = join(portalDistDir, 'index.html');

  if (existsSync(portalIndexPath)) {
    const serveIndex = async () => {
      const file = Bun.file(portalIndexPath);
      return new Response(await file.text(), {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    };

    app.get('/', serveIndex);
    app.get('/index.html', serveIndex);
    app.use('/*', serveStatic({ root: portalDistDir }));
    app.get('*', serveIndex);
  } else {
    app.get('/', (c) =>
      c.json({
        service: 'thea-hq-api',
        status: 'running',
        docs: '/api/v1/health',
      })
    );
  }

  return app;
}
