// Which findings may offer to change the author's page for them.
//
// THE WHOLE RISK OF A ONE-CLICK FIX IS IN THIS FILE. A check that describes a problem
// costs an author nothing when it is wrong; a check that EDITS costs them their page.
// So the bar for attaching a `fix` is two separate questions, and the tests below are
// organised as those two questions rather than as one "does it work":
//
//   1. Is there a single unambiguous answer? (`@wizeworks/silica-catalog`'s `replacement`.)
//   2. Would applying it here make the page WORSE? (an ancestor question, so only the
//      site walk can answer it.)
//
// The second is not hypothetical. Rewriting `md:grid-cols-3` to `@3xl:grid-cols-3`
// under a node with no `@container` above it turns a rule that works on a real device
// into one that matches nowhere — and the author would have been told it was a fix.

import { describe, expect, it } from 'vitest';
import { el, type ElementNode, type Node } from '@wizeworks/silicaui-html';

import { lintSite } from './index';
import type { LintablePage } from './types';

function page(root: Node): LintablePage {
  return {
    id: 'p1',
    name: 'Home',
    slug: '/',
    seoTitle: 'Home — Example',
    seoDescription: 'A description that is not shared with any other page.',
    root,
  };
}

function body(...children: Node[]): ElementNode {
  return el('main', '', { children: [el('h1', '', { text: 'The page' }), ...children] });
}

/** `el()` takes no id, and site-lint refuses to offer a fix on a node it cannot
 *  address — so a fixture without one silently tests the wrong thing. */
function withId(node: ElementNode, id: string): ElementNode {
  return { ...node, id };
}

function findings(root: Node) {
  return lintSite({ pages: [page(root)] }).findings;
}

/** The fix attached to the finding whose evidence is this class, if any. */
function fixFor(root: Node, className: string) {
  return findings(root).find((f) => f.evidence === className)?.fix;
}

describe('an out-of-range step offers a fix', () => {
  it('names the exact replacement, not a sentence', () => {
    // The real one, from the golden template: `gap-2.5` against a scale that has no
    // 2.5 step. It emits no CSS at all, on every page of every blueprint.
    const fix = fixFor(body(withId(el('div', 'flex gap-2.5'), 'n1')), 'gap-2.5');
    expect(fix).toEqual({
      kind: 'replace-class',
      from: 'gap-2.5',
      to: 'gap-2',
      label: 'Change gap-2.5 to gap-2',
    });
  });

  it('KEEPS the variant prefix', () => {
    // `@2xl:gap-7` is out of range only in its tail. Replacing the whole token with
    // `gap-6` would move the spacing to every width at once — a real layout change,
    // silently, while calling itself a fix.
    const fix = fixFor(body(withId(el('div', 'grid @2xl:gap-7'), 'n1')), '@2xl:gap-7');
    expect(fix?.to).toBe('@2xl:gap-6');
  });

  it('does not offer a fix on a node with no id', () => {
    // Nothing downstream could address it to make the edit.
    expect(fixFor(body(el('div', 'flex gap-2.5')), 'gap-2.5')).toBeUndefined();
  });
});

describe('a viewport variant offers a fix ONLY inside a container', () => {
  it('offers it when an ancestor establishes the container', () => {
    const inside = el('section', '@container', {
      children: [withId(el('div', 'grid md:grid-cols-3'), 'n1')],
    });
    expect(fixFor(body(inside), 'md:grid-cols-3')).toEqual({
      kind: 'replace-class',
      from: 'md:grid-cols-3',
      to: '@3xl:grid-cols-3',
      label: 'Change md:grid-cols-3 to @3xl:grid-cols-3',
    });
  });

  it('WITHHOLDS it with no container ancestor, and still reports the finding', () => {
    // The important one. The advice is still right — the detail explains the
    // `@container` requirement in words — but applying it mechanically would swap a
    // rule that works on a phone for one that works nowhere.
    const root = body(withId(el('div', 'grid md:grid-cols-3'), 'n1'));
    const found = findings(root).find((f) => f.evidence === 'md:grid-cols-3');
    expect(found, 'the finding is still reported').toBeDefined();
    expect(found?.fix, 'but no fix is offered').toBeUndefined();
    expect(found?.detail).toContain('@container');
  });
});

describe('an arbitrary value never offers a fix', () => {
  it('has no single answer, so it does not pretend to', () => {
    // `leading-[1.05]` could legitimately become any of a dozen tokens. Picking one for
    // the author would be a guess wearing the clothes of a fix.
    const root = body(withId(el('div', 'leading-[1.05]'), 'n1'));
    const found = findings(root).find((f) => f.evidence === 'leading-[1.05]');
    expect(found, 'still reported').toBeDefined();
    expect(found?.fix).toBeUndefined();
  });
});

describe('findings that are decisions, not corrections', () => {
  it('never attach a fix', () => {
    // A representative sweep: nothing OUTSIDE the class rules may offer to edit the
    // page. These are the author's judgements — which destination, which words, which
    // color — and a machine choosing for them is the failure mode this guards.
    const root = body(
      el('a', 'underline', { text: 'Read more' }), // a link with no destination
      el('img', 'w-full', { attrs: { src: '' } }), // a picture with nothing in it
      el('p', 'text-base-300', { text: 'Fine print nobody can read' })
    );
    for (const finding of findings(root)) {
      if (finding.rule.startsWith('class-')) continue;
      expect(finding.fix, `${finding.rule} must not offer a fix`).toBeUndefined();
    }
  });
});
