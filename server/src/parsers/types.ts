/** A film as read from an input file, before matching against TMDB. */
export interface WatchlistEntry {
  title: string;
  year?: number;
  /** Source-specific identifiers, e.g. { imdb: 'tt0111161' } for future IMDb support. */
  externalIds?: Record<string, string>;
}

export interface WatchlistParser {
  parse(input: string): WatchlistEntry[];
}
