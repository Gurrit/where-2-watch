import { useRef } from 'react';
import { CountrySelect } from './CountrySelect';

interface Props {
  country: string;
  onCountry: (c: string) => void;
  running: boolean;
  onFile: (file: File) => void;
  onCancel: () => void;
}

export function UploadPanel({ country, onCountry, running, onFile, onCancel }: Props) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <section className="panel">
      <div className="row">
        <CountrySelect value={country} onChange={onCountry} />
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = '';
          }}
        />
        {running ? (
          <button onClick={onCancel}>Cancel</button>
        ) : (
          <button className="primary" onClick={() => input.current?.click()}>
            Upload watchlist.csv
          </button>
        )}
      </div>
      <p className="hint">
        Export it from Letterboxd: Settings → Import &amp; Export → Export your data, then use <code>watchlist.csv</code> from the zip. Your
        file is processed on the fly and never stored.
      </p>
    </section>
  );
}
