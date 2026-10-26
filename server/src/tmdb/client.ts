import type {
  TmdbMovieDetails,
  TmdbProviderListResponse,
  TmdbSearchResponse,
} from './types.js';

export class TmdbError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export interface TmdbClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  maxRetries?: number;
  /** Base delay for exponential backoff; overridable so tests don't sleep. */
  backoffMs?: number;
}

export interface TmdbClient {
  searchMovies(title: string): Promise<TmdbSearchResponse>;
  /** Movie details with watch providers appended (one request). */
  getMovie(movieId: number): Promise<TmdbMovieDetails>;
  listMovieProviders(country: string): Promise<TmdbProviderListResponse>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createTmdbClient(opts: TmdbClientOptions): TmdbClient {
  const baseUrl = opts.baseUrl ?? 'https://api.themoviedb.org/3';
  const doFetch = opts.fetch ?? fetch;
  const maxRetries = opts.maxRetries ?? 3;
  const backoffMs = opts.backoffMs ?? 500;

  async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(baseUrl + path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const headers = { Authorization: `Bearer ${opts.apiKey}`, Accept: 'application/json' };

    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await doFetch(url, { headers });
      } catch (err) {
        if (attempt >= maxRetries) throw new TmdbError(`Network error: ${(err as Error).message}`);
        await sleep(backoffMs * 2 ** attempt);
        continue;
      }
      if (res.ok) return (await res.json()) as T;

      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= maxRetries) {
        throw new TmdbError(`TMDB ${res.status} for ${path}`, res.status);
      }
      const retryAfter = Number(res.headers.get('retry-after'));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoffMs * 2 ** attempt);
    }
  }

  return {
    searchMovies: (title) =>
      get('/search/movie', { query: title, include_adult: 'false', language: 'en-US' }),
    getMovie: (id) => get(`/movie/${id}`, { append_to_response: 'watch/providers', language: 'en-US' }),
    listMovieProviders: (country) => get('/watch/providers/movie', { watch_region: country }),
  };
}
