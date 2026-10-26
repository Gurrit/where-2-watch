import type { TmdbClient } from '../tmdb/client.js';
import type { Cache } from './cache.js';

const HOUR = 60 * 60 * 1000;
export const TTL = {
  search: 7 * 24 * HOUR,
  providers: 24 * HOUR,
  providerList: 24 * HOUR,
};

export function withCache(client: TmdbClient, cache: Cache): TmdbClient {
  async function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
    const hit = cache.get<T>(key);
    if (hit !== undefined) return hit;
    const value = await load();
    cache.set(key, value, ttl);
    return value;
  }
  return {
    searchMovies: (title) => cached(`search:${title.toLowerCase()}`, TTL.search, () => client.searchMovies(title)),
    getWatchProviders: (id) => cached(`providers:${id}`, TTL.providers, () => client.getWatchProviders(id)),
    listMovieProviders: (country) =>
      cached(`providerlist:${country.toUpperCase()}`, TTL.providerList, () => client.listMovieProviders(country)),
  };
}
