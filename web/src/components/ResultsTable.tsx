import { offersFor, type Filters, type Sort, type SortKey } from '../lib/films';
import type { Film } from '../types';

interface Props {
  films: Film[];
  filters: Filters;
  sort: Sort;
  onSort: (key: SortKey) => void;
}

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'title', label: 'Title' },
  { key: 'year', label: 'Year', numeric: true },
  { key: 'runtime', label: 'Runtime', numeric: true },
  { key: 'rating', label: 'Rating', numeric: true },
];

export function ResultsTable({ films, filters, sort, onSort }: Props) {
  const arrow = (key: SortKey) => (sort.key === key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '');
  return (
    <div className="table-wrap">
      <table className="dense">
        <thead>
          <tr>
            {[...COLUMNS, { key: 'offers' as SortKey, label: 'Where to watch', numeric: false }].map((c) => (
              <th
                key={c.key}
                className={c.numeric ? 'num' : undefined}
                aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
              >
                <button className="th" onClick={() => onSort(c.key)}>
                  {c.label}
                  {arrow(c.key)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {films.map((film) => {
            const offers = offersFor(film.availability, filters);
            return (
              <tr key={film.index}>
                <td>
                  {film.availability?.link ? (
                    <a href={film.availability.link} target="_blank" rel="noreferrer">
                      {film.movie!.title}
                    </a>
                  ) : (
                    film.movie!.title
                  )}
                </td>
                <td className="num">{film.movie!.year ?? '–'}</td>
                <td className="num">{film.movie!.runtime ? `${film.movie!.runtime} min` : '–'}</td>
                <td className="num">{film.movie!.rating ? film.movie!.rating.toFixed(1) : '–'}</td>
                <td>
                  {offers.length === 0 ? (
                    <span className="muted">Not available</span>
                  ) : (
                    offers.map((o) => (
                      <span key={`${o.kind}-${o.provider.id}`} className={`tag ${o.kind}`} title={o.kind}>
                        {o.provider.name}
                        {o.kind !== 'flatrate' && <small> ({o.kind})</small>}
                      </span>
                    ))
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
