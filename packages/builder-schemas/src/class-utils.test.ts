import { describe, expect, it } from 'vitest';
import {
  joinClasses,
  parseClasses,
  readClassGroup,
  setClassGroup,
  toggleClass,
} from './class-utils';

const COLORS = ['sf-c-primary', 'sf-c-secondary', 'sf-c-accent'] as const;

describe('parseClasses / joinClasses', () => {
  it('tokenizes, dropping blanks + extra whitespace', () => {
    expect(parseClasses('  sf-btn   sf-c-primary ')).toEqual(['sf-btn', 'sf-c-primary']);
    expect(parseClasses(undefined)).toEqual([]);
    expect(parseClasses('')).toEqual([]);
  });
  it('round-trips', () => {
    expect(joinClasses(['a', 'b'])).toBe('a b');
  });
});

describe('readClassGroup', () => {
  it('returns the active group member, or null', () => {
    expect(readClassGroup('sf-btn sf-c-secondary sf-v-solid', COLORS)).toBe('sf-c-secondary');
    expect(readClassGroup('sf-btn sf-v-solid', COLORS)).toBeNull();
  });
});

describe('setClassGroup', () => {
  it('swaps the active member, preserving other tokens + their order', () => {
    expect(setClassGroup('sf-btn sf-c-primary sf-v-solid', COLORS, 'sf-c-accent')).toBe(
      'sf-btn sf-v-solid sf-c-accent'
    );
  });
  it('adds the token when the group was empty', () => {
    expect(setClassGroup('sf-btn', COLORS, 'sf-c-primary')).toBe('sf-btn sf-c-primary');
  });
  it('clears the group when token is null', () => {
    expect(setClassGroup('sf-btn sf-c-primary', COLORS, null)).toBe('sf-btn');
  });
  it('does not duplicate when re-selecting the active member', () => {
    expect(setClassGroup('sf-c-primary', COLORS, 'sf-c-primary')).toBe('sf-c-primary');
  });
});

describe('toggleClass', () => {
  it('adds when on, removes when off, idempotently', () => {
    expect(toggleClass('sf-btn', 'sf-rounded', true)).toBe('sf-btn sf-rounded');
    expect(toggleClass('sf-btn sf-rounded', 'sf-rounded', true)).toBe('sf-btn sf-rounded');
    expect(toggleClass('sf-btn sf-rounded', 'sf-rounded', false)).toBe('sf-btn');
  });
});
