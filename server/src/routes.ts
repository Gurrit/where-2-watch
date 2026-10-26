import type { FastifyInstance } from 'fastify';
import { loadMovie } from './pipeline.js';
import type { TmdbClient } from './tmdb/client.js';

const MAX_IDS = 200;
const COUNTRY = /^[A-Za-z]{2}$/;

export function parseCountry(value: unknown): string | undefined {
  return typeof value === 'string' && COUNTRY.test(value) ? value.toUpperCase() : undefined;
}

export function registerRoutes(app: FastifyInstance, client: TmdbClient) {
  app.get<{ Querystring: { country?: string } }>('/api/providers', async (req, reply) => {
    const country = parseCountry(req.query.country);
    if (!country) return reply.code(400).send({ error: 'country must be a two-letter code' });
    const { results } = await client.listMovieProviders(country);
    return {
      providers: results
        .slice()
        .sort((a, b) => (a.display_priority ?? 999) - (b.display_priority ?? 999))
        .map((p) => ({ id: p.provider_id, name: p.provider_name, logoPath: p.logo_path ?? undefined })),
    };
  });

  app.get<{ Querystring: { ids?: string; country?: string } }>('/api/availability', async (req, reply) => {
    const country = parseCountry(req.query.country);
    if (!country) return reply.code(400).send({ error: 'country must be a two-letter code' });
    const ids = [...new Set((req.query.ids ?? '').split(',').filter(Boolean).map(Number))];
    if (ids.length === 0 || ids.length > MAX_IDS || ids.some((n) => !Number.isInteger(n) || n <= 0)) {
      return reply.code(400).send({ error: `ids must be 1-${MAX_IDS} positive integers, comma separated` });
    }
    const films = await Promise.all(
      ids.map(async (id) => {
        try {
          return { id, ...(await loadMovie(client, id, country)) };
        } catch (err) {
          return { id, error: (err as Error).message };
        }
      }),
    );
    return { films };
  });

  app.get<{ Querystring: { q?: string; year?: string } }>('/api/search', async (req, reply) => {
    const q = req.query.q?.trim();
    if (!q || q.length > 200) return reply.code(400).send({ error: 'q is required (max 200 characters)' });
    const year = req.query.year ? Number.parseInt(req.query.year, 10) : undefined;
    const { results } = await client.searchMovies(q);
    const candidates = results
      .map((r) => {
        const y = Number.parseInt(r.release_date?.slice(0, 4) ?? '', 10);
        return { id: r.id, title: r.title, ...(Number.isFinite(y) ? { year: y } : {}), popularity: r.popularity };
      })
      .sort((a, b) => {
        // Closer to the requested year first, then by popularity.
        const dist = (c: { year?: number }) => (year && c.year ? Math.abs(c.year - year) : 0);
        return dist(a) - dist(b) || b.popularity - a.popularity;
      })
      .slice(0, 10);
    return { candidates };
  });
}
