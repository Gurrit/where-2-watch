import type { ServiceGroup } from '../lib/films';

export function ByService({ groups, total }: { groups: ServiceGroup[]; total: number }) {
  if (groups.length === 0) return <p className="muted">No services cover any of the listed films.</p>;
  return (
    <div className="groups">
      {groups.map((g) => (
        <details key={g.provider.id}>
          <summary>
            <strong>{g.provider.name}</strong> — {g.films.length} of {total} films
            {g.kinds.some((k) => k !== 'flatrate') && <small> (incl. {g.kinds.filter((k) => k !== 'flatrate').join('/')})</small>}
          </summary>
          <ul>
            {g.films.map((f) => (
              <li key={f.index}>
                {f.movie!.title} {f.movie!.year && <span className="muted">({f.movie!.year})</span>}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
