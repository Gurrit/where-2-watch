import { Readable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import type { WatchlistEntry } from './parsers/types.js';
import { InvalidWatchlistError } from './parsers/letterboxd.js';
import { parsers } from './parsers/index.js';
import { resolveWatchlist } from './pipeline.js';
import { parseCountry } from './routes.js';
import type { TmdbClient } from './tmdb/client.js';

export const MAX_UPLOAD_BYTES = 1024 * 1024;
export const MAX_ENTRIES = 5000;

/**
 * POST /api/watchlist?country=SE[&source=letterboxd]  with the CSV as a text/csv body.
 * Responds with NDJSON: {type:"start",total} then {type:"film",...FilmResult} per film as it resolves,
 * then {type:"done"}. Nothing from the upload is logged or stored.
 */
export function registerWatchlistRoute(app: FastifyInstance, client: TmdbClient) {
  app.addContentTypeParser('text/csv', { parseAs: 'string', bodyLimit: MAX_UPLOAD_BYTES }, (_req, body, done) =>
    done(null, body),
  );

  app.post<{ Querystring: { country?: string; source?: string }; Body: string }>('/api/watchlist', async (req, reply) => {
    const country = parseCountry(req.query.country);
    if (!country) return reply.code(400).send({ error: 'country must be a two-letter code' });
    const parser = parsers[req.query.source ?? 'letterboxd'];
    if (!parser) return reply.code(400).send({ error: 'unknown source' });
    if (typeof req.body !== 'string') return reply.code(415).send({ error: 'send the CSV as text/csv' });

    let entries: WatchlistEntry[];
    try {
      entries = parser.parse(req.body);
    } catch (err) {
      if (err instanceof InvalidWatchlistError) return reply.code(400).send({ error: err.message });
      throw err;
    }
    if (entries.length === 0) return reply.code(400).send({ error: 'The file contains no films' });
    if (entries.length > MAX_ENTRIES) {
      return reply.code(413).send({ error: `At most ${MAX_ENTRIES} films are supported` });
    }

    const abort = new AbortController();
    reply.raw.on('close', () => abort.abort());

    async function* lines() {
      yield JSON.stringify({ type: 'start', total: entries.length }) + '\n';
      for await (const film of resolveWatchlist(entries, country!, client, { signal: abort.signal })) {
        yield JSON.stringify({ type: 'film', ...film }) + '\n';
      }
      yield JSON.stringify({ type: 'done' }) + '\n';
    }

    return reply
      .header('content-type', 'application/x-ndjson; charset=utf-8')
      .header('cache-control', 'no-store')
      .header('x-accel-buffering', 'no')
      .send(Readable.from(lines()));
  });
}
