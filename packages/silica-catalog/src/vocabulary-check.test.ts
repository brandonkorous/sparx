// The three utilities that actually shipped broken, plus the false positives that
// would make this guard worse than useless if it were any stricter.

import { describe, expect, it } from 'vitest';

import { checkClass, checkClassString, checkTreeClasses } from './vocabulary-check';

describe('vocabulary-check — the real failures', () => {
  // Every one of these shipped to a live site and was found by eye afterwards.
  it('catches `gap-7` (the scale skips odd steps above 6)', () => {
    const issue = checkClass('gap-7');
    expect(issue?.reason).toBe('out-of-range');
    // The hint must name a value that WORKS — "invalid" alone leaves the author guessing.
    expect(issue?.hint).toContain('gap-6');
  });

  it('catches `leading-[1.05]` and every other arbitrary value', () => {
    expect(checkClass('leading-[1.05]')?.reason).toBe('arbitrary-value');
    expect(checkClass('w-[37px]')?.reason).toBe('arbitrary-value');
    expect(checkClass('lg:grid-cols-[1fr_2fr]')?.reason).toBe('arbitrary-value');
  });

  it('catches an out-of-range step behind a breakpoint variant', () => {
    // `lg:row-start-1` was the original bug; the range now stops at 7.
    expect(checkClass('lg:row-start-9')?.reason).toBe('out-of-range');
  });

  it('catches an out-of-range padding step', () => {
    expect(checkClass('py-7')?.reason).toBe('out-of-range');
    expect(checkClass('sm:pt-13')?.reason).toBe('out-of-range');
  });
});

describe('vocabulary-check — what it must NOT flag', () => {
  // These are the reason rule 2 is restricted to numeric scales. Each is a real,
  // scan-covered utility living in a family the vocabulary also declares; flagging any
  // of them would reject correct authoring on nearly every page.
  it('passes non-numeric values in a declared family', () => {
    for (const cls of ['text-center', 'text-left', 'font-mono', 'border-t', 'p-px', 'text-base']) {
      expect(checkClass(cls), `${cls} should pass`).toBeNull();
    }
  });

  it('passes declared values, with and without variants', () => {
    for (const cls of ['gap-6', 'lg:col-span-4', 'sm:text-5xl', 'leading-none', 'max-w-3xl']) {
      expect(checkClass(cls), `${cls} should pass`).toBeNull();
    }
  });

  it('passes utilities from families the vocabulary never declares', () => {
    // Covered by the @source scan (silicaui dist + this package), not by the declared
    // list. Assuming coverage is deliberate: a false positive blocks authoring.
    for (const cls of [
      'flex',
      'w-full',
      'rounded-box',
      'btn-primary',
      'aspect-video',
      'contents',
    ]) {
      expect(checkClass(cls), `${cls} should pass`).toBeNull();
    }
  });

  it('passes the composites this package ships', () => {
    // If the guard flagged our own catalog, it would be wrong by construction.
    const issues = checkClassString(
      'mx-auto w-full max-w-5xl px-6 py-16 sm:py-20 grid grid-cols-1 gap-6 lg:grid-cols-2'
    );
    expect(issues).toEqual([]);
  });
});

describe('checkTreeClasses', () => {
  it('walks a tree and reports each bad class ONCE', () => {
    const tree = {
      class: 'flex gap-7',
      children: [
        { class: 'gap-7', children: [] },
        { class: 'py-7', children: [] },
        'a loose text child',
      ],
    };
    const issues = checkTreeClasses(tree);
    // `gap-7` appears twice; nine copies of one message buries the other problem.
    expect(issues.map((i) => i.className).sort()).toEqual(['gap-7', 'py-7']);
  });

  it('survives a tree with no classes at all', () => {
    expect(checkTreeClasses({ children: ['text'] })).toEqual([]);
  });
});
