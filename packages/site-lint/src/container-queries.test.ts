// Orphaned container queries — responsive styling that compiles and never matches.
//
// This is the third way styling can silently do nothing, and the only one a per-class
// check cannot catch: `@3xl:grid-cols-3` is valid Tailwind that emits real CSS, but it
// resolves against the nearest ancestor marked `@container`, so with no such ancestor
// the layout stays identical at every width and nothing anywhere says why.
//
// The engine ships its own `lintTree` for this. We do the walk here instead, because
// `lintTree` reports the offending node's TAG and site-lint's entire job is answering
// WHERE — an author needs the node, not "a div somewhere". The last test in this file
// is what keeps that decision honest: it runs both and asserts they agree, so if the
// engine's definition of "establishes a container" ever changes, this fails rather than
// our copy quietly drifting.

import { describe, expect, it } from 'vitest';
import { el, lintTree, type ElementNode, type Node } from '@wizeworks/silicaui-html';

import { lintSite } from './index';
import type { LintablePage, SiteLintInput } from './types';

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

function orphanFindings(root: Node, extra: Partial<SiteLintInput> = {}) {
  return lintSite({ pages: [page(root)], ...extra }).findings.filter(
    (f) => f.rule === 'class-container-orphan'
  );
}

describe('class-container-orphan', () => {
  it('reports a container variant with no @container ancestor', () => {
    const found = orphanFindings(body(el('div', 'grid grid-cols-1 @3xl:grid-cols-3')));
    expect(found).toHaveLength(1);
    expect(found[0]?.evidence).toBe('@3xl:grid-cols-3');
  });

  it('says nothing when an ancestor establishes the container', () => {
    const inside = el('section', '@container', {
      children: [el('div', 'grid grid-cols-1 @3xl:grid-cols-3')],
    });
    expect(orphanFindings(body(inside))).toHaveLength(0);
  });

  it('accepts a NAMED container', () => {
    // `@container/card` is how a card gets its own measuring context inside a section
    // that already has one — rejecting it would push authors back to viewport variants.
    const inside = el('article', '@container/card', {
      children: [el('div', '@lg:flex-row')],
    });
    expect(orphanFindings(body(inside))).toHaveLength(0);
  });

  it('counts the node itself as its own container', () => {
    expect(orphanFindings(body(el('div', '@container @xl:gap-8')))).toHaveLength(0);
  });

  it('reports every orphaned variant on one node as ONE finding', () => {
    const found = orphanFindings(body(el('div', '@md:gap-4 @xl:gap-8 p-6')));
    expect(found).toHaveLength(1);
    expect(found[0]?.evidence).toBe('@md:gap-4 @xl:gap-8');
  });

  it('does not fire on a plain class or a viewport variant', () => {
    // A viewport variant is a DIFFERENT finding (`class-preview-blind`) — this rule must
    // not double-report it, or one mistake reads as two.
    expect(orphanFindings(body(el('div', 'grid gap-6 md:grid-cols-3')))).toHaveLength(0);
  });

  it('sees through the FRAME into the page body', () => {
    // The container may be established in the chrome and used in the page — composing
    // is the whole reason this walk exists, and a per-tree check would report a false
    // positive on every page.
    // The page body renders at the frame's outlet, so it inherits the frame's container.
    const frame = {
      root: el('div', '@container', { children: [{ kind: 'outlet' }] }),
    };
    expect(orphanFindings(body(el('div', '@2xl:grid-cols-2')), { frame })).toHaveLength(0);
  });

  it('agrees with the engine&apos;s own lintTree', () => {
    // The anti-drift guard. Same tree, two implementations: ours (which can name the
    // node) and silicaui's (which defines the rule). If they ever disagree about what
    // establishes a container, this is the test that says so.
    const tree = el('section', '', {
      children: [
        el('div', '@3xl:grid-cols-3'), // orphaned
        el('div', '@container', { children: [el('p', '@lg:text-xl')] }), // fine
        el('article', '@container/card', { children: [el('p', '@sm:gap-2')] }), // fine
        el('footer', '@xl:flex-row'), // orphaned
      ],
    });

    const engine = lintTree(tree).filter((i) => i.rule === 'orphan-container-query');
    const ours = orphanFindings(body(tree));

    expect(ours).toHaveLength(engine.length);
    expect(ours).toHaveLength(2);
  });
});
