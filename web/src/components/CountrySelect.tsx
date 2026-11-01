import { COUNTRY_CODES, countryName } from '../lib/countries';

const options = COUNTRY_CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name));

export function CountrySelect({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  return (
    <label>
      Country{' '}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
