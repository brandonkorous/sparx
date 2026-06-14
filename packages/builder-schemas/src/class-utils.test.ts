import { describe, expect, it } from 'vitest';
import {
  joinClasses,
  parseClasses,
  readClassGroup,
  setClassGroup,
  toggleClass,
} from './class-utils';

const COLORS = ['st-c-primary', 'st-c-secondary', 'st-c-accent'] as const;

describe('parseClasses / joinClasses', () => {
  it('tokenizes, dropping blanks + extra whitespace', () => {
    expect(parseClasses('  st-btn   st-c-primary ')).toEqual(['st-btn', 'st-c-primary']);
    expect(parseClasses(undefined)).toEqual([]);
    expect(parseClasses('')).toEqual([]);
  });
  it('round-trips', () => {
    expect(joinClasses(['a', 'b'])).toBe('a b');
  });
});

describe('readClassGroup', () => {
  it('returns the active group member, or null', () => {
    expect(readClassGroup('st-btn st-c-secondary st-v-solid', COLORS)).toBe('st-c-secondary');
    expect(readClassGroup('st-btn st-v-solid', COLORS)).toBeNull();
  });
});

describe('setClassGroup', () => {
  it('swaps the active member, preserving other tokens + their order', () => {
    expect(setClassGroup('st-btn st-c-primary st-v-solid', COLORS, 'st-c-accent')).toBe(
      'st-btn st-v-solid st-c-accent'
    );
  });
  it('adds the token when the group was empty', () => {
    expect(setClassGroup('st-btn', COLORS, 'st-c-primary')).toBe('st-btn st-c-primary');
  });
  it('clears the group when token is null', () => {
    expect(setClassGroup('st-btn st-c-primary', COLORS, null)).toBe('st-btn');
  });
  it('does not duplicate when re-selecting the active member', () => {
    expect(setClassGroup('st-c-primary', COLORS, 'st-c-primary')).toBe('st-c-primary');
  });
});

describe('toggleClass', () => {
  it('adds when on, removes when off, idempotently', () => {
    expect(toggleClass('st-btn', 'st-rounded', true)).toBe('st-btn st-rounded');
    expect(toggleClass('st-btn st-rounded', 'st-rounded', true)).toBe('st-btn st-rounded');
    expect(toggleClass('st-btn st-rounded', 'st-rounded', false)).toBe('st-btn');
  });
});
