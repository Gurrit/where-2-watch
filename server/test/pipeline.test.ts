import { describe, expect, it, vi } from 'vitest';
import { createLimiter, limitClient } from '../src/limiter.js';
import { resolveWatchlist, type FilmResult } from '../src/pipeline.js';
import type { TmdbClient } from '../src/tmdb/client.js';

const collect = async (gen: AsyncGenerator<FilmResult>) => {
  const out: FilmResult[] = [];
  for await (const r of gen) out.push(r);
  return out;
};

function fakeClient(overrides: Partial<TmdbClient> = {}): TmdbClient {
  return {
    searchMovies: async (title) => ({
      page: 1,
      total_results: 1,
      results:
        title === 'Nothing'
          ? []
          : [{ id: title.length, title, original_title: title, release_date: '2000-05-05', popularity: 1 }],
    }),
    getMovie: async (id) => ({
      id,
      title: 'T' + id,
      release_date: '2000-05-05',
      runtime: 100,
      vote_average: 7.5,
      'watch/providers': { results: { SE: { flatrate: [{ provider_id: 8, provider_name: 'Netflix' }] } } },
    }),
    listMovieProviders: async () => ({ results: [] }),
    ...overrides,
  };
}

describe('resolveWatchlist', () => {
  it('resolves every entry with metadata and availability', async () => {
    const entries = [{ title: 'Heat', year: 2000 }, { title: 'Nothing', year: 2000 }, { title: 'Alien', year: 2000 }];
    const out = (await collect(resolveWatchlist(entries, 'SE', fakeClient()))).sort((a, b) => a.index - b.index);
    expect(out.map((r) => r.status)).toEqual(['matched', 'unmatched', 'matched']);
    expect(out[0]).toMatchObject({ movie: { runtime: 100, rating: 7.5, year: 2000 }, availability: { flatrate: [{ name: 'Netflix' }] } });
  });

  it('reports per-film failures without failing the run', async () => {
    const client = fakeClient({ getMovie: vi.fn().mockRejectedValueOnce(new Error('boom')).mockImplementation(async (id: number) => ({ id, title: 'x' })) });
    const out = await collect(resolveWatchlist([{ title: 'A', year: 2000 }, { title: 'BB', year: 2000 }], 'SE', client, { concurrency: 1 }));
    expect(out.map((r) => r.status).sort()).toEqual(['error', 'matched']);
  });

  it('respects the concurrency bound', async () => {
    let active = 0;
    let peak = 0;
    const client = fakeClient({
      searchMovies: async (title) => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
        return { page: 1, total_results: 0, results: [] };
      },
    });
    const entries = Array.from({ length: 20 }, (_, i) => ({ title: `F${i}` }));
    expect(await collect(resolveWatchlist(entries, 'SE', client, { concurrency: 3 }))).toHaveLength(20);
    expect(peak).toBe(3);
  });

  it('stops launching work when aborted', async () => {
    const ctl = new AbortController();
    const entries = Array.from({ length: 50 }, (_, i) => ({ title: `F${i}` }));
    const out: FilmResult[] = [];
    for await (const r of resolveWatchlist(entries, 'SE', fakeClient(), { concurrency: 2, signal: ctl.signal })) {
      out.push(r);
      if (out.length === 3) ctl.abort();
    }
    expect(out.length).toBeLessThan(10);
  });
});

describe('limiter', () => {
  it('caps shared client calls globally', async () => {
    let active = 0;
    let peak = 0;
    const slow = fakeClient({
      searchMovies: async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
        return { page: 1, total_results: 0, results: [] };
      },
    });
    const client = limitClient(slow, createLimiter(2));
    await Promise.all(Array.from({ length: 10 }, (_, i) => client.searchMovies(String(i))));
    expect(peak).toBe(2);
  });
});
