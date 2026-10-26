import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import rateLimit from '@fastify/rate-limit';
import { config } from './config.js';
import { registerRoutes } from './routes.js';
import { registerWatchlistRoute } from './watchlistRoute.js';
import type { TmdbClient } from './tmdb/client.js';

export interface AppOptions {
  client: TmdbClient;
  limits?: { perMinute?: number; uploadsPer10Min?: number; maxConcurrentJobs?: number };
}

export function buildApp({ client, limits = {} }: AppOptions) {
  const app = Fastify({
    logger: { level: 'info', redact: ['req.headers.authorization'] },
    trustProxy: config.trustProxy,
  });

  app.register(rateLimit, { max: limits.perMinute ?? config.rateLimitPerMinute, timeWindow: '1 minute' });

  // Registered after the rate-limit plugin loads, so its onRoute hook sees these routes.
  app.register(async (scope) => {
    scope.get('/api/health', async () => ({ ok: true }));
    registerRoutes(scope, client);
    registerWatchlistRoute(scope, client, {
      uploadsPer10Min: limits.uploadsPer10Min ?? config.uploadsPer10Min,
      maxConcurrentJobs: limits.maxConcurrentJobs ?? config.maxConcurrentJobs,
    });
  });

  if (config.staticDir) {
    app.register(fastifyStatic, { root: config.staticDir });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith('/api/') ? reply.code(404).send({ error: 'Not found' }) : reply.sendFile('index.html'),
    );
  }

  return app;
}
