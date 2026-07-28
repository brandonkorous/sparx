// The three utilities that actually shipped broken, plus the false positives that
// would make this guard worse than useless if it were any stricter.

import { describe, expect, it } from 'vitest';

import { blogIndexPage, blogPostPage } from './cms';
import {
  buyBox,
  collectionHeader,
  featuredProducts,
  productDetailPage,
  productGrid,
  shopHeader,
} from './commerce';
import { siteFooter, siteNavbar } from './site-chrome';
import { starterSite } from './site';
import {
  checkClass,
  checkClassString,
  checkTreeClasses,
  validateResponsiveVocabulary,
} from './vocabulary-check';

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
    // `lg:row-start-1` was the original bug; the range now stops at 7. Written as a
    // CONTAINER variant because a viewport one is now its own (earlier) verdict.
    expect(checkClass('@5xl:row-start-9')?.reason).toBe('out-of-range');
  });

  it('catches an out-of-range padding step', () => {
    expect(checkClass('py-7')?.reason).toBe('out-of-range');
    expect(checkClass('@2xl:pt-13')?.reason).toBe('out-of-range');
  });
});

describe('vocabulary-check — viewport variants', () => {
  // The odd rule out: these classes DO compile and DO work on the published page.
  // They are flagged because the editor's device toggle resizes an element, not the
  // window, so a viewport variant is invisible in the only tool that authors it.
  it('flags every viewport breakpoint and names the container class to use', () => {
    const cases: [string, string][] = [
      ['sm:text-5xl', '@2xl:text-5xl'],
      ['md:grid-cols-3', '@3xl:grid-cols-3'],
      ['lg:grid-cols-2', '@5xl:grid-cols-2'],
      ['xl:gap-10', '@5xl:gap-10'],
      ['2xl:py-24', '@5xl:py-24'],
    ];
    for (const [input, replacement] of cases) {
      const issue = checkClass(input);
      expect(issue?.reason, input).toBe('viewport-variant');
      // A hint that only says "don't" leaves an author — or an agent — stuck.
      expect(issue?.hint, input).toContain(replacement);
    }
  });

  it('finds the breakpoint wherever it sits among stacked variants', () => {
    // `hover:md:text-lg` and `md:hover:text-lg` are the same class. Scanning only the
    // first segment would let half of them through.
    expect(checkClass('hover:md:text-lg')?.hint).toContain('@3xl:hover:text-lg');
    expect(checkClass('md:hover:text-lg')?.hint).toContain('@3xl:hover:text-lg');
  });

  it('inverts `max-*`, which means the opposite', () => {
    // `max-sm:` is "narrower than sm". Mapping it to `@2xl:` would hide exactly the
    // content it was written to show — worse than leaving the class alone.
    expect(checkClass('max-sm:hidden')?.hint).toContain('@max-2xl:hidden');
  });

  it('leaves container variants and lookalikes alone', () => {
    // `max-w-sm` and `text-sm` carry the breakpoint NAME with no variant colon;
    // `@2xl:` is the sanctioned form. Flagging any of these would be the false
    // positive that makes the whole guard untrustworthy.
    for (const cls of ['@2xl:grid-cols-3', '@max-2xl:hidden', 'max-w-sm', 'text-sm', 'gap-6']) {
      expect(checkClass(cls), `${cls} should pass`).toBeNull();
    }
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
    for (const cls of ['gap-6', '@5xl:col-span-4', '@2xl:text-5xl', 'leading-none', 'max-w-3xl']) {
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
      'mx-auto w-full max-w-5xl px-6 py-16 @2xl:py-20 grid grid-cols-1 gap-6 @5xl:grid-cols-2'
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

describe('validateResponsiveVocabulary — the write-time refusal', () => {
  it('refuses a class string containing a viewport variant, and says what to write', () => {
    const verdict = validateResponsiveVocabulary('grid gap-6 md:grid-cols-3');
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toContain('@3xl:grid-cols-3');
  });

  it('accepts the container form and anything without a breakpoint', () => {
    for (const cls of [
      'grid gap-6 @3xl:grid-cols-3',
      'mx-auto w-full max-w-5xl px-6 py-16',
      'btn btn-primary btn-lg',
      '',
    ]) {
      expect(validateResponsiveVocabulary(cls).ok, cls).toBe(true);
    }
  });

  it('refuses ONLY the responsive rule — a broken class is not the editor’s business', () => {
    // `gap-7` emits no CSS and `checkClass` reports it, but blocking it at keystroke
    // time would make the Classes field feel broken while someone is mid-thought.
    // The two guards are deliberately not the same guard.
    expect(validateResponsiveVocabulary('gap-7 leading-[1.05]').ok).toBe(true);
  });
});

describe('the shipped catalog speaks ONE responsive vocabulary', () => {
  // The regression guard for the whole slice. Sweeping the seeds is a one-time edit;
  // this is what stops the next hand-authored composite from reintroducing the split,
  // which is exactly how it got here (the vocabulary declared both axes, so nothing
  // ever objected). Every tree a tenant is handed goes through it.
  /** A `Site` is not a node — it holds `frame.root` + `pages[].root`, and
   *  `checkTreeClasses` walks `children`. Handing it the Site object directly walks
   *  NOTHING and passes every assertion, which is how this guard would quietly stop
   *  guarding. `classCount` below is the tripwire for exactly that. */
  const rootsOf = (site: ReturnType<typeof starterSite>): unknown[] => [
    ...(site.frame ? [site.frame.root] : []),
    ...site.pages.map((p) => p.root),
  ];

  const trees: [string, unknown][] = [
    ...rootsOf(starterSite()).map((r, i): [string, unknown] => [`starterSite root ${i}`, r]),
    ...rootsOf(starterSite(undefined, { commerceEnabled: false })).map(
      (r, i): [string, unknown] => [`starterSite (no commerce) root ${i}`, r]
    ),
    ...rootsOf(starterSite(undefined, { cmsEnabled: true, schedulingEnabled: true })).map(
      (r, i): [string, unknown] => [`starterSite (cms + scheduling) root ${i}`, r]
    ),
    ['blogIndexPage', blogIndexPage()],
    ['blogPostPage', blogPostPage()],
    ['buyBox', buyBox()],
    ['productDetailPage', productDetailPage()],
    ['productGrid', productGrid()],
    ['featuredProducts', featuredProducts()],
    ['shopHeader', shopHeader()],
    ['collectionHeader', collectionHeader()],
    ['siteNavbar', siteNavbar()],
    ['siteFooter', siteFooter()],
  ];

  /** How many classed nodes a walk actually reaches. A "no offenders" result over an
   *  empty walk is indistinguishable from a clean tree, and the first version of this
   *  guard passed on all thirteen trees while inspecting zero classes. */
  const classCount = (n: unknown): number => {
    if (!n || typeof n !== 'object') return 0;
    const rec = n as { class?: unknown; children?: unknown[] };
    const here = typeof rec.class === 'string' && rec.class ? 1 : 0;
    return (rec.children ?? []).reduce<number>((sum, c) => sum + classCount(c), here);
  };

  for (const [name, tree] of trees) {
    it(`${name} carries no viewport variant`, () => {
      expect(
        classCount(tree),
        `${name}: walked no classes — this assertion proves nothing`
      ).toBeGreaterThan(0);
      const offenders = checkTreeClasses(tree)
        .filter((i) => i.reason === 'viewport-variant')
        .map((i) => i.className);
      expect(offenders).toEqual([]);
    });
  }

  it('puts `@container` on a PARENT of every element that queries one', () => {
    // The trap that made the buy box measure the wrong box for as long as it existed:
    // `@container` establishes a container for an element's DESCENDANTS, so a `@2xl:`
    // class on the SAME element silently measures some ancestor instead — or nothing.
    // Structural and invisible in review, so it is asserted rather than watched for.
    const selfQuerying: string[] = [];
    const walk = (n: unknown): void => {
      if (!n || typeof n !== 'object') return;
      const rec = n as { class?: unknown; children?: unknown[] };
      if (typeof rec.class === 'string') {
        const tokens = rec.class.split(/\s+/);
        if (tokens.includes('@container') && tokens.some((t) => /^@[\w-]+:/.test(t))) {
          selfQuerying.push(rec.class);
        }
      }
      for (const child of rec.children ?? []) walk(child);
    };
    for (const [, tree] of trees) walk(tree);
    expect(selfQuerying).toEqual([]);
  });
});
