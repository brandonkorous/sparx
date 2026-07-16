// Small silica `Node` composites `page-legacy-to-silica.ts` needs that have no
// silica built-in component — kept local (same pattern as `silica-email-kit.ts`)
// rather than importing `@sparx/silica-catalog`'s equivalents: builder-schemas is
// the React-free, dependency-light seam both the editor and the services import,
// and depending "up" into a catalog package would invert that.

import { action, atom, behave, bind, el, repeat, type Node } from '@wizeworks/silicaui-html';

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'>" +
  "<rect width='400' height='400' fill='%23e5e7eb'/>" +
  "<circle cx='150' cy='150' r='36' fill='%23cbd5e1'/>" +
  "<path d='M70 300l86-104 62 74 58-70 74 100z' fill='%23cbd5e1'/></svg>";

/** The add-to-cart form half of a buy box — mirrors `@sparx/silica-catalog`'s
 *  `commerce.ts` composite exactly (same field refs, same action ref), so it
 *  resolves against the same storefront host with no new wiring. */
function addToCartForm(): Node {
  return action(
    behave(
      el('form', 'mt-2 flex flex-col gap-3', {
        children: [
          bind(el('input', '', { attrs: { type: 'hidden', name: 'variantId' } }), 'variantId'),
          el('label', 'flex items-center gap-3 text-base text-base-content', {
            children: [
              el('span', 'font-medium', { text: 'Quantity' }),
              el('input', 'input w-24', {
                attrs: { type: 'number', name: 'quantity', value: '1', min: '1', step: '1' },
              }),
            ],
          }),
          atom('Button', 'btn btn-primary btn-lg', { type: 'submit' }, ['Add to cart']),
        ],
      }),
      { type: 'form' }
    ),
    'add-to-cart'
  );
}

/** A legacy `BuyBox` node's silica equivalent — image, title, price (+
 *  compare-at strikethrough), description, and the add-to-cart form. Self-scoping
 *  (repeats over the `product` object source), same as the catalog's `buyBox()`. */
export function legacyBuyBoxToSilica(): Node {
  return repeat(
    el('div', 'grid gap-8 @2xl:grid-cols-2 @container', {
      children: [
        bind(
          atom('Image', 'aspect-square w-full rounded-box object-cover', {
            src: PLACEHOLDER_IMAGE,
            alt: 'Product image',
          }),
          'image'
        ),
        el('div', 'flex flex-col gap-4', {
          children: [
            bind(
              el('h1', 'text-3xl font-bold text-base-content', { text: 'Product name' }),
              'title'
            ),
            el('div', 'flex items-baseline gap-3', {
              children: [
                bind(el('span', 'text-2xl font-bold text-primary', { text: '$0.00' }), 'price'),
                bind(
                  el('span', 'text-lg text-base-content line-through', { text: '' }),
                  'compareAtPrice'
                ),
              ],
            }),
            bind(el('div', 'text-base-content', { text: 'Product description.' }), 'description'),
            addToCartForm(),
          ],
        }),
      ],
    }),
    'product'
  );
}

/** Lift a legacy `Prose` node's TipTap/CMS document into plain-text paragraphs —
 *  builder-schemas can't reach the rich HTML serializer (it lives behind a
 *  React-free entrypoint in another package), so this preserves the words rather
 *  than the rich markup. Mirrors `email-legacy-to-silica.ts`'s identical helper. */
export function proseParagraphs(doc: unknown): string[] {
  const out: string[] = [];
  const walk = (n: unknown): void => {
    if (!n || typeof n !== 'object') return;
    const node = n as { type?: string; text?: string; content?: unknown[] };
    if (node.type === 'text' && typeof node.text === 'string') out.push(node.text);
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };
  walk(doc);
  const joined = out.join(' ').trim();
  return joined ? [joined] : [];
}
