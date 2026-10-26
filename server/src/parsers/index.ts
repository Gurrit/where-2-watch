import { letterboxdParser } from './letterboxd.js';
import type { WatchlistParser } from './types.js';

/** Registry keyed by the `source` query parameter. Add e.g. `imdb` here later. */
export const parsers: Record<string, WatchlistParser | undefined> = {
  letterboxd: letterboxdParser,
};
