import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createCache } from '../src/cache/cache.js';
import { withCache } from '../src/cache/cachedClient.js';
import type { TmdbClient } from '../src/tmdb/client.js';

describe('createCache', () => {
  it('expires entries', () => {
    let t = 0;
    const c = createCache({ now: () => t });
    c.set('a', { x: 1 }, 100);
    expect(c.get('a')).toEqual({ x: 1 });
    t = 100;
    expect(c.get('a')).toBeUndefined();
  });

  it('evicts the least recently used memory entry', () => {
    const c = createCache({ maxMemoryEntries: 2 });
    c.set('a', 1, 1000);
    c.set('b', 2, 1000);
    c.get('a');
    c.set('c', 3, 1000);
    expect(c.get('b')).toBeUndefined();
    expect(c.get('a')).toBe(1);
  });

  it('persists to SQLite across instances and honours expiry', () => {
    const dir = mkdtempSync(join(tmpdir(), 'w2w-cache-'));
    const dbPath = join(dir, 'c.db');
    try {
      let t = 0;
      const first = createCache({ dbPath, now: () => t });
      first.set('k', { v: [1, 2] }, 100);
      first.close();
      const second = createCache({ dbPath, now: () => t });
      expect(second.get('k')).toEqual({ v: [1, 2] });
      t = 200;
      const third = createCache({ dbPath, now: () => t });
      expect(third.get('k')).toBeUndefined();
      second.close();
      third.close();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});

describe('withCache', () => {
  it('calls the underlying client once per key', async () => {
    const inner: TmdbClient = {
      searchMovies: vi.fn(async () => ({ page: 1, results: [], total_results: 0 })),
      getMovie: vi.fn(),
      listMovieProviders: vi.fn(),
    };
    const client = withCache(inner, createCache());
    await client.searchMovies('Heat');
    await client.searchMovies('HEAT');
    expect(inner.searchMovies).toHaveBeenCalledTimes(1);
  });
});
