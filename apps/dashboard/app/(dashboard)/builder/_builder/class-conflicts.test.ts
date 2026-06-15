// The raw-class reconciler is a data-correctness surface (docs/builder/04 §5: a
// lossy parser that drops a raw class on round-trip is a data-loss bug). These
// prove: duplicates are detected per layer, the recipe-vs-free-color clash is
// flagged, and resolve() is EXACTLY preserving — it removes only true in-group
// duplicates and never touches an unrecognized token or its order.

import { describe, expect, it } from 'vitest';
import {
  applyClassChangeToSibling,
  detectClassConflicts,
  hasClassConflicts,
  resolveClassConflicts,
} from './class-conflicts';

describe('detectClassConflicts', () => {
  it('is clean for a well-formed class string', () => {
    expect(detectClassConflicts('st-btn st-c-primary st-v-solid p-4 text-lg')).toEqual([]);
  });

  it('flags two members of one group at the base layer', () => {
    const c = detectClassConflicts('text-sm text-lg');
    expect(c).toHaveLength(1);
    expect(c[0]!.message).toContain('text-sm');
    expect(c[0]!.message).toContain('text-lg');
  });

  it('does NOT flag the same group across different layers', () => {
    // base size + a per-breakpoint size are independent groups, not a conflict.
    expect(detectClassConflicts('text-sm @lg:text-lg')).toEqual([]);
  });

  it('flags duplicates within a single non-base layer', () => {
    expect(hasClassConflicts('hover:bg-primary hover:bg-accent')).toBe(true);
  });

  it('flags a recipe color competing with a free utility color', () => {
    const c = detectClassConflicts('st-c-primary text-primary');
    expect(c.some((x) => x.message.includes('custom color'))).toBe(true);
  });

  it('treats a color with an opacity modifier as the same group member', () => {
    expect(hasClassConflicts('bg-primary bg-primary/50')).toBe(true);
  });

  it('does not treat an arbitrary value with a colon as a variant', () => {
    // `grid-cols-[repeat(auto-fit,minmax(0,1fr))]` has no ':' to confuse the split.
    expect(detectClassConflicts('w-[calc(100%-1rem)] p-4')).toEqual([]);
  });
});

describe('resolveClassConflicts', () => {
  it('keeps the first member of a duplicated group, drops the rest', () => {
    expect(resolveClassConflicts('text-sm text-lg')).toBe('text-sm');
  });

  it('preserves unrecognized tokens exactly and in order', () => {
    const input = 'backdrop-saturate-150 st-btn supports-[backdrop-filter]:bg-white/10 p-4';
    expect(resolveClassConflicts(input)).toBe(input);
  });

  it('dedupes per layer independently', () => {
    expect(resolveClassConflicts('bg-primary bg-accent hover:bg-primary hover:bg-accent')).toBe(
      'bg-primary hover:bg-primary'
    );
  });

  it('leaves a recipe-vs-free-color clash intact (advisory only)', () => {
    expect(resolveClassConflicts('st-c-primary text-primary')).toBe('st-c-primary text-primary');
  });

  it('is idempotent', () => {
    const once = resolveClassConflicts('m-2 m-4 flex grid text-sm');
    expect(resolveClassConflicts(once)).toBe(once);
  });
});

describe('applyClassChangeToSibling', () => {
  it('replaces a sibling group member when the primary swaps colors', () => {
    // primary: bg-primary → bg-accent; sibling had its own bg, keeps its padding.
    expect(applyClassChangeToSibling('bg-primary p-2', 'bg-accent p-2', 'bg-neutral p-8')).toBe(
      'p-8 bg-accent'
    );
  });

  it('clears the sibling group when the primary clears that control', () => {
    // text-primary / text-white share the Text-color group; clearing it on the
    // primary clears whichever color each sibling had.
    expect(applyClassChangeToSibling('text-primary flex', 'flex', 'text-white grid')).toBe('grid');
  });

  it('replaces a value-group utility (width) rather than stacking', () => {
    expect(applyClassChangeToSibling('w-1/2', 'w-full', 'w-1/3 p-4')).toBe('p-4 w-full');
  });

  it('leaves untouched groups on the sibling alone', () => {
    // Only display changed; the sibling keeps its distinct color + size.
    expect(applyClassChangeToSibling('flex', 'grid', 'block bg-accent text-lg')).toBe(
      'bg-accent text-lg grid'
    );
  });

  it('is a no-op when nothing changed', () => {
    expect(applyClassChangeToSibling('flex p-4', 'flex p-4', 'grid m-2')).toBe('grid m-2');
  });

  it('carries a color + opacity edit to the sibling group', () => {
    expect(applyClassChangeToSibling('bg-primary', 'bg-primary/60', 'bg-accent')).toBe(
      'bg-primary/60'
    );
  });
});
