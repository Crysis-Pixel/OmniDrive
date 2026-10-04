import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { db, checkDatabaseConnection } from './db';
import { authRoutes } from './routes/auth.routes';
import { accountsRoutes } from './routes/accounts.routes';
import { nodesRoutes } from './routes/nodes.routes';
import { uploadsRoutes } from './routes/uploads.routes';
import { transfersRoutes } from './routes/transfers.routes';
import { storageRoutes } from './routes/storage.routes';
import { searchRoutes } from './routes/search.routes';
import { eventsRoutes } from './routes/events.routes';
import { syncService } from './services/sync.service';
import { authService } from './services/auth.service';

// Ensure BigInt serializes cleanly to string in JSON responses
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

export async function createServer(): Promise<FastifyInstance> {
  const app = fastify({
    logger: true,
    bodyLimit: 50 * 1024 * 1024, // 50MB body limit
  });

  // Check database connection
  await checkDatabaseConnection();

  // Pre-seed demo user if needed
  await authService.ensureDefaultDemoUser();

  // Add raw body parser for binary file uploads and PUT content
  app.addContentTypeParser('*', { parseAs: 'buffer' }, (req, body, done) => {
    done(null, body);
  });

  // Also support JSON
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    try {
      const json = body ? JSON.parse(body.toString()) : {};
      done(null, json);
    } catch (err: any) {
      done(err, undefined);
    }
  });

  // CORS configuration
  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow localhost, configured APP_URL, or same-origin
      if (!origin || origin.startsWith('http://localhost') || origin === config.APP_URL) {
        cb(null, true);
        return;
      }
      cb(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Content-Range', 'Range', 'If-Match'],
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Disposition', 'ETag'],
  });

  // Cookies
  await app.register(cookie, {
    secret: config.SESSION_SECRET,
    hook: 'onRequest',
  });

  // Health check endpoints
  const healthHandler = async () => ({
    status: 'healthy',
    app: 'OmniDrive',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    database: db.isPostgres ? 'postgresql' : 'in-memory-fallback',
    demoMode: config.ENABLE_DEMO_ACCOUNTS,
  });

  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  // Register API routes
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(accountsRoutes, { prefix: '/api/accounts' });
  await app.register(nodesRoutes, { prefix: '/api/nodes' });
  await app.register(uploadsRoutes, { prefix: '/api/uploads' });
  await app.register(transfersRoutes, { prefix: '/api/transfers' });
  await app.register(storageRoutes, { prefix: '/api/storage' });
  await app.register(searchRoutes, { prefix: '/api/search' });
  await app.register(eventsRoutes, { prefix: '/api/events' });

  // Error Handler
  app.setErrorHandler((error: any, request, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode || 500;
    reply.status(statusCode).send({
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'An unexpected error occurred',
        ...(config.NODE_ENV === 'development' ? { stack: error.stack } : {}),
      },
    });
  });

  // Static Frontend Serving for Render / Combined Production
  if (config.SERVE_STATIC) {
    const staticCandidates = [
      path.resolve(__dirname, '../../web/dist'),
      path.resolve(__dirname, '../../../apps/web/dist'),
      path.resolve(process.cwd(), 'apps/web/dist'),
    ];

    const staticPath = staticCandidates.find((p) => fs.existsSync(p));

    if (staticPath) {
      app.log.info(`Serving static frontend assets from: ${staticPath}`);
      await app.register(fastifyStatic, {
        root: staticPath,
        prefix: '/',
        wildcard: false,
      });

      // SPA fallback to index.html for non-API routes
      app.setNotFoundHandler(async (request, reply) => {
        if (request.url.startsWith('/api')) {
          reply.status(404).send({
            error: { code: 'NOT_FOUND', message: 'API endpoint not found' },
          });
        } else {
          return reply.sendFile('index.html');
        }
      });
    }
  }

  // Periodic Account Sync Timer (every SYNC_INTERVAL_SECONDS)
  setInterval(async () => {
    try {
      const activeAccounts = await db.linkedAccount.findMany({
        where: { status: 'active' },
      });
      for (const acc of activeAccounts) {
        syncService.syncAccount(acc.id).catch(() => {});
      }
    } catch {
      // Ignore background sync errors
    }
  }, config.SYNC_INTERVAL_SECONDS * 1000);

  return app;
}
