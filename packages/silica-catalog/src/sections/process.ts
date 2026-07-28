// How it works — process, timelines, and the "what happens next" band.
//
// The gap these close: the single most common question a visitor has about a service
// business is "what actually happens if I get in touch", and there was no block for
// answering it. Every one of these exists to turn an enquiry from a leap into a step.
//
// NO NUMBER MARKERS. A `01 / 02 / 03` chip above each heading is the eyebrow this
// house bans (CLAUDE.md RULE #2) wearing a numeral, and it is not even doing the work
// people think: order is already carried by the reading order, and an ordered LIST
// says so to a screen reader in a way a decorative "02" never does. So the steps are
// `<ol>` items, and the sequence is conveyed by the markup rather than by decoration.

import { behave, el, part, type Node } from '@wizeworks/silicaui-html';

import {
  actions,
  body,
  card,
  cardTitle,
  gridThree,
  primaryAction,
  section,
  sectionAlt,
  sectionHead,
  CARD,
} from './_shell';

/** The three- or four-step "how it works" band, as a real ordered list. */
export function howItWorks(): Node {
  const step = (title: string, text: string): Node =>
    el('li', 'flex flex-col gap-2 border-t border-base-300 pt-6', {
      children: [el('h3', 'text-xl font-semibold text-base-content', { text: title }), body(text)],
    });
  return section([
    sectionHead('How it works', 'Four steps, and you can stop after any of them.'),
    el('ol', 'grid grid-cols-1 gap-8 @2xl:grid-cols-2 @4xl:grid-cols-4', {
      children: [
        step(
          'Tell us what you need',
          'A phone call or a message. No forms to fill in, no obligation.'
        ),
        step(
          'We come and look',
          'We measure up and talk through the options, on a day that suits you.'
        ),
        step(
          'You get a written price',
          'Itemised, fixed, and valid for sixty days. No pressure to decide.'
        ),
        step('We do the work', 'Booked in when you are ready, finished when we said it would be.'),
      ],
    }),
  ]);
}

/**
 * A vertical timeline — history, or a project with dated stages.
 *
 * The dates are the row headers rather than decoration, so the list reads correctly
 * out loud: "2019, We opened the workshop". A rule down the left would be pure
 * ornament; the border on each row does the same job and survives a narrow column.
 */
export function timeline(): Node {
  const at = (when: string, title: string, text: string): Node =>
    el('li', 'grid grid-cols-1 gap-2 border-t border-base-300 py-6 @2xl:grid-cols-4 @2xl:gap-8', {
      children: [
        el('p', 'text-base font-semibold text-base-content', { text: when }),
        el('div', 'flex flex-col gap-2 @2xl:col-span-3', {
          children: [
            el('h3', 'text-xl font-semibold text-base-content', { text: title }),
            body(text),
          ],
        }),
      ],
    });
  return sectionAlt([
    sectionHead('How we got here'),
    el('ol', 'flex flex-col', {
      children: [
        at(
          '2016',
          'Two of us and a shed',
          'One bench, one van, and work that came entirely by word of mouth.'
        ),
        at(
          '2019',
          'The Mill Lane workshop',
          'Enough room to take on kitchens, and the first two people we hired.'
        ),
        at(
          '2022',
          'Our own timber store',
          'We stopped buying in and started drying our own, which is why lead times fell.'
        ),
        at(
          '2025',
          'Eleven of us',
          'Still the same bench. Still the same people finishing what they started.'
        ),
      ],
    }),
  ]);
}

/** What happens after someone gets in touch — the reassurance block that belongs
 *  directly above a contact form. */
export function whatHappensNext(): Node {
  const beat = (title: string, text: string): Node => card(CARD, [cardTitle(title), body(text)]);
  return section([
    sectionHead('What happens after you send this'),
    gridThree([
      beat(
        'Within a few hours',
        'A real person reads it and replies. Not an automatic acknowledgement.'
      ),
      beat(
        'Within two days',
        'We suggest a time to come and look, or answer straight away if we can.'
      ),
      beat(
        'No obligation',
        'If it turns out we are not the right people, we will say so and suggest who is.'
      ),
    ]),
  ]);
}

/**
 * Frequently asked questions — single-open, so the page never becomes a wall.
 *
 * The `disclosure` behaviour with `single: true` earns its JavaScript: a native
 * `<details>` list cannot close its siblings, so opening the fourth question on a
 * phone leaves the first three pushing it off the screen. Closed panels ship
 * `hidden` so nothing flashes open before hydration.
 */
export function faq(): Node {
  const item = (q: string, a: string, open = false): Node =>
    part(
      el('div', 'flex flex-col border-t border-base-300', {
        children: [
          part(
            el(
              'button',
              'flex w-full items-center justify-between gap-4 py-5 text-left text-lg font-semibold text-base-content',
              {
                text: q,
                attrs: { type: 'button' },
              }
            ),
            'trigger'
          ),
          part(
            el(
              'div',
              'pb-5',
              open ? { children: [body(a)] } : { children: [body(a)], attrs: { hidden: true } }
            ),
            'panel'
          ),
        ],
      }),
      'item'
    );
  return section([
    sectionHead('Questions people ask'),
    behave(
      el('div', 'flex flex-col', {
        children: [
          item(
            'How long does a typical job take?',
            'Most kitchens take three weeks on site. We will give you a date before you commit, not after.',
            true
          ),
          item(
            'Do you charge for a quote?',
            'No. The visit, the measuring and the written quote are all free, whether or not you go ahead.'
          ),
          item(
            'What if the price changes?',
            'It does not. The quote is fixed. If we find something unexpected we tell you and you decide before anything is spent.'
          ),
          item(
            'Do you take payment up front?',
            'A deposit when you book, the rest when the work is finished and you are happy with it.'
          ),
        ],
      }),
      { type: 'disclosure', params: { single: true } }
    ),
  ]);
}

/** A short list of promises — what a customer can hold the business to. Reads as a
 *  guarantee rather than as marketing because each line is checkable. */
export function promises(): Node {
  const promise = (title: string, text: string): Node =>
    el('li', 'flex flex-col gap-2 border-t border-base-300 py-6', {
      children: [el('h3', 'text-xl font-semibold text-base-content', { text: title }), body(text)],
    });
  return sectionAlt([
    sectionHead('What you can hold us to'),
    el('ul', 'grid grid-cols-1 gap-x-10 @2xl:grid-cols-2', {
      children: [
        promise(
          'We turn up when we said',
          'If we are going to be late you will hear it from us first, not find out by waiting.'
        ),
        promise('The price is the price', 'The number on the quote is the number on the invoice.'),
        promise('We leave it tidy', 'Every day, not just the last one.'),
        promise('We come back if it is wrong', 'Ten years, no argument, no charge.'),
      ],
    }),
    actions([primaryAction('Talk to us')]),
  ]);
}
