import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { TmdbClient } from '../src/tmdb/client.js';

const client: TmdbClient = {
  searchMovies: async (title) => ({
    page: 1,
    total_results: title === 'Ghost' ? 0 : 1,
    results: title === 'Ghost' ? [] : [{ id: 7, title, original_title: title, release_date: '1995-12-15', popularity: 1 }],
  }),
  getMovie: async (id) => ({
    id,
    title: 'Heat',
    release_date: '1995-12-15',
    'watch/providers': { results: { SE: { flatrate: [{ provider_id: 8, provider_name: 'Netflix' }] } } },
  }),
  listMovieProviders: async () => ({ results: [] }),
};
const app = buildApp({ client });
const post = (body: string, query = 'country=SE') =>
  app.inject({ method: 'POST', url: `/api/watchlist?${query}`, headers: { 'content-type': 'text/csv' }, payload: body });

const csv = 'Date,Name,Year,Letterboxd URI\n2024-01-01,Heat,1995,u\n2024-01-02,Ghost,2000,u\n';

describe('POST /api/watchlist', () => {
  it('streams start, one line per film, then done', async () => {
    const res = await post(csv);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/x-ndjson');
    const events = res.body.trim().split('\n').map((l) => JSON.parse(l));
    expect(events[0]).toEqual({ type: 'start', total: 2 });
    expect(events.at(-1)).toEqual({ type: 'done' });
    const films = events.filter((e) => e.type === 'film').sort((a, b) => a.index - b.index);
    expect(films[0]).toMatchObject({ status: 'matched', availability: { flatrate: [{ name: 'Netflix' }] } });
    expect(films[1]).toMatchObject({ status: 'unmatched' });
  });

  it('rejects bad input before streaming', async () => {
    expect((await post(csv, 'country=XYZ')).statusCode).toBe(400);
    expect((await post(csv, 'country=SE&source=nope')).statusCode).toBe(400);
    expect((await post('a,b\n1,2\n')).statusCode).toBe(400);
    expect((await post('Date,Name,Year,Letterboxd URI\n')).statusCode).toBe(400);
  });

  it('rejects uploads over the size cap', async () => {
    expect((await post('x'.repeat(1024 * 1024 + 1))).statusCode).toBe(413);
  });
});

describe('limits', () => {
  const csvBody = 'Date,Name,Year,Letterboxd URI\n2024-01-01,Heat,1995,u\n';
  const send = (a: ReturnType<typeof buildApp>) =>
    a.inject({ method: 'POST', url: '/api/watchlist?country=SE', headers: { 'content-type': 'text/csv' }, payload: csvBody });

  it('rate limits uploads per IP', async () => {
    const limited = buildApp({ client, limits: { uploadsPer10Min: 2 } });
    expect((await send(limited)).statusCode).toBe(200);
    expect((await send(limited)).statusCode).toBe(200);
    expect((await send(limited)).statusCode).toBe(429);
  });

  it('rate limits the API per IP', async () => {
    const limited = buildApp({ client, limits: { perMinute: 2 } });
    const codes = [];
    for (let i = 0; i < 3; i++) codes.push((await limited.inject('/api/health')).statusCode);
    expect(codes).toEqual([200, 200, 429]);
  });

  it('refuses new jobs when too many are running', async () => {
    const limited = buildApp({ client, limits: { maxConcurrentJobs: 0 } });
    const res = await send(limited);
    expect(res.statusCode).toBe(503);
    expect(res.headers['retry-after']).toBe('10');
  });

  it('frees the job slot when a job finishes', async () => {
    const limited = buildApp({ client, limits: { maxConcurrentJobs: 1 } });
    expect((await send(limited)).statusCode).toBe(200);
    expect((await send(limited)).statusCode).toBe(200);
  });
});
