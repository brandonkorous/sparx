// Helping someone choose — comparison tables, checklists, and the honest trade-off.
//
// The gap these close: every business that offers more than one of anything has to
// answer "which one do I want", and the only shelf item that came close was a pricing
// table with three fixed tiers. A service business comparing two packages, a
// manufacturer comparing two materials, and a shop comparing this year's model with
// last year's all needed the same block and none of them had it.
//
// A comparison is a TABLE, and it is authored as one — `<table>` with a real `<thead>`
// and row headers. Not because tables are fashionable, but because a screen reader
// announcing "Warranty, Standard: two years" is the entire point of the block, and a
// grid of divs announces six unrelated words.

import { el, type Node } from '@wizeworks/silicaui-html';

import {
  actions,
  body,
  card,
  cardTitle,
  gridThree,
  gridTwo,
  primaryAction,
  secondaryAction,
  section,
  sectionAlt,
  sectionHead,
  CARD,
} from './_shell';

/** A ✓ or ✕ cell. The glyph carries a text label for anyone not looking at it —
 *  a bare tick read aloud as "check" tells a listener nothing about which column. */
function mark(has: boolean, what: string): Node {
  return el('td', 'border-t border-base-300 px-4 py-4 text-base text-base-content', {
    children: [
      el('span', has ? 'text-success' : 'text-base-content', { text: has ? '✓' : '—' }),
      el('span', 'sr-only', { text: has ? `Included: ${what}` : `Not included: ${what}` }),
    ],
  });
}

/** A comparison of two or three options across the same set of rows. */
export function comparisonTable(): Node {
  const row = (label: string, a: boolean, b: boolean, c: boolean): Node =>
    el('tr', '', {
      children: [
        el(
          'th',
          'border-t border-base-300 px-4 py-4 text-left text-base font-medium text-base-content',
          {
            text: label,
          }
        ),
        mark(a, label),
        mark(b, label),
        mark(c, label),
      ],
    });
  const head = (text: string): Node =>
    el('th', 'px-4 pb-4 text-left text-base font-semibold text-base-content', { text });

  return section([
    sectionHead(
      'Which one is right for you?',
      'The same list of questions, answered for each option.'
    ),
    el('div', 'w-full overflow-x-auto', {
      children: [
        el('table', 'w-full min-w-2xl border-collapse', {
          children: [
            el('thead', '', {
              children: [
                el('tr', '', {
                  children: [head(''), head('Essentials'), head('Standard'), head('Complete')],
                }),
              ],
            }),
            el('tbody', '', {
              children: [
                row('Free consultation', true, true, true),
                row('Site visit before quoting', false, true, true),
                row('Written specification', false, true, true),
                row('Project manager assigned', false, false, true),
                row('Extended warranty', false, false, true),
                row('Aftercare visit at six months', false, false, true),
              ],
            }),
          ],
        }),
      ],
    }),
  ]);
}

/** Two options head to head, each with its own list and its own action — the shape a
 *  visitor actually reads when there are only two. */
export function twoUpCompare(): Node {
  const option = (title: string, price: string, lines: string[], cta: Node): Node =>
    card(CARD, [
      cardTitle(title),
      el('p', 'text-3xl font-semibold text-base-content', { text: price }),
      el('ul', 'flex flex-col gap-2', {
        children: lines.map((line) =>
          el('li', 'text-base text-base-content', { text: `✓  ${line}` })
        ),
      }),
      actions([cta]),
    ]);

  return sectionAlt([
    sectionHead('Two ways to work with us'),
    gridTwo([
      option(
        'By the hour',
        '£65 / hour',
        ['No minimum booking', 'Pay only for time on site', 'Materials billed at cost'],
        secondaryAction('Book an hour')
      ),
      option(
        'Fixed price',
        'Quoted per job',
        ['Price agreed before we start', 'No surprises on the invoice', 'Includes materials'],
        primaryAction('Get a quote')
      ),
    ]),
  ]);
}

/**
 * The honest trade-off — what each option is good at AND what it is not.
 *
 * Worth having on the shelf because most comparison blocks only let a business say
 * good things, which reads as marketing and converts like it. A block with a "less
 * good for" row gives an owner permission to be straight, and being straight is the
 * thing that actually sells to a wary buyer.
 */
export function tradeOffs(): Node {
  const column = (title: string, best: string, worst: string): Node =>
    card(CARD, [
      cardTitle(title),
      el('p', 'text-base font-semibold text-base-content', { text: 'Best for' }),
      body(best),
      el('p', 'text-base font-semibold text-base-content', { text: 'Less good for' }),
      body(worst),
    ]);
  return section([
    sectionHead('Being straight about it', 'Each of these suits a different job. Here is which.'),
    gridThree([
      column(
        'Softwood',
        'Anything painted, and anywhere the budget matters more than the grain.',
        'A worktop, or anything that takes daily knocks.'
      ),
      column(
        'Oak',
        'Pieces meant to be seen and kept, and anything that has to take wear.',
        'A tight budget, or a room with wide humidity swings.'
      ),
      column(
        'Reclaimed',
        'A room that needs to look older than it is, and lower-impact projects.',
        'Matching an exact colour, or a job on a short deadline.'
      ),
    ]),
  ]);
}

/** A specification list — the plain facts, as a definition list so each label stays
 *  attached to its value however narrow the column gets. */
export function specList(): Node {
  const spec = (label: string, value: string): Node =>
    el('div', 'flex flex-col gap-1 border-t border-base-300 py-4', {
      children: [
        el('dt', 'text-base font-semibold text-base-content', { text: label }),
        el('dd', 'text-base text-base-content', { text: value }),
      ],
    });
  return section([
    sectionHead('Specification'),
    el('dl', 'grid grid-cols-1 gap-x-10 @2xl:grid-cols-2', {
      children: [
        spec('Material', 'Solid European oak, 40 mm'),
        spec('Finish', 'Hardwax oil, three coats'),
        spec('Dimensions', 'Made to your measurements'),
        spec('Lead time', 'Four to six weeks'),
        spec('Delivery', 'Included within 50 miles'),
        spec('Guarantee', 'Ten years against defects'),
      ],
    }),
  ]);
}

/** A checklist — everything included, in one scannable column. Reads as reassurance
 *  rather than as a table, which is what a single-option page needs. */
export function inclusionList(): Node {
  const line = (text: string): Node =>
    el('li', 'flex items-start gap-3 border-t border-base-300 py-4', {
      children: [
        el('span', 'text-success', { text: '✓' }),
        el('span', 'text-base text-base-content', { text }),
      ],
    });
  return sectionAlt([
    sectionHead("What's included", 'Everything below is part of the price. Nothing is an extra.'),
    el('ul', 'flex flex-col', {
      children: [
        line('A visit to measure up, at a time that suits you'),
        line('A written quote with every line itemised'),
        line('All materials, delivered to site'),
        line('Fitting by the same people who made it'),
        line('Removal and disposal of the old fittings'),
        line('A tidy site at the end of every day'),
      ],
    }),
  ]);
}
