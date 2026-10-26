import type { WatchlistEntry } from '../parsers/types.js';
import type { TmdbSearchResponse, TmdbSearchResult } from '../tmdb/types.js';

export interface Candidate {
  id: number;
  title: string;
  year?: number;
  popularity: number;
}

export type MatchResult =
  | { status: 'matched'; entry: WatchlistEntry; match: Candidate }
  | { status: 'ambiguous'; entry: WatchlistEntry; candidates: Candidate[] }
  /** `candidates` holds best guesses (title search hits outside the year window); may be empty. */
  | { status: 'unmatched'; entry: WatchlistEntry; candidates: Candidate[] };

export type SearchFn = (title: string) => Promise<TmdbSearchResponse>;

const YEAR_TOLERANCE = 1;
const MAX_GUESSES = 5;

export function normalizeTitle(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function toCandidate(r: TmdbSearchResult): Candidate {
  const year = Number.parseInt(r.release_date?.slice(0, 4) ?? '', 10);
  return { id: r.id, title: r.title, ...(Number.isFinite(year) ? { year } : {}), popularity: r.popularity };
}

const byPopularity = (a: Candidate, b: Candidate) => b.popularity - a.popularity;

export async function matchEntry(entry: WatchlistEntry, search: SearchFn): Promise<MatchResult> {
  const { results } = await search(entry.title);
  const wanted = normalizeTitle(entry.title);

  const titleHits = results.filter(
    (r) => normalizeTitle(r.title) === wanted || normalizeTitle(r.original_title) === wanted,
  );
  const inWindow = titleHits.map(toCandidate).filter(
    (c) => entry.year === undefined || (c.year !== undefined && Math.abs(c.year - entry.year) <= YEAR_TOLERANCE),
  );

  if (inWindow.length === 0) {
    const guesses = (titleHits.length > 0 ? titleHits : results).map(toCandidate).sort(byPopularity);
    return { status: 'unmatched', entry, candidates: guesses.slice(0, MAX_GUESSES) };
  }
  if (inWindow.length === 1) return { status: 'matched', entry, match: inWindow[0]! };

  // Several in the window: an exact-year hit wins only if it is the sole one.
  const exact = inWindow.filter((c) => c.year === entry.year);
  if (exact.length === 1) return { status: 'matched', entry, match: exact[0]! };
  const pool = exact.length > 1 ? exact : inWindow;
  return { status: 'ambiguous', entry, candidates: pool.sort(byPopularity).slice(0, MAX_GUESSES) };
}
