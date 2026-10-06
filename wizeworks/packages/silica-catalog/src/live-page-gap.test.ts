import { describe, expect, it } from 'vitest';
import { bind, el } from '@wizeworks/silicaui-html';
import type { Node } from '@wizeworks/silicaui-html';

import { addToCartForm, buyBox } from './commerce';
import { livePageGaps } from './live-page-gap';
import { upgradePageBody } from './upgrade-page';

/** A product page stamped before the supply refs existed. Ten of the thirteen live
 *  product pages in the dev fleet are in exactly this shape. */
const stalePage = (): Node =>
  el('section', 'bg-base-100 @container px-6 py-12', {
    children: [
      el('div', 'mx-auto grid w-full max-w-6xl gap-10 @3xl:grid-cols-2', {
        children: [
          el('img', 'w-full rounded-box', { attrs: { src: '/x.jpg', alt: '' } }),
          el('div', 'flex flex-col gap-4', {
            children: [
              bind(el('h1', 'text-3xl', { text: 'Product name' }), 'title'),
              addToCartForm(),
            ],
          }),
        ],
      }),
    ],
  });

/** The same page after its owner has opened it once. */
const healedPage = (): Node => upgradePageBody(stalePage()).root;

const refs = (gaps: { ref: string }[]) => gaps.map((g) => g.ref).sort();

/** What a page with no sold-out notice at all reports. `backInStock` is NOT among
 *  them: the missing notice brings the date line with it, and naming one repair twice
 *  would have an owner reading two bullets for one press of Publish. */
const STALE_GAPS = ['coreDeposit.shown', 'madeToOrder.shown', 'preorder.shown', 'soldOut'];

describe('what a live page cannot say', () => {
  it('says nothing about a page that has never been published', () => {
    // "Your website has never been published" is the sentence that matters there, and
    // four gap lines beside it would bury it.
    expect(livePageGaps([{ draft: stalePage(), published: null }])).toEqual([]);
  });

  it('says nothing when the live page already has everything', () => {
    const live = healedPage();
    expect(livePageGaps([{ draft: live, published: live }])).toEqual([]);
  });

  it('says nothing about a page with no buy box', () => {
    // A contact page gains nothing from the repair, so it reports nothing without
    // having to be recognised as a contact page.
    const contact = el('div', 'flex flex-col gap-4', {
      children: [el('h2', '', { text: 'Write to us' }), el('form', '', {})],
    });
    expect(livePageGaps([{ draft: contact, published: contact }])).toEqual([]);
  });

  it('reports what a stamped page cannot say', () => {
    const stale = stalePage();
    expect(refs(livePageGaps([{ draft: stale, published: stale }]))).toEqual(STALE_GAPS);
  });

  it('reports SOLD OUT on a page that already mentions the ref inside its form', () => {
    // The bug this file was rewritten for. `addToCartForm` gates each version choice on
    // `soldOut` so a sold-out size greys itself out, so the ref is in every stale tree
    // already. A version of this that compared sets of refs reported that all ten live
    // shops could say "sold out" when not one of them could, and the repair skipped the
    // notice for the same reason. Presence is not placement.
    const stale = stalePage();
    expect(JSON.stringify(stale), 'fixture no longer contains the ref').toContain('"soldOut"');
    expect(refs(livePageGaps([{ draft: stale, published: stale }]))).toContain('soldOut');
  });

  it('reports the date line ALONE when the notice is there and the line is not', () => {
    // The other cohort: a page stamped after the sold-out notice shipped and before the
    // back-in-stock line did. It must not be told to fix a notice it already has.
    const healed = healedPage();
    const older = JSON.parse(
      JSON.stringify(healed).replaceAll('"backInStock"', '"somethingElse"')
    ) as Node;
    expect(refs(livePageGaps([{ draft: older, published: older }]))).toEqual(['backInStock']);
  });

  it('calls it WAITING when the owner has never opened the page', () => {
    // The common case and the invisible one. Her draft is exactly as stale as her live
    // page, so draft-versus-published finds nothing — they agree, and both are old.
    // Publishing this would send the same page back out unchanged.
    const stale = stalePage();
    for (const gap of livePageGaps([{ draft: stale, published: stale }])) {
      expect(gap.source, gap.ref).toBe('waiting');
    }
  });

  it('calls it SAVED once she has opened the page and only a publish is missing', () => {
    for (const gap of livePageGaps([{ draft: healedPage(), published: stalePage() }])) {
      expect(gap.source, gap.ref).toBe('saved');
    }
  });

  it('stays WAITING when one page of several has never been opened', () => {
    // Conservative on purpose. Telling an owner to publish something a publish cannot
    // fix is the failure this field exists to prevent, and it is worse than telling
    // her to open a page she has already opened.
    const gaps = livePageGaps([
      { draft: healedPage(), published: stalePage() },
      { draft: stalePage(), published: stalePage() },
    ]);
    for (const gap of gaps) expect(gap.source, gap.ref).toBe('waiting');
  });

  it('counts the pages, so a surface need not imply the whole shop', () => {
    const stale = stalePage();
    const gaps = livePageGaps([
      { draft: stale, published: stale },
      { draft: stale, published: stale },
    ]);
    for (const gap of gaps) expect(gap.pages, gap.ref).toBe(2);
  });

  it('gives every gap a sentence about the visitor, not about the tree', () => {
    for (const gap of livePageGaps([{ draft: stalePage(), published: stalePage() }])) {
      expect(gap.says, gap.ref).toMatch(/your page/i);
      expect(gap.says, gap.ref).not.toMatch(/ref|node|bind|tree|silica/i);
    }
  });

  it('reports a buy box that cannot take an old part first (issue 057)', () => {
    // A page stamped after the supply notices and before the choice: everything else
    // is in place, so this is the one thing it is missing. The choice lives INSIDE the
    // form, which is why it needs asking about separately from the panels beside it.
    const strip = (node: Node): Node => {
      if (node.kind === 'outlet') return node;
      const kids = (node as Extract<Node, { kind: 'element' }>).children;
      if (!Array.isArray(kids)) return node;
      return {
        ...node,
        children: kids
          .filter(
            (k) =>
              typeof k === 'string' ||
              k.kind === 'outlet' ||
              !(k.data?.kind === 'visible' && k.data.ref === 'coreChoice.shown')
          )
          .map((k) => (typeof k === 'string' ? k : strip(k))),
      };
    };
    const older = strip(buyBox());
    expect(refs(livePageGaps([{ draft: older, published: older }]))).toEqual(['coreChoice.shown']);
    // …and the repair is what clears it, so the report and the fix say the same thing.
    const healed = upgradePageBody(older).root;
    expect(livePageGaps([{ draft: healed, published: healed }])).toEqual([]);
  });

  it('reports a buy box that cannot offer a repeat order (issue 739)', () => {
    const strip = (node: Node): Node => {
      if (node.kind === 'outlet') return node;
      const kids = (node as Extract<Node, { kind: 'element' }>).children;
      if (!Array.isArray(kids)) return node;
      return {
        ...node,
        children: kids
          .filter(
            (k) =>
              typeof k === 'string' ||
              k.kind === 'outlet' ||
              !(k.data?.kind === 'visible' && k.data.ref === 'repeat.shown')
          )
          .map((k) => (typeof k === 'string' ? k : strip(k))),
      };
    };
    const older = strip(buyBox());
    expect(refs(livePageGaps([{ draft: older, published: older }]))).toEqual(['repeat.shown']);
    const healed = upgradePageBody(older).root;
    expect(livePageGaps([{ draft: healed, published: healed }])).toEqual([]);
  });

  it('reports nothing for the page the factory builds today', () => {
    // The test that says this stops nagging once the platform has caught up. If it
    // ever reddens, a new site is being born behind.
    const fresh = buyBox();
    expect(livePageGaps([{ draft: fresh, published: fresh }])).toEqual([]);
  });
});
