import { buildApp } from './app.js';
import { createCache } from './cache/cache.js';
import { withCache } from './cache/cachedClient.js';
import { config } from './config.js';
import { createLimiter, limitClient } from './limiter.js';
import { createTmdbClient } from './tmdb/client.js';

if (!config.tmdbApiKey) {
  console.error('TMDB_API_KEY is required');
  process.exit(1);
}

const cache = createCache({ dbPath: config.cachePath || undefined });
// Cache sits outside the limiter so cache hits don't consume TMDB request slots.
const client = withCache(
  limitClient(createTmdbClient({ apiKey: config.tmdbApiKey, baseUrl: config.tmdbBaseUrl }), createLimiter(config.tmdbConcurrency)),
  cache,
);

const app = buildApp({ client });
process.on('SIGTERM', () => void app.close().then(() => cache.close()));
await app.listen({ port: config.port, host: config.host });
