import type { TmdbClient } from './tmdb/client.js';

export type Limiter = <T>(task: () => Promise<T>) => Promise<T>;

/** Caps the number of tasks in flight; the rest wait FIFO. */
export function createLimiter(concurrency: number): Limiter {
  let active = 0;
  const waiting: (() => void)[] = [];
  const release = () => {
    active--;
    waiting.shift()?.();
  };
  return async (task) => {
    if (active >= concurrency) await new Promise<void>((resolve) => waiting.push(resolve));
    active++;
    try {
      return await task();
    } finally {
      release();
    }
  };
}

/** Wraps a client so every TMDB call goes through one shared limiter (global request cap). */
export function limitClient(client: TmdbClient, limit: Limiter): TmdbClient {
  return {
    searchMovies: (t) => limit(() => client.searchMovies(t)),
    getMovie: (id) => limit(() => client.getMovie(id)),
    listMovieProviders: (c) => limit(() => client.listMovieProviders(c)),
  };
}
