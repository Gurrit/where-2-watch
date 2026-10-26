import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { TmdbClient } from '../src/tmdb/client.js';

const client: TmdbClient = {
  searchMovies: async () => ({
    page: 1,
    total_results: 2,
    results: [
      { id: 1, title: 'Heat', original_title: 'Heat', release_date: '1986-01-01', popularity: 9 },
      { id: 2, title: 'Heat', original_title: 'Heat', release_date: '1995-12-15', popularity: 5 },
    ],
  }),
  getMovie: async (id) => {
    if (id === 404) throw new Error('TMDB 404');
    return { id, title: 'Heat', release_date: '1995-12-15', runtime: 170, 'watch/providers': { results: { SE: { flatrate: [{ provider_id: 8, provider_name: 'Netflix' }] } } } };
  },
  listMovieProviders: async () => ({
    results: [
      { provider_id: 2, provider_name: 'Apple TV', display_priority: 5 },
      { provider_id: 8, provider_name: 'Netflix', display_priority: 1, logo_path: '/n.jpg' },
    ],
  }),
};
const app = buildApp({ client });

describe('GET /api/providers', () => {
  it('lists providers in priority order', async () => {
    const res = await app.inject('/api/providers?country=se');
    expect(res.json().providers.map((p: { name: string }) => p.name)).toEqual(['Netflix', 'Apple TV']);
  });
  it('rejects a bad country', async () => {
    expect((await app.inject('/api/providers?country=Sweden')).statusCode).toBe(400);
  });
});

describe('GET /api/availability', () => {
  it('returns availability and per-id errors', async () => {
    const res = await app.inject('/api/availability?ids=949,404&country=SE');
    const { films } = res.json();
    expect(films[0]).toMatchObject({ id: 949, movie: { runtime: 170 }, availability: { flatrate: [{ name: 'Netflix' }] } });
    expect(films[1]).toEqual({ id: 404, error: 'TMDB 404' });
  });
  it('validates ids', async () => {
    expect((await app.inject('/api/availability?ids=abc&country=SE')).statusCode).toBe(400);
    expect((await app.inject('/api/availability?country=SE')).statusCode).toBe(400);
  });
});

describe('GET /api/search', () => {
  it('ranks by closeness to the requested year', async () => {
    const res = await app.inject('/api/search?q=Heat&year=1995');
    expect(res.json().candidates.map((c: { id: number }) => c.id)).toEqual([2, 1]);
  });
  it('requires q', async () => {
    expect((await app.inject('/api/search')).statusCode).toBe(400);
  });
});
