import { splitLines } from './lib/ndjson';
import type { Availability, Candidate, MovieInfo, Provider, StreamEvent } from './types';

async function errorMessage(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
  if (res.status === 429) return 'Too many requests, please wait a bit and try again.';
  return body?.error ?? body?.message ?? `Request failed (HTTP ${res.status})`;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()) as T;
}

/** Uploads the CSV and calls `onEvent` for each streamed NDJSON line. Resolves when the stream ends. */
export async function streamWatchlist(
  csv: string,
  country: string,
  onEvent: (e: StreamEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch(`/api/watchlist?country=${encodeURIComponent(country)}`, {
    method: 'POST',
    headers: { 'content-type': 'text/csv' },
    body: csv,
    signal,
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  if (!res.body) throw new Error('Streaming is not supported by this browser');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { lines, rest } = splitLines(buffer);
    buffer = rest;
    for (const line of lines) onEvent(JSON.parse(line) as StreamEvent);
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as StreamEvent);
}

export async function fetchProviders(country: string, signal?: AbortSignal): Promise<Provider[]> {
  const { providers } = await getJson<{ providers: Provider[] }>(`/api/providers?country=${country}`, signal);
  return providers;
}

export interface AvailabilityRow {
  id: number;
  movie?: MovieInfo;
  availability?: Availability;
  error?: string;
}

const CHUNK = 200;

export async function fetchAvailability(ids: number[], country: string, signal?: AbortSignal): Promise<AvailabilityRow[]> {
  const rows: AvailabilityRow[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK).join(',');
    const { films } = await getJson<{ films: AvailabilityRow[] }>(`/api/availability?ids=${chunk}&country=${country}`, signal);
    rows.push(...films);
  }
  return rows;
}

export async function searchMovies(q: string, year?: number): Promise<Candidate[]> {
  const params = new URLSearchParams({ q, ...(year ? { year: String(year) } : {}) });
  const { candidates } = await getJson<{ candidates: Candidate[] }>(`/api/search?${params}`);
  return candidates;
}
