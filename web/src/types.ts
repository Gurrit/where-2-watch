// Mirrors the server's response shapes (server/src/pipeline.ts, availability.ts, matching/matcher.ts).

export interface ProviderRef {
  id: number;
  name: string;
}

export interface Availability {
  link?: string;
  flatrate: ProviderRef[];
  rent: ProviderRef[];
  buy: ProviderRef[];
}

export interface MovieInfo {
  id: number;
  title: string;
  year?: number;
  runtime?: number;
  rating?: number;
  posterPath?: string;
}

export interface Candidate {
  id: number;
  title: string;
  year?: number;
  popularity: number;
}

export interface Film {
  index: number;
  entry: { title: string; year?: number };
  status: 'matched' | 'ambiguous' | 'unmatched' | 'error';
  movie?: MovieInfo;
  availability?: Availability;
  candidates?: Candidate[];
  error?: string;
}

export type StreamEvent = { type: 'start'; total: number } | ({ type: 'film' } & Film) | { type: 'done' };

export interface Provider {
  id: number;
  name: string;
  logoPath?: string;
}
