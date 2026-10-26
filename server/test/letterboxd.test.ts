import { describe, expect, it } from 'vitest';
import { letterboxdParser, InvalidWatchlistError } from '../src/parsers/letterboxd.js';

const csv = `Date,Name,Year,Letterboxd URI
2024-01-02,Heat,1995,https://boxd.it/abc
2024-01-03,"Birdman or (The Unexpected Virtue of Ignorance)",2014,https://boxd.it/def
2024-01-04,No Year,,https://boxd.it/ghi
`;

describe('letterboxdParser', () => {
  it('parses name and year', () => {
    expect(letterboxdParser.parse(csv)).toEqual([
      { title: 'Heat', year: 1995 },
      { title: 'Birdman or (The Unexpected Virtue of Ignorance)', year: 2014 },
      { title: 'No Year' },
    ]);
  });

  it('rejects files without a Name column', () => {
    expect(() => letterboxdParser.parse('a,b\n1,2\n')).toThrow(InvalidWatchlistError);
  });
});
