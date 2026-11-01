import { useState } from 'react';
import { searchMovies } from '../api';
import type { Candidate, Film } from '../types';

interface Props {
  films: Film[];
  onPick: (film: Film, movieId: number) => Promise<void>;
}

const label = (f: Film) => `${f.entry.title}${f.entry.year ? ` (${f.entry.year})` : ''}`;
const candLabel = (c: Candidate) => `${c.title}${c.year ? ` (${c.year})` : ''}`;

function Row({ film, onPick }: { film: Film; onPick: Props['onPick'] }) {
  const [candidates, setCandidates] = useState<Candidate[]>(film.candidates ?? []);
  const [query, setQuery] = useState(film.entry.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li>
      <div>
        <strong>{label(film)}</strong>{' '}
        <span className="muted">
          {film.status === 'ambiguous' ? 'several possible matches' : film.status === 'error' ? `lookup failed: ${film.error}` : 'no match found'}
        </span>
      </div>
      <div className="row">
        {candidates.map((c) => (
          <button key={c.id} disabled={busy} onClick={() => run(() => onPick(film, c.id))}>
            {candLabel(c)}
          </button>
        ))}
      </div>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => setCandidates(await searchMovies(query, film.entry.year)));
        }}
      >
        <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search title" />
        <button disabled={busy || !query.trim()}>Search</button>
        {error && <span className="error">{error}</span>}
      </form>
    </li>
  );
}

export function Unmatched({ films, onPick }: Props) {
  if (films.length === 0) return null;
  return (
    <section className="panel">
      <h2>Needs your attention ({films.length})</h2>
      <ul className="unmatched">
        {films.map((f) => (
          <Row key={f.index} film={f} onPick={onPick} />
        ))}
      </ul>
    </section>
  );
}
