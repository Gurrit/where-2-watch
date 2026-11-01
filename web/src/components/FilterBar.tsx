import type { Filters } from '../lib/films';
import type { Provider } from '../types';

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  providers: Provider[];
}

const num = (s: string) => (s === '' || Number.isNaN(Number(s)) ? undefined : Number(s));

export function FilterBar({ filters, onChange, providers }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const toggleOwned = (id: number) => {
    const owned = new Set(filters.owned);
    if (!owned.delete(id)) owned.add(id);
    set({ owned });
  };
  return (
    <section className="panel">
      <details open={filters.owned.size > 0 || undefined}>
        <summary>My services ({filters.owned.size} selected)</summary>
        <div className="chips">
          {providers.map((p) => (
            <label key={p.id} className={filters.owned.has(p.id) ? 'chip on' : 'chip'}>
              <input type="checkbox" checked={filters.owned.has(p.id)} onChange={() => toggleOwned(p.id)} /> {p.name}
            </label>
          ))}
          {providers.length === 0 && <span className="hint">Loading services…</span>}
        </div>
      </details>
      <div className="row">
        <label>
          <input type="checkbox" checked={filters.includeRentBuy} onChange={(e) => set({ includeRentBuy: e.target.checked })} /> Include rent/buy
        </label>
        <label>
          <input type="checkbox" checked={filters.availableOnly} onChange={(e) => set({ availableOnly: e.target.checked })} /> Hide films with no
          options
        </label>
        <label>
          Year <input className="n" inputMode="numeric" value={filters.yearMin ?? ''} onChange={(e) => set({ yearMin: num(e.target.value) })} />–
          <input className="n" inputMode="numeric" value={filters.yearMax ?? ''} onChange={(e) => set({ yearMax: num(e.target.value) })} />
        </label>
        <label>
          Max runtime{' '}
          <input className="n" inputMode="numeric" value={filters.runtimeMax ?? ''} onChange={(e) => set({ runtimeMax: num(e.target.value) })} /> min
        </label>
        <label>
          Min rating{' '}
          <input className="n" inputMode="decimal" value={filters.ratingMin ?? ''} onChange={(e) => set({ ratingMin: num(e.target.value) })} />
        </label>
      </div>
    </section>
  );
}
