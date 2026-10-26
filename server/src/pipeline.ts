import { extractAvailability, type Availability } from './availability.js';
import { matchEntry, type Candidate } from './matching/matcher.js';
import type { WatchlistEntry } from './parsers/types.js';
import type { TmdbClient } from './tmdb/client.js';
import type { TmdbMovieDetails } from './tmdb/types.js';

export interface MovieInfo {
  id: number;
  title: string;
  year?: number;
  runtime?: number;
  rating?: number;
  posterPath?: string;
}

export interface FilmResult {
  index: number;
  entry: WatchlistEntry;
  status: 'matched' | 'ambiguous' | 'unmatched' | 'error';
  movie?: MovieInfo;
  availability?: Availability;
  candidates?: Candidate[];
  error?: string;
}

export function toMovieInfo(d: TmdbMovieDetails): MovieInfo {
  const year = Number.parseInt(d.release_date?.slice(0, 4) ?? '', 10);
  return {
    id: d.id,
    title: d.title,
    ...(Number.isFinite(year) ? { year } : {}),
    ...(d.runtime ? { runtime: d.runtime } : {}),
    ...(d.vote_average ? { rating: d.vote_average } : {}),
    ...(d.poster_path ? { posterPath: d.poster_path } : {}),
  };
}

export async function loadMovie(
  client: TmdbClient,
  id: number,
  country: string,
): Promise<{ movie: MovieInfo; availability: Availability }> {
  const details = await client.getMovie(id);
  return { movie: toMovieInfo(details), availability: extractAvailability(details['watch/providers']?.results, country) };
}

async function resolveOne(index: number, entry: WatchlistEntry, client: TmdbClient, country: string): Promise<FilmResult> {
  try {
    const m = await matchEntry(entry, (t) => client.searchMovies(t));
    if (m.status !== 'matched') return { index, entry, status: m.status, candidates: m.candidates };
    return { index, entry, status: 'matched', ...(await loadMovie(client, m.match.id, country)) };
  } catch (err) {
    return { index, entry, status: 'error', error: (err as Error).message };
  }
}

/**
 * Resolves entries with up to `concurrency` in flight, yielding each result as it completes
 * (so completion order, not input order; use `index` to correlate). Stops early if `signal` aborts.
 */
export async function* resolveWatchlist(
  entries: WatchlistEntry[],
  country: string,
  client: TmdbClient,
  opts: { concurrency?: number; signal?: AbortSignal } = {},
): AsyncGenerator<FilmResult> {
  const { concurrency = 8, signal } = opts;
  let next = 0;
  const done: FilmResult[] = [];
  let wake: (() => void) | undefined;
  let running = 0;

  const launch = () => {
    while (running < concurrency && next < entries.length && !signal?.aborted) {
      const i = next++;
      running++;
      resolveOne(i, entries[i]!, client, country).then((r) => {
        running--;
        done.push(r);
        wake?.();
      });
    }
  };

  launch();
  let yielded = 0;
  while (yielded < next || (next < entries.length && !signal?.aborted)) {
    while (done.length === 0) {
      if (running === 0 && (next >= entries.length || signal?.aborted)) return;
      await new Promise<void>((resolve) => (wake = resolve));
    }
    yield done.shift()!;
    yielded++;
    launch();
  }
}
