import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchAvailability, fetchProviders, streamWatchlist } from './api';
import { ByService } from './components/ByService';
import { FilterBar } from './components/FilterBar';
import { ResultsTable } from './components/ResultsTable';
import { Unmatched } from './components/Unmatched';
import { UploadPanel } from './components/UploadPanel';
import { filterFilms, groupByService, sortFilms, type Filters, type Sort, type SortKey } from './lib/films';
import { usePersistentState } from './lib/storage';
import type { Film, Provider } from './types';

type Phase = 'idle' | 'running' | 'done';

export function App() {
  const [country, setCountry] = usePersistentState('w2w.country', 'SE');
  const [ownedIds, setOwnedIds] = usePersistentState<number[]>('w2w.owned', []);
  const [includeRentBuy, setIncludeRentBuy] = usePersistentState('w2w.rentbuy', false);
  const [availableOnly, setAvailableOnly] = usePersistentState('w2w.availableOnly', false);
  const [range, setRange] = useState<Pick<Filters, 'yearMin' | 'yearMax' | 'runtimeMax' | 'ratingMin'>>({});

  const [films, setFilms] = useState<Film[]>([]);
  const [total, setTotal] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string>();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [sort, setSort] = useState<Sort>({ key: 'title', dir: 'asc' });
  const [view, setView] = useState<'table' | 'services'>('table');
  const abort = useRef<AbortController>();

  const filters: Filters = useMemo(
    () => ({ owned: new Set(ownedIds), includeRentBuy, availableOnly, ...range }),
    [ownedIds, includeRentBuy, availableOnly, range],
  );
  const onFilters = (f: Filters) => {
    setOwnedIds([...f.owned]);
    setIncludeRentBuy(f.includeRentBuy);
    setAvailableOnly(f.availableOnly);
    setRange({ yearMin: f.yearMin, yearMax: f.yearMax, runtimeMax: f.runtimeMax, ratingMin: f.ratingMin });
  };

  // Service list for the picker follows the selected country.
  useEffect(() => {
    const ctl = new AbortController();
    setProviders([]);
    fetchProviders(country, ctl.signal)
      .then(setProviders)
      .catch(() => undefined);
    return () => ctl.abort();
  }, [country]);

  const upsert = useCallback((incoming: Film[]) => {
    setFilms((prev) => {
      const byIndex = new Map(prev.map((f) => [f.index, f]));
      for (const f of incoming) byIndex.set(f.index, f);
      return [...byIndex.values()];
    });
  }, []);

  const start = async (file: File) => {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setFilms([]);
    setTotal(0);
    setError(undefined);
    setPhase('running');
    try {
      const csv = await file.text();
      // Buffer incoming films and flush on a timer so a big list doesn't re-render per film.
      let pending: Film[] = [];
      const flush = () => {
        if (pending.length) upsert(pending);
        pending = [];
      };
      const timer = setInterval(flush, 150);
      try {
        await streamWatchlist(
          csv,
          country,
          (e) => {
            if (e.type === 'start') setTotal(e.total);
            else if (e.type === 'film') {
              const { type: _type, ...film } = e;
              pending.push(film);
            }
          },
          ctl.signal,
        );
      } finally {
        clearInterval(timer);
        flush();
      }
      setPhase('done');
    } catch (e) {
      if (ctl.signal.aborted) {
        setPhase('done');
        return;
      }
      setError((e as Error).message);
      setPhase('done');
    }
  };

  const cancel = () => abort.current?.abort();

  // Changing country after results exist re-queries availability for the matched films.
  const lastCountry = useRef(country);
  useEffect(() => {
    if (lastCountry.current === country) return;
    lastCountry.current = country;
    if (phase === 'running') return; // the running upload keeps the country it started with
    const ids = films.filter((f) => f.movie).map((f) => f.movie!.id);
    if (ids.length === 0) return;
    const ctl = new AbortController();
    setError(undefined);
    fetchAvailability(ids, country, ctl.signal)
      .then((rows) => {
        const byId = new Map(rows.map((r) => [r.id, r]));
        setFilms((prev) =>
          prev.map((f) => {
            const row = f.movie && byId.get(f.movie.id);
            return row?.availability ? { ...f, availability: row.availability } : f;
          }),
        );
      })
      .catch((e: Error) => !ctl.signal.aborted && setError(e.message));
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country]);

  const pick = async (film: Film, movieId: number) => {
    const [row] = await fetchAvailability([movieId], country);
    if (!row?.movie || !row.availability) throw new Error(row?.error ?? 'Could not load that film');
    upsert([{ ...film, status: 'matched', movie: row.movie, availability: row.availability, candidates: undefined, error: undefined }]);
  };

  const onSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'title' ? 'asc' : 'desc' }));

  const visible = useMemo(() => sortFilms(filterFilms(films, filters), sort, filters), [films, filters, sort]);
  const groups = useMemo(() => groupByService(visible, filters), [visible, filters]);
  const needsAttention = films.filter((f) => f.status !== 'matched').sort((a, b) => a.index - b.index);
  const matchedCount = films.length - needsAttention.length;

  return (
    <div className="app">
      <header>
        <h1>where-2-watch</h1>
        <p className="muted">See where your Letterboxd watchlist is streaming.</p>
      </header>

      <UploadPanel country={country} onCountry={setCountry} running={phase === 'running'} onFile={start} onCancel={cancel} />

      {error && <p className="error" role="alert">{error}</p>}

      {(phase !== 'idle' || films.length > 0) && (
        <>
          {total > 0 && (
            <div className="progress">
              <progress value={films.length} max={total} />
              <span>
                {films.length} / {total} films{phase === 'running' ? '…' : ''}
              </span>
            </div>
          )}

          <FilterBar filters={filters} onChange={onFilters} providers={providers} />

          <div className="row tabs">
            <button className={view === 'table' ? 'tab on' : 'tab'} onClick={() => setView('table')}>
              Films ({visible.length} of {matchedCount})
            </button>
            <button className={view === 'services' ? 'tab on' : 'tab'} onClick={() => setView('services')}>
              By service
            </button>
          </div>

          {view === 'table' ? (
            <ResultsTable films={visible} filters={filters} sort={sort} onSort={onSort} />
          ) : (
            <ByService groups={groups} total={visible.length} />
          )}

          <Unmatched films={needsAttention} onPick={pick} />
        </>
      )}

      <footer>
        <p>
          Watch-provider data by <a href="https://www.justwatch.com">JustWatch</a>, via{' '}
          <a href="https://www.themoviedb.org">TMDB</a>. This product uses the TMDB API but is not endorsed or certified by TMDB. Not affiliated with
          Letterboxd.
        </p>
      </footer>
    </div>
  );
}
