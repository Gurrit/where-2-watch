export interface TmdbSearchResult {
  id: number;
  title: string;
  original_title: string;
  release_date?: string;
  popularity: number;
  vote_average?: number;
  poster_path?: string | null;
}

export interface TmdbSearchResponse {
  page: number;
  results: TmdbSearchResult[];
  total_results: number;
}

export interface TmdbProvider {
  provider_id: number;
  provider_name: string;
  logo_path?: string | null;
  display_priority?: number;
}

export interface TmdbCountryProviders {
  link?: string;
  flatrate?: TmdbProvider[];
  rent?: TmdbProvider[];
  buy?: TmdbProvider[];
  ads?: TmdbProvider[];
  free?: TmdbProvider[];
}

export interface TmdbWatchProvidersResponse {
  id: number;
  results: Record<string, TmdbCountryProviders>;
}

export interface TmdbProviderListResponse {
  results: TmdbProvider[];
}
