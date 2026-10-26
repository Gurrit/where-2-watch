import { describe, expect, it, vi } from 'vitest';
import { createTmdbClient, TmdbError } from '../src/tmdb/client.js';

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });

describe('createTmdbClient', () => {
  it('sends bearer auth and query params', async () => {
    const fetch = vi.fn(async () => json({ page: 1, results: [], total_results: 0 }));
    await createTmdbClient({ apiKey: 'k', fetch }).searchMovies('Heat');
    const [url, init] = fetch.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.pathname).toBe('/3/search/movie');
    expect(url.searchParams.get('query')).toBe('Heat');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer k');
  });

  it('retries 429 and 5xx then succeeds', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({}, 429, { 'retry-after': '0' }))
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(json({ id: 1, results: {} }));
    const out = await createTmdbClient({ apiKey: 'k', fetch, backoffMs: 1 }).getWatchProviders(1);
    expect(out.id).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('does not retry 4xx', async () => {
    const fetch = vi.fn(async () => json({}, 404));
    await expect(createTmdbClient({ apiKey: 'k', fetch, backoffMs: 1 }).getWatchProviders(1)).rejects.toBeInstanceOf(TmdbError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('gives up after maxRetries', async () => {
    const fetch = vi.fn(async () => json({}, 500));
    await expect(createTmdbClient({ apiKey: 'k', fetch, backoffMs: 1, maxRetries: 2 }).getWatchProviders(1)).rejects.toThrow(/500/);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
