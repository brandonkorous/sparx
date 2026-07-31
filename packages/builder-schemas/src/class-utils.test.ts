import { describe, expect, it } from 'vitest';
import {
  joinClasses,
  parseClasses,
  readClassGroup,
  setClassGroup,
  toggleClass,
} from './class-utils';

const COLORS = ['btn-primary', 'btn-secondary', 'btn-accent'] as const;

describe('parseClasses / joinClasses', () => {
  it('tokenizes, dropping blanks + extra whitespace', () => {
    expect(parseClasses('  btn   btn-primary ')).toEqual(['btn', 'btn-primary']);
    expect(parseClasses(undefined)).toEqual([]);
    expect(parseClasses('')).toEqual([]);
  });
  it('round-trips', () => {
    expect(joinClasses(['a', 'b'])).toBe('a b');
  });
});

describe('readClassGroup', () => {
  it('returns the active group member, or null', () => {
    expect(readClassGroup('btn btn-secondary btn-md', COLORS)).toBe('btn-secondary');
    expect(readClassGroup('btn btn-md', COLORS)).toBeNull();
  });
});

describe('setClassGroup', () => {
  it('swaps the active member, preserving other tokens + their order', () => {
    expect(setClassGroup('btn btn-primary btn-md', COLORS, 'btn-accent')).toBe(
      'btn btn-md btn-accent'
    );
  });
  it('adds the token when the group was empty', () => {
    expect(setClassGroup('btn', COLORS, 'btn-primary')).toBe('btn btn-primary');
  });
  it('clears the group when token is null', () => {
    expect(setClassGroup('btn btn-primary', COLORS, null)).toBe('btn');
  });
  it('does not duplicate when re-selecting the active member', () => {
    expect(setClassGroup('btn-primary', COLORS, 'btn-primary')).toBe('btn-primary');
  });
});

describe('toggleClass', () => {
  it('adds when on, removes when off, idempotently', () => {
    expect(toggleClass('btn', 'rounded-full', true)).toBe('btn rounded-full');
    expect(toggleClass('btn rounded-full', 'rounded-full', true)).toBe('btn rounded-full');
    expect(toggleClass('btn rounded-full', 'rounded-full', false)).toBe('btn');
  });
});
