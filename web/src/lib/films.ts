import type { Availability, Film, ProviderRef } from '../types';

export type OfferKind = 'flatrate' | 'rent' | 'buy';
export interface Offer {
  provider: ProviderRef;
  kind: OfferKind;
}

export interface Filters {
  /** Provider ids the user subscribes to. Empty means "no preference". */
  owned: ReadonlySet<number>;
  includeRentBuy: boolean;
  /** With no owned services, hide films that have no offers at all. */
  availableOnly: boolean;
  yearMin?: number;
  yearMax?: number;
  runtimeMax?: number;
  ratingMin?: number;
}

export type SortKey = 'title' | 'year' | 'runtime' | 'rating' | 'offers';
export interface Sort {
  key: SortKey;
  dir: 'asc' | 'desc';
}

/**
 * The offers that count under the current filters: streaming (restricted to owned services when any
 * are chosen) and, if enabled, rent/buy from any service.
 */
export function offersFor(av: Availability | undefined, f: Filters): Offer[] {
  if (!av) return [];
  const offers: Offer[] = av.flatrate
    .filter((p) => f.owned.size === 0 || f.owned.has(p.id))
    .map((provider) => ({ provider, kind: 'flatrate' }));
  if (f.includeRentBuy) {
    offers.push(...av.rent.map((provider): Offer => ({ provider, kind: 'rent' })));
    offers.push(...av.buy.map((provider): Offer => ({ provider, kind: 'buy' })));
  }
  return offers;
}

const within = (value: number | undefined, min?: number, max?: number) =>
  (min === undefined && max === undefined) || (value !== undefined && (min === undefined || value >= min) && (max === undefined || value <= max));

export function filterFilms(films: Film[], f: Filters): Film[] {
  return films.filter((film) => {
    if (film.status !== 'matched' || !film.movie) return false;
    const m = film.movie;
    if (!within(m.year, f.yearMin, f.yearMax)) return false;
    if (!within(m.runtime, undefined, f.runtimeMax)) return false;
    if (!within(m.rating, f.ratingMin, undefined)) return false;
    const hasOffers = offersFor(film.availability, f).length > 0;
    return f.owned.size > 0 || f.availableOnly ? hasOffers : true;
  });
}

export function sortFilms(films: Film[], sort: Sort, f: Filters): Film[] {
  const value = (film: Film): string | number | undefined => {
    switch (sort.key) {
      case 'title':
        return film.movie?.title.toLowerCase();
      case 'year':
        return film.movie?.year;
      case 'runtime':
        return film.movie?.runtime;
      case 'rating':
        return film.movie?.rating;
      case 'offers':
        return offersFor(film.availability, f).length;
    }
  };
  const sign = sort.dir === 'asc' ? 1 : -1;
  return films.slice().sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === undefined && vb === undefined) return a.index - b.index;
    if (va === undefined) return 1; // missing values always last
    if (vb === undefined) return -1;
    return (va < vb ? -1 : va > vb ? 1 : a.index - b.index) * sign;
  });
}

export interface ServiceGroup {
  provider: ProviderRef;
  kinds: OfferKind[];
  films: Film[];
}

/** Which services cover the most of the (already filtered) list. */
export function groupByService(films: Film[], f: Filters): ServiceGroup[] {
  const groups = new Map<number, ServiceGroup>();
  for (const film of films) {
    for (const { provider, kind } of offersFor(film.availability, f)) {
      const g = groups.get(provider.id) ?? { provider, kinds: [], films: [] };
      if (!g.kinds.includes(kind)) g.kinds.push(kind);
      if (!g.films.includes(film)) g.films.push(film);
      groups.set(provider.id, g);
    }
  }
  return [...groups.values()].sort((a, b) => b.films.length - a.films.length || a.provider.name.localeCompare(b.provider.name));
}
