// The structural bands — page tops, alternating rows, notices, and onward links.
//
// The gap these close: the engine ships ONE hero (a two-column split with an image),
// which means every page after the home page either repeats it or begins with nothing.
// An About page, a Contact page and a Terms page all need a plain top; a long page
// needs alternating rows to keep from turning into a column; a shop with a delivery
// delay needs somewhere to say so.
//
// Nothing here is decorative. There is no divider block and no spacer block, because a
// rule used as ornament and a box that exists to add whitespace are both the editorial
// formatting this house bans (RULE #2) — spacing is a property of the section above it,
// and a section that needs more room should say so in its own padding.

import { el, type Node } from '@wizeworks/silicaui-html';

import {
  actions,
  body,
  card,
  cardTitle,
  caption,
  gridThree,
  gridTwo,
  picture,
  primaryAction,
  secondaryAction,
  section,
  sectionAlt,
  sectionHead,
  sectionNarrow,
  CARD,
} from './_shell';

/** A plain page top — a title and a sentence. The block every page except the home
 *  page actually starts with, and the one the engine has no answer for. */
export function pageHeader(): Node {
  return section([
    el('div', 'flex max-w-3xl flex-col gap-4', {
      children: [
        el('h1', 'text-4xl font-semibold leading-tight text-base-content @3xl:text-5xl', {
          text: 'About us',
        }),
        el('p', 'text-xl text-base-content', {
          text: 'Eleven people, one workshop, and a way of working we have not changed since 2016.',
        }),
      ],
    }),
  ]);
}

/** A centred opening with two actions and no picture — for a page whose argument is
 *  the words. Faster than an image hero and harder to get wrong. */
export function heroSimple(): Node {
  return section([
    el('div', 'mx-auto flex max-w-3xl flex-col items-center gap-6', {
      children: [
        el(
          'h1',
          'text-center text-4xl font-semibold leading-tight text-base-content @3xl:text-6xl',
          {
            text: 'Furniture that outlives the room it was made for',
          }
        ),
        el('p', 'max-w-2xl text-center text-xl text-base-content', {
          text: 'Made in our own workshop from timber we dried ourselves. Quoted fixed, delivered when we said, guaranteed for ten years.',
        }),
        actions([primaryAction('Get a quote'), secondaryAction('See our work')]),
      ],
    }),
  ]);
}

/** A headline over a wide picture — the opening for a business whose work photographs
 *  well. Distinct from the side-by-side split: here the picture is the evidence and
 *  the words are the caption. */
export function heroPictureUnder(): Node {
  return section([
    el('div', 'flex max-w-3xl flex-col gap-5', {
      children: [
        el('h1', 'text-4xl font-semibold leading-tight text-base-content @3xl:text-6xl', {
          text: 'Twenty-six kitchens last year. Every one on time.',
        }),
        el('p', 'text-xl text-base-content', {
          text: 'We book a date before you commit, not after. It is the whole reason people come back to us.',
        }),
        actions([primaryAction('Talk to us')]),
      ],
    }),
    picture('A finished kitchen', 'wide'),
  ]);
}

/**
 * Three alternating rows of picture and text.
 *
 * The block that keeps a long page from becoming a column. Authored as three separate
 * rows rather than one repeating one, because the author will want to reorder and
 * delete them individually — and a repeater whose items are hand-written content is a
 * repeater in name only.
 */
export function alternatingRows(): Node {
  const row = (heading: string, text: string, pictureFirst: boolean): Node =>
    el('div', 'grid grid-cols-1 items-center gap-10 @3xl:grid-cols-2', {
      children: pictureFirst
        ? [
            picture(heading, 'wide'),
            el('div', 'flex flex-col gap-3', {
              children: [cardTitle(heading), body(text)],
            }),
          ]
        : [
            el('div', 'flex flex-col gap-3', {
              children: [cardTitle(heading), body(text)],
            }),
            picture(heading, 'wide'),
          ],
    });
  return section([
    row(
      'We dry our own timber',
      'Which is unusual for a workshop our size, and the reason our lead times are four weeks rather than twelve.',
      true
    ),
    row(
      'The person who makes it, fits it',
      'Nobody hands a problem over the wall to somebody else. If something is wrong, the person who built it puts it right.',
      false
    ),
    row(
      'Fixed prices, published',
      'The quote is the invoice. If we find something unexpected, you decide before anything is spent.',
      true
    ),
  ]);
}

/** A short list of features under one heading — text only, two columns. Deliberately
 *  icon-free: a row of generic icons above generic headings adds nothing a reader can
 *  use and is the fastest way to make a page look generated. */
export function featureList(): Node {
  const feature = (title: string, text: string): Node =>
    el('div', 'flex flex-col gap-2 border-t border-base-300 pt-5', {
      children: [el('h3', 'text-xl font-semibold text-base-content', { text: title }), body(text)],
    });
  return sectionAlt([
    sectionHead('What you get'),
    gridTwo([
      feature('A date before you commit', 'Booked in writing, with a penalty on us if we miss it.'),
      feature('One point of contact', 'The same person from the first call to the last visit.'),
      feature('A tidy site', 'Every day, not just the last one.'),
      feature('Ten-year guarantee', 'On everything we make ourselves. No argument, no charge.'),
    ]),
  ]);
}

/** A site-wide notice — holiday hours, a delivery delay, a phone line down. The block
 *  a business needs at exactly the moment it has no time to build one. */
export function noticeBanner(): Node {
  return el('section', 'bg-info/10 border-y border-info @container px-6 py-5', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-2', {
        children: [
          el('p', 'text-base font-semibold text-info', { text: 'Christmas opening' }),
          el('p', 'text-base text-base-content', {
            text: 'We close at 1pm on 24 December and reopen on 2 January. Orders placed in between are made up first.',
          }),
        ],
      }),
    ],
  });
}

/** A contact strip — phone, email and hours in one row. For the top or bottom of a
 *  page where a full "Find us" band would be too much. */
export function contactStrip(): Node {
  const item = (label: string, value: string, href?: string): Node =>
    el('div', 'flex flex-col gap-1', {
      children: [
        caption(label),
        href
          ? el('a', 'text-lg font-semibold text-base-content', { attrs: { href }, text: value })
          : el('p', 'text-lg font-semibold text-base-content', { text: value }),
      ],
    });
  return sectionAlt([
    gridThree([
      item('Call us', '01233 000000', 'tel:+441233000000'),
      item('Email', 'hello@example.com', 'mailto:hello@example.com'),
      item('Open', 'Mon–Fri 8–5, Sat 9–1'),
    ]),
  ]);
}

/** A list of onward links — the "where to next" block for the bottom of a page, or a
 *  plain site index. */
export function onwardLinks(): Node {
  const link = (title: string, text: string): Node =>
    el(
      'a',
      'flex flex-col gap-2 rounded-box border border-base-300 bg-base-100 p-6 hover:border-primary',
      {
        attrs: { href: '#' },
        children: [
          el('h3', 'text-xl font-semibold text-base-content', { text: title }),
          el('p', 'text-base text-base-content', { text }),
        ],
      }
    );
  return section([
    sectionHead('Where to next'),
    gridThree([
      link('See our work', 'Photographs of everything we finished this year.'),
      link('What we charge', 'Fixed prices, published, including fitting.'),
      link('Talk to us', 'A call, a message, or a visit — whichever suits.'),
    ]),
  ]);
}

/** Text beside a ticked list — the shape that persuades, because the prose makes the
 *  argument and the list makes it checkable. */
export function checklistSplit(): Node {
  const tick = (text: string): Node =>
    el('li', 'flex items-start gap-3 border-t border-base-300 py-4', {
      children: [
        el('span', 'text-success', { text: '✓' }),
        el('span', 'text-base text-base-content', { text }),
      ],
    });
  return section([
    el('div', 'grid grid-cols-1 gap-10 @3xl:grid-cols-2', {
      children: [
        el('div', 'flex flex-col gap-4', {
          children: [
            el('h2', 'text-3xl font-semibold text-base-content', {
              text: 'Why people choose us over a bigger firm',
            }),
            body(
              'We are not cheaper and we do not pretend to be. What we are is answerable — there is no ' +
                'call centre, no subcontractor, and no version of this where you cannot reach the person ' +
                'who did the work.'
            ),
            actions([secondaryAction('Read about us')]),
          ],
        }),
        el('ul', 'flex flex-col', {
          children: [
            tick('The same two people from quote to handover'),
            tick('No subcontractors, ever'),
            tick('Insurance certificates before you book'),
            tick('References from jobs within five miles of you'),
          ],
        }),
      ],
    }),
  ]);
}

/** A short "in numbers" band with a line explaining each figure. A bare number with a
 *  one-word label is a claim; a number with a sentence is evidence. */
export function numbersBand(): Node {
  const figure = (value: string, label: string, detail: string): Node =>
    card(CARD, [
      el('p', 'text-4xl font-semibold text-base-content', { text: value }),
      el('p', 'text-lg font-semibold text-base-content', { text: label }),
      body(detail),
    ]);
  return sectionAlt([
    gridThree([
      figure('26', 'kitchens last year', 'Every one finished on the date we first gave.'),
      figure(
        '4 weeks',
        'typical lead time',
        'Because we dry our own timber rather than waiting on a supplier.'
      ),
      figure(
        '10 years',
        'guarantee',
        'On anything made in our workshop. Two claims so far, both fixed free.'
      ),
    ]),
  ]);
}

/** A narrow legal or policy body — for terms, privacy, or anything that must be read
 *  rather than skimmed. */
export function policyBody(): Node {
  return sectionNarrow([
    el('h2', 'text-2xl font-semibold text-base-content', { text: '1. Who we are' }),
    body(
      'These terms apply to everything we sell and every job we quote. "We" means the business named ' +
        'at the bottom of this page; "you" means the person or company placing the order.'
    ),
    el('h2', 'text-2xl font-semibold text-base-content', { text: '2. Quotes and prices' }),
    body(
      'A written quote is valid for sixty days and includes materials, fitting and disposal unless it ' +
        'says otherwise. The price does not change after you accept it.'
    ),
    caption('Last updated 18 July 2026.'),
  ]);
}
