// Selling — the bands around a product, a service, or an offer.
//
// The gap these close: the commerce composites cover a product CARD, a GRID and a BUY
// BOX. Everything a shop needs around those — a category chooser, a shipping-and-
// returns strip, a stock reassurance line, a bundle, a single hero offer — was
// missing, so a shop page was a grid of products with nothing to frame it.
//
// These are DEFAULT-STATIC on purpose. A category tile that binds a live collection is
// better, but the bindable sources are per-tenant and a catalog entry cannot know a
// tenant's collection ids (the authoring rule: never bake a concrete record id into
// catalog data). So each is authored inert-but-rich with believable copy, and the
// author points it at real data through the Data panel — the same contract every
// spine-binding composite follows.

import { el, type Node } from '@wizeworks/silicaui-html';

import {
  actions,
  body,
  card,
  cardTitle,
  caption,
  chip,
  gridFour,
  gridThree,
  picture,
  primaryAction,
  secondaryAction,
  section,
  sectionAlt,
  sectionHead,
  CARD,
} from './_shell';

/** Category tiles — the "what are you looking for" chooser that belongs above a
 *  catalog grid on a shop with more than a handful of things. */
export function categoryTiles(): Node {
  const tile = (name: string, count: string): Node =>
    el(
      'a',
      'flex flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-4 hover:border-primary',
      {
        attrs: { href: '#' },
        children: [
          picture(name, 'square'),
          el('h3', 'text-lg font-semibold text-base-content', { text: name }),
          el('p', 'text-base text-base-content', { text: count }),
        ],
      }
    );
  return section([
    sectionHead('Shop by category'),
    gridFour([
      tile('Kitchens', '18 pieces'),
      tile('Wardrobes', '12 pieces'),
      tile('Doors', '24 pieces'),
      tile('Made to order', 'Anything else'),
    ]),
  ]);
}

/** A single hero offer — one product or package, given the whole band. */
export function offerHero(): Node {
  return section([
    el('div', 'grid grid-cols-1 items-center gap-10 @3xl:grid-cols-2', {
      children: [
        picture('The featured piece', 'square'),
        el('div', 'flex flex-col items-start gap-5', {
          children: [
            el('div', 'flex flex-wrap items-center gap-2', {
              children: [chip('In stock', 'success'), chip('Made here', 'info')],
            }),
            el('h2', 'text-3xl font-semibold text-base-content @3xl:text-4xl', {
              text: 'The Mill Lane table',
            }),
            el('p', 'text-lg text-base-content', {
              text: 'Solid oak, 40mm, made to your length. The one we have built more of than anything else.',
            }),
            el('p', 'text-3xl font-semibold text-base-content', { text: '$1,480' }),
            actions([primaryAction('Add to basket'), secondaryAction('Ask a question')]),
            caption('Free delivery within 50 miles. Four to six weeks from order.'),
          ],
        }),
      ],
    }),
  ]);
}

/** Shipping, returns and payment — the three things a shopper checks before buying
 *  from a business they have not bought from before. */
export function shopReassurance(): Node {
  return sectionAlt([
    gridThree([
      card(CARD, [
        cardTitle('Delivery'),
        body('Free within 50 miles, $45 beyond. We deliver ourselves and carry it in.'),
      ]),
      card(CARD, [
        cardTitle('Returns'),
        body('Thirty days on anything stock. Made-to-measure pieces we will still put right.'),
      ]),
      card(CARD, [
        cardTitle('Paying'),
        body('Card, bank transfer, or split it over three months at no extra cost.'),
      ]),
    ]),
  ]);
}

/** A bundle — several things offered together at one price. */
export function bundleOffer(): Node {
  const part = (name: string, detail: string): Node =>
    el('li', 'flex items-start gap-3 border-t border-base-300 py-4', {
      children: [
        el('span', 'text-success', { text: '✓' }),
        el('div', 'flex flex-col gap-1', {
          children: [
            el('p', 'text-base font-semibold text-base-content', { text: name }),
            el('p', 'text-base text-base-content', { text: detail }),
          ],
        }),
      ],
    });
  return section([
    sectionHead(
      'The starter set',
      'Everything for a first fit-out, at less than the parts add up to.'
    ),
    el('div', 'grid grid-cols-1 gap-10 @3xl:grid-cols-2', {
      children: [
        el('ul', 'flex flex-col', {
          children: [
            part('Worktop, 3m', 'Solid oak, oiled, cut to your length'),
            part('Four base units', 'Painted to your colour'),
            part('Handles and hinges', 'Solid brass, not plated'),
            part('Fitting', 'Two days on site, waste taken away'),
          ],
        }),
        el(
          'div',
          'flex flex-col items-start gap-4 rounded-box border border-base-300 bg-base-100 p-6',
          {
            children: [
              el('p', 'text-base text-base-content', { text: 'Bought separately: $4,120' }),
              el('p', 'text-4xl font-semibold text-base-content', { text: '$3,450' }),
              actions([primaryAction('Order the set')]),
              caption('Price held for 60 days from your quote.'),
            ],
          }
        ),
      ],
    }),
  ]);
}

/** A stock and lead-time strip — the honest answer to "when can I actually have it".
 *  Kept as its own block because it is the question that most often goes unanswered
 *  and most often loses the sale. */
export function availabilityStrip(): Node {
  const fact = (label: string, value: string): Node =>
    el('div', 'flex flex-col gap-1 rounded-box border border-base-300 bg-base-100 p-5', {
      children: [
        el('p', 'text-base text-base-content', { text: label }),
        el('p', 'text-xl font-semibold text-base-content', { text: value }),
      ],
    });
  return section([
    gridThree([
      fact('In stock now', '9 pieces'),
      fact('Made to order', '4–6 weeks'),
      fact('Next delivery day', 'Thursday'),
    ]),
  ]);
}

/** A gift-card or voucher band — a real revenue line for shops and services alike,
 *  and one nobody builds because no block existed for it. */
export function giftCards(): Node {
  return sectionAlt([
    el('div', 'grid grid-cols-1 items-center gap-10 @3xl:grid-cols-2', {
      children: [
        el('div', 'flex flex-col items-start gap-5', {
          children: [
            el('h2', 'text-3xl font-semibold text-base-content', { text: 'Gift cards' }),
            el('p', 'text-lg text-base-content', {
              text: 'Any amount, sent by email straight away or posted on a card. Valid for two years and never expires quietly.',
            }),
            actions([primaryAction('Buy a gift card')]),
          ],
        }),
        picture('A gift card', 'wide'),
      ],
    }),
  ]);
}

/** A "how much is this going to cost" band — three worked examples rather than a
 *  calculator. A real calculator needs inputs a catalog block cannot know; three
 *  honest examples answer the same question and never produce a wrong number. */
export function costExamples(): Node {
  const example = (what: string, scope: string, price: string): Node =>
    card(CARD, [
      cardTitle(what),
      body(scope),
      el('p', 'text-2xl font-semibold text-base-content', { text: price }),
    ]);
  return section([
    sectionHead(
      'What people usually spend',
      'Three real jobs from this year, with what they actually cost. Yours will differ — these are for calibration, not a quote.'
    ),
    gridThree([
      example('A small kitchen', 'Eight units, oak worktop, three weeks on site.', 'about $9,400'),
      example('One fitted wardrobe', 'Floor to ceiling, painted, two days.', 'about $2,100'),
      example('A pair of doors', 'Solid oak, made, finished and hung.', 'about $840'),
    ]),
    caption('All figures include VAT, materials, fitting and disposal.'),
  ]);
}

/** A stockists / where-to-buy list — for a maker who sells through other people as
 *  well as directly. */
export function stockists(): Node {
  const shop = (name: string, where: string): Node =>
    el('li', 'flex flex-col gap-1 border-t border-base-300 py-5', {
      children: [
        el('h3', 'text-lg font-semibold text-base-content', { text: name }),
        el('p', 'text-base text-base-content', { text: where }),
      ],
    });
  return section([
    sectionHead(
      'Where else to find us',
      'These shops carry our work. Prices are the same as ours.'
    ),
    el('ul', 'grid grid-cols-1 gap-x-10 @2xl:grid-cols-2', {
      children: [
        shop('Northgate Interiors', 'Canterbury · 01227 000000'),
        shop('The Kitchen Rooms', 'Tunbridge Wells · 01892 000000'),
        shop('Wharf Road Design', 'Maidstone · 01622 000000'),
        shop('Coast & Co', 'Whitstable · 01227 000000'),
      ],
    }),
  ]);
}
