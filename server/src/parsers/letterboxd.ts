import { parse } from 'csv-parse/sync';
import type { WatchlistEntry, WatchlistParser } from './types.js';

export class InvalidWatchlistError extends Error {}

export const letterboxdParser: WatchlistParser = {
  parse(input) {
    let rows: Record<string, string>[];
    try {
      rows = parse(input, { columns: true, skip_empty_lines: true, bom: true, trim: true });
    } catch (err) {
      throw new InvalidWatchlistError(`Malformed CSV: ${(err as Error).message}`);
    }
    if (rows.length > 0 && !('Name' in rows[0]!)) {
      throw new InvalidWatchlistError('Missing "Name" column; is this a Letterboxd watchlist export?');
    }
    return rows.flatMap((row): WatchlistEntry[] => {
      const title = row['Name'];
      if (!title) return [];
      const year = Number.parseInt(row['Year'] ?? '', 10);
      return [{ title, ...(Number.isFinite(year) ? { year } : {}) }];
    });
  },
};
