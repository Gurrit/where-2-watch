import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { extractAvailability } from '../src/availability.js';

const res = JSON.parse(readFileSync(new URL('./fixtures/providers-949.json', import.meta.url), 'utf8'));

describe('extractAvailability', () => {
  it('returns ordered flatrate/rent/buy for the country and ignores ads', () => {
    const a = extractAvailability(res, 'se');
    expect(a.flatrate.map((p) => p.name)).toEqual(['Amazon Prime Video', 'Netflix']);
    expect(a.rent).toEqual([{ id: 2, name: 'Apple TV' }]);
    expect(a.buy).toEqual([]);
    expect(a).not.toHaveProperty('ads');
    expect(a.link).toContain('themoviedb.org');
  });

  it('returns empty lists for a country with no data', () => {
    expect(extractAvailability(res, 'JP')).toEqual({ flatrate: [], rent: [], buy: [] });
  });
});
