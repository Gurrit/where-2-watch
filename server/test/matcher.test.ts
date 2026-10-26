import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { matchEntry, normalizeTitle, type SearchFn } from '../src/matching/matcher.js';

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const searchWith = (name: string): SearchFn => async () => fixture(name);

describe('normalizeTitle', () => {
  it('ignores case, accents and punctuation', () => {
    expect(normalizeTitle('Amélie & Co.')).toBe('amelie and co');
  });
});

describe('matchEntry', () => {
  it('matches a unique title within the year window', async () => {
    const r = await matchEntry({ title: 'Heat', year: 1995 }, searchWith('search-heat'));
    expect(r).toMatchObject({ status: 'matched', match: { id: 949 } });
  });

  it('accepts a year off by one', async () => {
    const r = await matchEntry({ title: 'Heat', year: 1996 }, searchWith('search-heat'));
    expect(r).toMatchObject({ status: 'matched', match: { id: 949 } });
  });

  it('does not accept a year off by two; offers guesses instead', async () => {
    const r = await matchEntry({ title: 'Heat', year: 1993 }, searchWith('search-heat'));
    expect(r.status).toBe('unmatched');
    expect(r).toMatchObject({ candidates: [{ id: 949 }, { id: 2000 }] });
  });

  it('is ambiguous without a year when several films share the title', async () => {
    const r = await matchEntry({ title: 'Heat' }, searchWith('search-heat'));
    expect(r).toMatchObject({ status: 'ambiguous', candidates: [{ id: 949 }, { id: 2000 }] });
  });

  it('matches on original title', async () => {
    const r = await matchEntry({ title: 'Солярис', year: 1972 }, searchWith('search-solaris'));
    expect(r).toMatchObject({ status: 'matched', match: { id: 593 } });
  });

  it('prefers a sole exact-year hit when the window holds several', async () => {
    const search: SearchFn = async () => ({
      page: 1,
      total_results: 2,
      results: [
        { id: 1, title: 'X', original_title: 'X', release_date: '2000-01-01', popularity: 1 },
        { id: 2, title: 'X', original_title: 'X', release_date: '2001-01-01', popularity: 9 },
      ],
    });
    expect(await matchEntry({ title: 'X', year: 2000 }, search)).toMatchObject({ status: 'matched', match: { id: 1 } });
  });

  it('is unmatched with no candidates when search finds nothing', async () => {
    const r = await matchEntry({ title: 'Zzz', year: 2000 }, searchWith('search-nothing'));
    expect(r).toEqual({ status: 'unmatched', entry: { title: 'Zzz', year: 2000 }, candidates: [] });
  });
});
