import { describe, expect, it } from 'vitest';
import {
  atom,
  bind,
  el,
  resolveTree,
  toHtml,
  type DataScope,
  type Node,
} from '@wizeworks/silicaui-html';

import { addToCartForm, buyBox } from './commerce';
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

// ── The product hero the platform stamped lazy ──────────────────────────────────
//
// Every stored product page in the fleet carries its hero as an `Image` atom, and the
// atom hardcodes `loading="lazy"` — on the largest element above the fold of a shop's
// highest-traffic page (piggles/docs/personas/issues/345).
//
// The dangerous half of this repair is not the hero, it is everything it must NOT
// touch: the same page's card grids bind `image` with the same alt text, so a
// recognizer keyed on the binding would rewrite them all and un-do lazy loading for
// the whole catalog. It is keyed on the radius only the hero is given.
describe('the product hero', () => {
  const hero = (cls: string) =>
    bind(atom('Image', cls, { src: '/p.svg', alt: 'Product image' }), 'image');

  function imgs(root: Node): string[] {
    return [...toHtml(root).matchAll(/<img[^>]*>/g)].map((m) => m[0]);
  }

  it('becomes an eager raw img, keeping its binding and class', () => {
    const page = el('div', '', {
      children: [hero('aspect-square w-full rounded-box object-cover')],
    });
    const { root, changed } = upgradePageBody(page);
    expect(changed).toBe(true);
    const [img] = imgs(root);
    expect(img).toContain('loading="eager"');
    expect(img).toContain('aspect-square w-full rounded-box object-cover');
    expect(img).toContain('alt="Product image"');
  });

  it('leaves the CARDS on the same page alone', () => {
    // The card has the same binding and the same alt, and no radius of its own — the
    // card wrapper clips it. This is the assertion that keeps the repair honest.
    const page = el('div', '', {
      children: [
        hero('aspect-square w-full rounded-box object-cover'),
        hero('aspect-square w-full object-cover'),
        hero('aspect-square w-full object-cover'),
      ],
    });
    const rendered = imgs(upgradePageBody(page).root);
    expect(rendered.filter((i) => i.includes('loading="eager"'))).toHaveLength(1);
    expect(rendered.filter((i) => i.includes('loading="lazy"'))).toHaveLength(2);
  });

  it('leaves an unbound decorative image alone, radius or not', () => {
    // A picture an author dropped in is theirs. It has the radius and no binding.
    const page = el('div', '', {
      children: [atom('Image', 'rounded-box w-full', { src: '/x.jpg', alt: 'Our studio' })],
    });
    expect(upgradePageBody(page).changed).toBe(false);
  });

  it('reports no change on a page it does not recognise', () => {
    // `changed` drives whether the studio persists a rewrite, so a false positive here
    // would dirty every draft on load.
    const page = el('div', '', { children: [el('p', '', { text: 'hello' })] });
    expect(upgradePageBody(page).changed).toBe(false);
  });
});

// The dead form action (issue 350). What makes this repair worth testing hard is not
// the rewrite — it is that the failure it repairs is INVISIBLE. A form with a ref the
// host does not route settles to `success`, so neither the visitor nor the owner ever
// learns a message was thrown away. A heal that quietly misfires here would be the
// same shape of bug as the one it is fixing.
describe('the form that thanked people for messages it threw away', () => {
  /** A stamped form, as `convert.ts`'s `form()` helper used to emit it. */
  function stampedForm(fields: string[], ref = 'submit'): Node {
    return {
      kind: 'element',
      tag: 'form',
      class: 'flex flex-col gap-5',
      behavior: { type: 'form' },
      data: { kind: 'action', ref },
      children: [
        ...fields.map((name): Node => ({
          kind: 'element',
          tag: 'input',
          class: 'input input-bordered w-full',
          attrs: { type: 'text', name },
        })),
        { kind: 'element', tag: 'button', class: 'btn btn-primary', attrs: { type: 'submit' } },
      ],
    };
  }

  const actionOf = (root: Node): unknown => {
    const found: unknown[] = [];
    const walk = (n: Node): void => {
      if (n.kind === 'element' && n.tag === 'form') found.push(n.data);
      for (const c of (n as { children?: unknown[] }).children ?? []) {
        if (typeof c !== 'string') walk(c as Node);
      }
    };
    walk(root);
    return found[0];
  };

  it('routes an enquiry form to the submissions inbox', () => {
    const { root, changed } = upgradePageBody(stampedForm(['name', 'email', 'phone', 'message']));
    expect(changed).toBe(true);
    expect(actionOf(root)).toEqual({ kind: 'action', ref: 'contact' });
  });

  it('routes a lone email field to the email list instead', () => {
    // The whole reason the repair reads the FIELDS rather than rewriting every form to
    // `contact`: a sign-up filed as an enquiry never joins the list it was for.
    const { root } = upgradePageBody(stampedForm(['email']));
    expect(actionOf(root)).toEqual({ kind: 'action', ref: 'email-signup' });
  });

  it('treats a two-field callback as a message, not a sign-up', () => {
    const { root } = upgradePageBody(stampedForm(['name', 'phone']));
    expect(actionOf(root)).toEqual({ kind: 'action', ref: 'contact' });
  });

  it('leaves a form that already reaches a handler completely alone', () => {
    const before = stampedForm(['name', 'email'], 'contact');
    const { root, changed } = upgradePageBody(before);
    expect(changed).toBe(false);
    expect(root).toBe(before);
  });

  it('does not touch add-to-cart, which is a live form on a different ref', () => {
    // The buy box is a `<form>` with the `form` behavior too. A recognizer keyed on the
    // behavior alone would rewrite every product page's Add to cart button into a
    // contact form — which is why the dead REF is part of the match.
    const buyBox = stampedForm(['variantId', 'quantity'], 'add-to-cart');
    const { root, changed } = upgradePageBody(buyBox);
    expect(changed).toBe(false);
    expect(root).toBe(buyBox);
  });

  it('ignores a plain form that was never wired to a host at all', () => {
    // No behavior marker: markup an author pasted in, not something we stamped. Not
    // ours to route.
    const bare: Node = {
      kind: 'element',
      tag: 'form',
      data: { kind: 'action', ref: 'submit' },
      children: [],
    };
    expect(upgradePageBody(bare).changed).toBe(false);
  });

  it('gives a healed form a visible way to say it worked', () => {
    const { root } = upgradePageBody(stampedForm(['name', 'email', 'phone', 'message']));
    const form = root as Extract<Node, { kind: 'element' }>;
    expect(form.attrs?.['data-success-message']).toMatch(/Thank you/);
    const status = (form.children ?? []).find(
      (c) =>
        typeof c !== 'string' && c.kind === 'element' && c.attrs?.['data-sui-part'] === 'status'
    ) as Extract<Node, { kind: 'element' }> | undefined;
    expect(status, 'no status part was added').toBeDefined();
    // Hidden until the behavior writes into it, so a repaired page looks identical
    // until somebody actually submits.
    expect(status!.class).toContain('empty:hidden');
    expect(status!.class).toContain('text-base');
  });

  it('does not add a second status part, or overwrite an authored message', () => {
    // The behavior takes the FIRST status part it finds, so a duplicate is dead markup
    // — and a sentence the owner wrote is theirs, not ours to replace.
    const base = stampedForm(['name', 'email']) as Extract<Node, { kind: 'element' }>;
    const authored: Node = {
      ...base,
      attrs: { 'data-success-message': 'Got it. Speak soon, Devi.' },
      children: [
        ...(base.children ?? []),
        {
          kind: 'element',
          tag: 'p',
          class: 'text-lg text-success',
          attrs: { 'data-sui-part': 'status' },
        },
      ],
    };
    const { root } = upgradePageBody(authored);
    const form = root as Extract<Node, { kind: 'element' }>;
    expect(form.attrs?.['data-success-message']).toBe('Got it. Speak soon, Devi.');
    const parts = (form.children ?? []).filter(
      (c) =>
        typeof c !== 'string' && c.kind === 'element' && c.attrs?.['data-sui-part'] === 'status'
    );
    expect(parts).toHaveLength(1);
  });

  it('finds the form wherever it is buried in the page', () => {
    const page: Node = {
      kind: 'element',
      tag: 'section',
      children: [
        { kind: 'element', tag: 'h2', children: ['Tell us what you need'] },
        {
          kind: 'element',
          tag: 'div',
          children: [stampedForm(['name', 'email', 'phone', 'message'])],
        },
      ],
    };
    const { root, changed } = upgradePageBody(page);
    expect(changed).toBe(true);
    expect(actionOf(root)).toEqual({ kind: 'action', ref: 'contact' });
  });
});

describe('the buy box that could not say why you cannot buy it', () => {
  /** A product column stamped before the supply refs existed: a title, a price, and an
   *  Add-to-cart form with nothing gating it and nothing beside it. This is the shape
   *  ten of the thirteen live product pages in the fleet are actually in. */
  const staleBuyBox = (): Node =>
    el('div', 'flex flex-col gap-4', {
      children: [
        bind(
          el('h1', 'text-3xl font-semibold text-base-content', { text: 'Product name' }),
          'title'
        ),
        bind(el('p', 'text-2xl text-base-content', { text: '$0.00' }), 'price'),
        addToCartForm(),
      ],
    });

  const json = (tree: Node) => JSON.stringify(tree);

  /** The real page shape: a two-column grid, photo on the left, buy box on the right.
   *  This is what every stamped product page in the fleet actually looks like. */
  const stalePage = (): Node =>
    el('section', 'bg-base-100 @container px-6 py-12', {
      children: [
        el('div', 'mx-auto grid w-full max-w-6xl gap-10 @3xl:grid-cols-2', {
          children: [
            el('img', 'w-full rounded-box', { attrs: { src: '/x.jpg', alt: '' } }),
            staleBuyBox(),
          ],
        }),
      ],
    });

  it('puts the panels in the buy box, not in the page grid', () => {
    // The bug this test exists for, found by opening the page in the studio and
    // clicking the giant amber rectangle on it. The repair matched the two-column GRID
    // first — the grid's child is the buy-box column, whose children include the form —
    // so the preorder panel became a grid CELL beside the photo, 544 by 719 pixels of
    // solid amber.
    //
    // Nothing caught it. Every ref was present and correctly gated, so the JSON search
    // in the test above passed, and so did the whole fleet probe. PRESENCE IS NOT
    // PLACEMENT. [[feedback_a_test_that_cannot_go_red]]
    const { root } = upgradePageBody(stalePage());
    const grid = (root as Extract<Node, { kind: 'element' }>).children?.[0] as Extract<
      Node,
      { kind: 'element' }
    >;

    expect(grid.class, 'the grid moved').toContain('grid-cols-2');
    expect(grid.children, 'the repair added a cell to the page grid').toHaveLength(2);
    // …and the panel really is in the column, so this is not passing by doing nothing.
    expect(json(grid.children?.[1] as Node)).toContain('"preorder.shown"');
  });

  it('teaches a stamped buy box all four things it could not say', () => {
    const { root, changed } = upgradePageBody(staleBuyBox());

    expect(changed).toBe(true);
    expect(json(root), 'sold out').toContain('"soldOut"');
    expect(json(root), 'made to order').toContain('"madeToOrder.shown"');
    expect(json(root), 'preorder').toContain('"preorder.shown"');
    expect(json(root), 'back in stock').toContain('"backInStock"');
  });

  it('stops the form rendering on a product there is none of', () => {
    // The half that makes it a money bug rather than a missing sentence. A notice
    // saying "sold out" beside a live Add-to-cart button is worse than neither.
    //
    // Asserted STRUCTURALLY, on the slot's own binding, because the obvious version
    // cannot go red: `addToCartForm` already gates each version choice on `soldOut`,
    // so a substring check for the ref passes on the broken tree too. The question is
    // which NODE carries it. [[feedback_a_test_that_cannot_go_red]]
    const { root } = upgradePageBody(staleBuyBox());
    const children = (root as Extract<Node, { kind: 'element' }>).children ?? [];
    const slot = children.find(
      (child) => typeof child !== 'string' && json(child).includes('"add-to-cart"')
    );

    expect(slot, 'the form went missing entirely').toBeDefined();
    expect((slot as Extract<Node, { kind: 'element' }>).data).toEqual({
      kind: 'visible',
      ref: 'soldOut',
      negate: true,
    });
  });

  it('leaves the current factory buy box completely alone', () => {
    // The test that says the repair knows what "already correct" looks like. If this
    // ever reddens, the repair has started re-stamping pages that are up to date.
    const { changed } = upgradePageBody(buyBox());
    expect(changed).toBe(false);
  });

  it('heals once and then stops', () => {
    const once = upgradePageBody(staleBuyBox());
    const twice = upgradePageBody(once.root);
    expect(twice.changed, 'the repair matched its own output').toBe(false);
    expect(json(twice.root)).toBe(json(once.root));
  });

  it('puts not one extra word on a product that is simply in stock', () => {
    // Why this repair is safe to run on somebody's page without asking. Every node it
    // adds is gated on data an ordinary product does not carry, and the engine drops a
    // node whose ref resolves to nothing.
    //
    // The first version of this asserted the two renders were byte-identical, and that
    // was simply false: the gate needs a wrapper to hang on. Measuring the difference
    // rather than asserting it away is what produced the three checks below.
    // [[feedback_a_test_that_cannot_go_red]]
    const host = {
      resolveCollection: () => undefined,
      resolveBinding: (ref: string, _scope: DataScope) => {
        if (ref === 'title') return { value: 'Harbour Rope Lamp' };
        if (ref === 'price') return { value: '$148.00' };
        return { value: '' };
      },
    };
    const render = (tree: Node) => toHtml(resolveTree(tree, host));
    /** Everything a person can actually read, with the markup taken away. */
    const words = (html: string) =>
      html
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const stale = render(staleBuyBox());
    const healed = render(upgradePageBody(staleBuyBox()).root);

    expect(healed, 'the product stopped selling').toContain('Add to cart');
    expect(words(healed), 'the repair put words on an ordinary product').toBe(words(stale));

    // The word check alone is not enough, and measuring showed why: the preorder and
    // made-to-order panels carry NO literal text, so an ungated one renders as an empty
    // bordered box and adds not a single word. Their fills are the only evidence.
    expect(healed, 'an empty preorder panel rendered').not.toContain('bg-warning');
    expect(healed, 'an empty notice panel rendered').not.toContain('bg-base-200');

    // What DOES differ, said out loud so nobody reads the above as "nothing changed":
    // the form gains a `flex flex-col` wrapper to hang the sold-out gate on, because a
    // node carries one binding and the form's is its action. 33 bytes, no visual effect.
    expect(healed.length - stale.length).toBe('<div class="flex flex-col"></div>'.length);
  });

  it('does not touch a form that is not an add-to-cart', () => {
    const contact = el('div', 'flex flex-col gap-4', {
      children: [
        el('h2', 'text-2xl', { text: 'Write to us' }),
        el('form', 'flex flex-col gap-3', {
          children: [el('input', 'input', { attrs: { type: 'email', name: 'email' } })],
        }),
      ],
    });
    const before = json(contact);
    const { root, changed } = upgradePageBody(contact);
    expect(changed).toBe(false);
    expect(json(root)).toBe(before);
  });
});
