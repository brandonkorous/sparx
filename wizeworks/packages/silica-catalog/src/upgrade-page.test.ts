import { describe, expect, it } from 'vitest';
import { atom, el } from '@wizeworks/silicaui-html';

import { checkClassString } from './vocabulary-check';
import { repairDeadClasses, upgradePageBody } from './upgrade-page';

describe('repairDeadClasses', () => {
  it('replaces the dead token and leaves every other one alone, in order', () => {
    expect(repairDeadClasses('flex flex-col gap-1.5 p-4')).toBe('flex flex-col gap-2 p-4');
  });

  it('reports "nothing to do" as null, so a clean tree keeps its identity', () => {
    expect(repairDeadClasses('flex flex-col gap-2 p-4')).toBeNull();
    expect(repairDeadClasses('')).toBeNull();
  });

  it('heals a PREFIXED dead class — the variant is not what is broken, the step is', () => {
    expect(repairDeadClasses('@2xl:gap-1.5')).toBe('@2xl:gap-2');
    expect(repairDeadClasses('@2xl:hover:gap-1.5')).toBe('@2xl:hover:gap-2');
  });

  it('leaves arbitrary values alone — there is no known-correct replacement to make', () => {
    expect(repairDeadClasses('w-[347px] gap-1.5')).toBe('w-[347px] gap-2');
  });

  it('produces a class string the vocabulary actually accepts', () => {
    const healed = repairDeadClasses('flex flex-col gap-1.5 p-4')!;
    expect(checkClassString(healed)).toEqual([]);
    // …and the input genuinely was broken, so the test is not vacuous.
    expect(checkClassString('flex flex-col gap-1.5 p-4')).not.toEqual([]);
  });
});

describe('upgradePageBody', () => {
  /** The exact shape found on a real tenant's stored Home page. */
  const staleCard = () =>
    el('a', 'card bg-base-100', {
      children: [
        el('div', 'flex flex-col gap-1.5 p-4', {
          children: [el('h3', 'font-semibold', { text: 'Product name' })],
        }),
      ],
    });

  it('heals a dead class nested anywhere in the body', () => {
    const { root, changed } = upgradePageBody(
      el('section', '', { children: [el('div', '', { children: [staleCard()] })] })
    );
    expect(changed).toBe(true);
    expect(JSON.stringify(root)).toContain('gap-2');
    expect(JSON.stringify(root)).not.toContain('gap-1.5');
  });

  it('heals COMPONENT nodes too, not only elements', () => {
    const { root, changed } = upgradePageBody(
      el('div', '', { children: [atom('Image', 'gap-1.5 w-full', { alt: 'x' })] })
    );
    expect(changed).toBe(true);
    expect(JSON.stringify(root)).toContain('gap-2');
  });

  it('is a no-op on a clean tree — same object back, changed false', () => {
    const clean = el('div', 'flex gap-2', { children: [el('p', 'p-4', { text: 'hi' })] });
    const { root, changed } = upgradePageBody(clean);
    expect(changed).toBe(false);
    expect(root).toBe(clean);
  });

  it('is idempotent — healing twice is healing once', () => {
    const once = upgradePageBody(staleCard());
    const twice = upgradePageBody(once.root);
    expect(twice.changed).toBe(false);
    expect(twice.root).toEqual(once.root);
  });

  it('preserves everything else about the node it repairs', () => {
    const node = el('div', 'gap-1.5', { attrs: { id: 'keep' }, children: ['text'] });
    node.data = { kind: 'value', ref: 'title' };
    const { root } = upgradePageBody(node);
    expect(root).toMatchObject({
      tag: 'div',
      class: 'gap-2',
      attrs: { id: 'keep' },
      children: ['text'],
      data: { kind: 'value', ref: 'title' },
    });
  });

  it('leaves a subtree with nothing to repair as the SAME object', () => {
    const untouched = el('footer', 'p-4', { children: [el('p', '', { text: 'c' })] });
    const { root } = upgradePageBody(el('div', '', { children: [staleCard(), untouched] }));
    const kids = (root as { children: unknown[] }).children;
    expect(kids[1]).toBe(untouched);
  });
});

// The featured strip a tenant is living with (issue 195). Every blueprint stamped this
// shape, and a stamped tree never re-reads the catalog: a shop that installed one has a
// cross-sell showing ONE full-width card under the product it is cross-selling.
describe('the featured strip that could only ever show one product', () => {
  /** What `featuredCarousel()` used to stamp, verbatim. */
  function staleStrip() {
    const card = el(
      'a',
      'card bg-base-100 border border-base-300 rounded-box overflow-hidden block hover:border-primary carousel-item basis-full @2xl:basis-1/3 @4xl:basis-1/4',
      { children: [el('h3', '', { text: 'Product name' })] }
    );
    const track = el('div', 'carousel gap-6', { children: [card] });
    track.part = 'track';
    track.data = { kind: 'collection', ref: 'commerce.featured' };
    const prev = el('button', 'btn btn-circle btn-sm btn-neutral btn-outline', {});
    prev.part = 'prev';
    const next = el('button', 'btn btn-circle btn-sm btn-neutral btn-outline', {});
    next.part = 'next';
    const section = el('section', 'bg-base-100 @container px-6 py-12', {
      children: [el('div', 'mb-8 flex', { children: [prev, next] }), track],
    });
    section.behavior = { type: 'carousel' };
    return section;
  }

  it('swaps the behavior for the one that shows every item at once', () => {
    const { root, changed } = upgradePageBody(staleStrip());
    expect(changed).toBe(true);
    expect((root as { behavior?: { type: string } }).behavior?.type).toBe('scroll-strip');
  });

  it('gives the cards a real width and drops the ladder that never applied', () => {
    const json = JSON.stringify(upgradePageBody(staleStrip()).root);
    expect(json).toContain('w-64 shrink-0');
    expect(json).not.toContain('carousel-item');
    expect(json).not.toContain('basis-full');
    expect(json).not.toContain('@4xl:basis-1/4');
  });

  it('keeps the repeat on the row and moves the track marker to its wrapper', () => {
    const root = upgradePageBody(staleStrip()).root as {
      children: {
        class?: string;
        part?: string;
        children?: {
          class?: string;
          part?: string;
          children?: { class?: string; data?: unknown; part?: string }[];
        }[];
      }[];
    };
    const strip = root.children[1];
    const track = strip?.children?.[0];
    const row = track?.children?.[0];
    expect(strip?.class).toBe('scroll-strip');
    expect(track?.class).toBe('scroll-strip-track');
    expect(track?.part).toBe('track');
    // The collection binding must ride the element whose CHILDREN repeat, or the strip
    // renders one card whatever the shop has — and the row must NOT also be the track.
    expect(row?.class).toBe('flex w-max gap-6 mx-auto');
    expect(row?.data).toEqual({ kind: 'collection', ref: 'commerce.featured' });
    expect(row?.part).toBeUndefined();
  });

  it('lets the component own when the controls appear, colourlessly', () => {
    const json = JSON.stringify(upgradePageBody(staleStrip()).root);
    expect((json.match(/scroll-strip-control/g) ?? []).length).toBe(2);
    // The stamped controls wore `btn-neutral btn-outline` — a grey nobody approved.
    expect(json).not.toContain('btn-neutral');
    expect(json).not.toContain('btn-outline');
  });

  it("leaves an AUTHOR's carousel alone — one slide at a time is what it is for", () => {
    const hero = el('section', '', {
      children: [el('div', 'carousel', { children: [el('img', 'w-full', {})] })],
    });
    hero.behavior = { type: 'carousel' };
    const { root, changed } = upgradePageBody(hero);
    expect(changed).toBe(false);
    expect(root).toBe(hero);
  });
});
