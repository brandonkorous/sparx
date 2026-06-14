import { describe, expect, it } from 'vitest';
import {
  COLOR_KEYS,
  SIZE_KEYS,
  chipTreatmentVariants,
  colorClass,
  colorVariants,
  treatmentVariants,
} from './variants';

describe('variant recipe', () => {
  it('includes the surface slot alongside the semantic colors', () => {
    expect(COLOR_KEYS).toContain('surface');
    expect(COLOR_KEYS).toContain('primary');
    expect(COLOR_KEYS).toContain('danger');
  });

  it('maps every color key to its st-c-* role-var class', () => {
    for (const key of COLOR_KEYS) {
      expect(colorVariants[key]).toBe(`st-c-${key}`);
    }
  });

  it('colorClass resolves known and runtime-custom colors, empty for nullish', () => {
    expect(colorClass('primary')).toBe('st-c-primary');
    expect(colorClass('brand-mint')).toBe('st-c-brand-mint');
    expect(colorClass(undefined)).toBe('');
    expect(colorClass(null)).toBe('');
  });

  it('exposes the full treatment set incl. glass, mapped to st-v-* classes', () => {
    expect(treatmentVariants.solid).toBe('st-v-solid');
    expect(treatmentVariants.glass).toBe('st-v-glass');
    expect(treatmentVariants.link).toBe('st-v-link');
    expect(Object.keys(treatmentVariants)).toHaveLength(7);
  });

  it('chipTreatmentVariants is a subset (no link/ghost/glass)', () => {
    expect(Object.keys(chipTreatmentVariants).sort()).toEqual([
      'dashed',
      'outline',
      'soft',
      'solid',
    ]);
    expect(chipTreatmentVariants.solid).toBe(treatmentVariants.solid);
  });

  it('exposes the xs…xl size scale', () => {
    expect(SIZE_KEYS).toEqual(['xs', 'sm', 'md', 'lg', 'xl']);
  });
});
