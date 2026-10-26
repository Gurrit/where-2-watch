import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { config } from './config.js';

export function buildApp() {
  const app = Fastify({ logger: { level: 'info', redact: ['req.headers.authorization'] } });

  app.get('/api/health', async () => ({ ok: true }));

  if (config.staticDir) {
    app.register(fastifyStatic, { root: config.staticDir });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith('/api/') ? reply.code(404).send({ error: 'Not found' }) : reply.sendFile('index.html'),
    );
  }

  return app;
}
