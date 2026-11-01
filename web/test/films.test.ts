import { describe, expect, it } from 'vitest';
import { filterFilms, groupByService, offersFor, sortFilms, type Filters } from '../src/lib/films';
import { splitLines } from '../src/lib/ndjson';
import type { Film } from '../src/types';

const netflix = { id: 8, name: 'Netflix' };
const prime = { id: 119, name: 'Prime Video' };
const apple = { id: 2, name: 'Apple TV' };

const film = (index: number, title: string, extra: Partial<Film> = {}): Film => ({
  index,
  entry: { title },
  status: 'matched',
  movie: { id: index, title, year: 2000 + index, runtime: 90 + index * 10, rating: 5 + index },
  availability: { flatrate: [], rent: [], buy: [] },
  ...extra,
});

const films: Film[] = [
  film(0, 'A', { availability: { flatrate: [netflix], rent: [], buy: [] } }),
  film(1, 'B', { availability: { flatrate: [netflix, prime], rent: [apple], buy: [] } }),
  film(2, 'C', { availability: { flatrate: [], rent: [apple], buy: [] } }),
  film(3, 'D'),
  film(4, 'E', { status: 'unmatched', movie: undefined }),
];
const base: Filters = { owned: new Set(), includeRentBuy: false, availableOnly: false };

describe('offersFor', () => {
  it('restricts streaming to owned services but not rent/buy', () => {
    const offers = offersFor(films[1]!.availability, { ...base, owned: new Set([119]), includeRentBuy: true });
    expect(offers.map((o) => `${o.provider.name}:${o.kind}`)).toEqual(['Prime Video:flatrate', 'Apple TV:rent']);
  });
});

describe('filterFilms', () => {
  it('drops non-matched films and keeps everything with no preferences', () => {
    expect(filterFilms(films, base).map((f) => f.movie!.title)).toEqual(['A', 'B', 'C', 'D']);
  });
  it('availableOnly hides films without offers; rent/buy widens it', () => {
    expect(filterFilms(films, { ...base, availableOnly: true }).map((f) => f.movie!.title)).toEqual(['A', 'B']);
    expect(filterFilms(films, { ...base, availableOnly: true, includeRentBuy: true }).map((f) => f.movie!.title)).toEqual(['A', 'B', 'C']);
  });
  it('owned services require a matching offer', () => {
    expect(filterFilms(films, { ...base, owned: new Set([119]) }).map((f) => f.movie!.title)).toEqual(['B']);
  });
  it('filters by year, runtime and rating', () => {
    expect(filterFilms(films, { ...base, yearMin: 2001, yearMax: 2002 }).map((f) => f.movie!.title)).toEqual(['B', 'C']);
    expect(filterFilms(films, { ...base, runtimeMax: 95 }).map((f) => f.movie!.title)).toEqual(['A']);
    expect(filterFilms(films, { ...base, ratingMin: 7 }).map((f) => f.movie!.title)).toEqual(['C', 'D']);
  });
});

describe('sortFilms', () => {
  it('sorts by key and direction, missing values last', () => {
    const withGap = [...films.slice(0, 3), film(9, 'Z', { movie: { id: 9, title: 'Z' } })];
    expect(sortFilms(withGap, { key: 'year', dir: 'desc' }, base).map((f) => f.movie!.title)).toEqual(['C', 'B', 'A', 'Z']);
    expect(sortFilms(withGap, { key: 'year', dir: 'asc' }, base).map((f) => f.movie!.title)).toEqual(['A', 'B', 'C', 'Z']);
  });
  it('sorts by number of offers', () => {
    expect(sortFilms(films.slice(0, 3), { key: 'offers', dir: 'desc' }, base).map((f) => f.movie!.title)).toEqual(['B', 'A', 'C']);
  });
});

describe('groupByService', () => {
  it('counts films per service, most first', () => {
    const groups = groupByService(filterFilms(films, base), { ...base, includeRentBuy: true });
    expect(groups.map((g) => [g.provider.name, g.films.length])).toEqual([
      ['Apple TV', 2],
      ['Netflix', 2],
      ['Prime Video', 1],
    ]);
    expect(groups[0]!.kinds).toEqual(['rent']);
  });
});

describe('splitLines', () => {
  it('returns complete lines and the partial remainder', () => {
    expect(splitLines('{"a":1}\n{"b":2}\n{"c"')).toEqual({ lines: ['{"a":1}', '{"b":2}'], rest: '{"c"' });
    expect(splitLines('')).toEqual({ lines: [], rest: '' });
  });
});
