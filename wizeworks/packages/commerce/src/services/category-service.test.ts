import { describe, expect, it } from 'vitest';

import { categoryMatchesFilter } from './category-service';

// The category list's `q` + featured filter is the subtle part (case-insensitive
// over two fields, AND a tri-state boolean, with blank/whitespace queries meaning
// "no filter"). Unit-tested directly; the DB read, RLS, and flat-vs-tree shaping
// are covered by the api-rest integration suite.

const engine = { name: 'Engine Parts', handle: 'engine-parts', featured: true };
const brakes = { name: 'Brakes', handle: 'brakes', featured: false };

describe('categoryMatchesFilter', () => {
  it('matches on name, case-insensitively', () => {
    expect(categoryMatchesFilter(engine, 'engine', undefined)).toBe(true);
    expect(categoryMatchesFilter(engine, 'ENGINE', undefined)).toBe(true);
    expect(categoryMatchesFilter(engine, 'gine pa', undefined)).toBe(true);
  });

  it('matches on handle when the name does not contain the term', () => {
    expect(categoryMatchesFilter(engine, 'engine-parts', undefined)).toBe(true);
    expect(categoryMatchesFilter(brakes, 'brakes', undefined)).toBe(true);
  });

  it('rejects a non-matching term', () => {
    expect(categoryMatchesFilter(engine, 'suspension', undefined)).toBe(false);
  });

  it('treats a blank or whitespace-only query as no text filter', () => {
    expect(categoryMatchesFilter(engine, '', undefined)).toBe(true);
    expect(categoryMatchesFilter(brakes, '   ', undefined)).toBe(true);
  });

  it('filters to featured only when featured=true', () => {
    expect(categoryMatchesFilter(engine, '', true)).toBe(true);
    expect(categoryMatchesFilter(brakes, '', true)).toBe(false);
  });

  it('filters to not-featured only when featured=false', () => {
    expect(categoryMatchesFilter(engine, '', false)).toBe(false);
    expect(categoryMatchesFilter(brakes, '', false)).toBe(true);
  });

  it('does not filter on featured when it is undefined', () => {
    expect(categoryMatchesFilter(engine, '', undefined)).toBe(true);
    expect(categoryMatchesFilter(brakes, '', undefined)).toBe(true);
  });

  it('ANDs the text and featured filters', () => {
    // matches the term but not the featured constraint
    expect(categoryMatchesFilter(engine, 'engine', false)).toBe(false);
    // matches both
    expect(categoryMatchesFilter(engine, 'engine', true)).toBe(true);
    // matches the featured constraint but not the term
    expect(categoryMatchesFilter(brakes, 'engine', false)).toBe(false);
  });
});
