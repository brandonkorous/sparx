// A PRODUCT PANEL'S TAB MUST CARRY THE BRAND'S NAME FOR THE SCREEN.
//
// Nine panes hang off one product — Stock, Fitment, Dropshipping, Configurator,
// Trade pricing and the rest. Each one hand-wrote a `const LABEL` and handed it
// to `useProductScope`, which built the tab from it: `Fitment · Marlow Knit`.
//
// The catalog is the one place a brand renames a screen, and every one of those
// nine had an entry there. None of them reached the tab. So a shop owner who
// found the screen by searching "what it fits" got a tab that said "Fitment",
// and the rail, the launcher and the command palette beside it went on saying
// "What it fits" — one screen, two names, depending which way in you took.
// Issue 738.
//
// The fix is that the title comes from `surfaceTitle`, and the per-file const is
// now only a lowercase NOUN for the middle of a sentence ("This panel shows
// stock for one product at a time"). This scans the source, because the defect
// is which STRING a component was handed and no render can tell a wrong name
// from a right one. It asserts its own denominator, so a rewrite that moves the
// panes cannot leave it scanning nothing.
//
// [[feedback_a_fix_leaves_its_neighbour_behind]]
// [[feedback_structural_checks_go_blind]]

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCOPE = resolve(HERE, 'product-scope.tsx');

/** How many panes hang off a product. A pane added or removed changes this on
 *  purpose — the number is the point, not an obstacle. */
const PANEL_COUNT = 9;

interface Panel {
  file: string;
  noun: string;
}

/** Every surface that scopes itself to one product, with the noun it passes. */
function panels(): Panel[] {
  const found: Panel[] = [];
  for (const file of readdirSync(HERE)) {
    if (!file.startsWith('product-') || !file.endsWith('.tsx')) continue;
    // The hook's own home, not a panel. Named rather than pattern-skipped so a
    // second exclusion has to be written down and argued for.
    if (file === 'product-scope.tsx') continue;
    const source = readFileSync(join(HERE, file), 'utf8');
    if (!source.includes('useProductScope(')) continue;
    const noun = /useProductScope\(ctx,\s*\{\s*noun:\s*([A-Za-z_][\w.]*|'[^']*')/.exec(source);
    if (!noun) {
      throw new Error(
        `${file} calls useProductScope and this test cannot read the noun it passes. ` +
          `Teach the test the new shape rather than letting it skip the file.`
      );
    }
    const literal = noun[1]?.startsWith("'")
      ? noun[1].slice(1, -1)
      : readConst(source, noun[1] ?? '', file);
    found.push({ file, noun: literal });
  }
  return found;
}

function readConst(source: string, name: string, file: string): string {
  const match = new RegExp(`const ${name} = '([^']*)'`).exec(source);
  if (!match?.[1]) {
    throw new Error(
      `${file} passes ${name} to useProductScope and does not declare it as a literal.`
    );
  }
  return match[1];
}

describe('every product panel', () => {
  const found = panels();

  it('is all here — the test says its own denominator', () => {
    expect(found).toHaveLength(PANEL_COUNT);
  });

  it.each(found.map((p) => [p.file, p.noun] as const))(
    '%s passes a lowercase noun, not a screen name (%s)',
    (file, noun) => {
      expect(noun.length, `${file} passes an empty noun`).toBeGreaterThan(0);
      // A screen NAME starts with a capital. A noun in the middle of a sentence
      // does not, and passing one here is how the platform's word got back onto
      // a tab the brand had already renamed.
      expect(noun[0], `${file} passes "${noun}", which reads as a screen name`).toBe(
        noun[0]?.toLowerCase()
      );
    }
  );

  it.each(found.map((p) => [p.file] as const))('%s never sets its own tab title', (file) => {
    const source = readFileSync(join(HERE, file), 'utf8');
    // `useProductScope` owns the title for these panes. A pane calling
    // `setTitle` itself is back outside the brand's reach.
    expect(source.includes('ctx.setTitle('), `${file} sets its own tab title`).toBe(false);
  });
});

describe('the scope hook', () => {
  const source = readFileSync(SCOPE, 'utf8');

  it('builds the tab title from the catalog, not from the noun it was handed', () => {
    // The exact assignment, not merely the presence of `surfaceTitle` somewhere
    // in the file. Asserting the loose version passed with the title wired
    // straight back to the noun, because the fallback below calls `surfaceTitle`
    // too — a guard that cannot go red. [[feedback_a_test_that_cannot_go_red]]
    expect(source).toContain(
      'const screen = surfaceTitle(ctx.descriptor.surface) ?? options.noun;'
    );
    expect(source).toContain('ctx.setTitle(product ? `${screen} · ${product.title}` : screen)');
  });

  it('never titles a tab with the noun', () => {
    expect(source).not.toContain('${options.noun} · ');
  });
});
