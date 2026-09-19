import { describe, expect, it } from 'vitest';
import { nameSearchClauses, searchTerms } from '@wizeworks/db';

/**
 * A PERSON WHO CANNOT BE FOUND BY THEIR NAME.
 *
 * A name is stored in two columns and typed as one string. Every search box
 * over people asked whether the WHOLE string was a substring of ONE column, so
 * "Jo Kim" was inside neither "Jo" nor "Kim" and the search found nothing —
 * over two of her orders. Measured 2026-09-16: 635 of the platform's 651
 * customers have both a first and a last name.
 *
 * Lives beside the commerce services because this package is where the search
 * clauses it feeds are read back (orders, invoices, credits); `@wizeworks/db`
 * itself carries no test runner.
 */
describe('searchTerms', () => {
  it('splits a typed name into its words', () => {
    expect(searchTerms('Jo Kim')).toEqual(['Jo', 'Kim']);
  });

  it('is empty for nothing typed, so a filter adds nothing', () => {
    expect(searchTerms('')).toEqual([]);
    expect(searchTerms('   ')).toEqual([]);
    expect(searchTerms(null)).toEqual([]);
    expect(searchTerms(undefined)).toEqual([]);
  });

  it('collapses the extra spaces a person types', () => {
    expect(searchTerms('  Wren   Ashcombe ')).toEqual(['Wren', 'Ashcombe']);
  });

  it('stops at six words, because a pasted paragraph is not a name', () => {
    expect(searchTerms('a b c d e f g h')).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('leaves an email address whole', () => {
    expect(searchTerms('jo.kim@example.com')).toEqual(['jo.kim@example.com']);
  });
});

describe('nameSearchClauses', () => {
  const columns = (term: string) => [{ firstName: term }, { lastName: term }];

  it('requires EVERY word to land somewhere', () => {
    // The whole point: one AND entry per word, each satisfied by any column.
    // "Jo" matches the first name, "Kim" the last, and the row matches.
    expect(nameSearchClauses('Jo Kim', columns)).toEqual([
      { OR: [{ firstName: 'Jo' }, { lastName: 'Jo' }] },
      { OR: [{ firstName: 'Kim' }, { lastName: 'Kim' }] },
    ]);
  });

  it('does NOT make it an either/or, which would return every Jo and every Kim', () => {
    const clauses = nameSearchClauses('Jo Kim', columns);
    expect(clauses).toHaveLength(2);
    // Two separate entries, spread into an `AND` array by the caller — not one
    // entry holding both words' columns together.
    expect(clauses.flatMap((c) => c.OR)).toHaveLength(4);
  });

  it('behaves exactly as the old single-column search did for one word', () => {
    expect(nameSearchClauses('Kim', columns)).toEqual([
      { OR: [{ firstName: 'Kim' }, { lastName: 'Kim' }] },
    ]);
  });

  it('adds nothing when nothing was typed, so spreading it is safe', () => {
    expect(nameSearchClauses('', columns)).toEqual([]);
    expect(nameSearchClauses(undefined, columns)).toEqual([]);
  });

  it('does not care what order the words came in', () => {
    // "Ashcombe Wren" and "Wren Ashcombe" both need both words matched, so both
    // find her. A prefix match on one column could only ever do one of them.
    const forwards = nameSearchClauses('Wren Ashcombe', columns);
    const backwards = nameSearchClauses('Ashcombe Wren', columns);
    expect(forwards.map((c) => c.OR).flat()).toEqual(
      expect.arrayContaining(backwards.map((c) => c.OR).flat())
    );
  });
});
