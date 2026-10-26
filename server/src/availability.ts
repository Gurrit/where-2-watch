import type { TmdbProvider, TmdbWatchProvidersResponse } from './tmdb/types.js';

export interface ProviderRef {
  id: number;
  name: string;
}

export interface Availability {
  /** JustWatch/TMDB landing page for this film in the country, if any. */
  link?: string;
  flatrate: ProviderRef[];
  rent: ProviderRef[];
  buy: ProviderRef[];
}

const toRefs = (list: TmdbProvider[] | undefined): ProviderRef[] =>
  (list ?? [])
    .slice()
    .sort((a, b) => (a.display_priority ?? 999) - (b.display_priority ?? 999))
    .map((p) => ({ id: p.provider_id, name: p.provider_name }));

/** Free/ad-supported tiers are deliberately ignored (see spec). */
export function extractAvailability(res: TmdbWatchProvidersResponse, country: string): Availability {
  const entry = res.results[country.toUpperCase()];
  return {
    ...(entry?.link ? { link: entry.link } : {}),
    flatrate: toRefs(entry?.flatrate),
    rent: toRefs(entry?.rent),
    buy: toRefs(entry?.buy),
  };
}
