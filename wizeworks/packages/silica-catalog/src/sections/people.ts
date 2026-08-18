// The people, and what other people say about them.
//
// The gap these close: trust is what a small business sells, and the shelf had one
// testimonial block and one team grid. A business with a careers page, an author to
// credit, a review score to show, or a single founder to introduce had nothing.
//
// Every quote block here carries a NAME and a ROLE, because an anonymous quote is
// worth nothing to a reader and everybody knows it. The placeholder copy says so
// plainly enough that an author who cannot fill it in will notice.

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
  CARD,
} from './_shell';

/** One person: portrait, name, role, and a line about them. */
function person(name: string, role: string, note: string): Node {
  return el('div', 'flex flex-col gap-3', {
    children: [
      picture(`${name}, ${role}`, 'square'),
      el('div', 'flex flex-col gap-1', {
        children: [
          el('h3', 'text-lg font-semibold text-base-content', { text: name }),
          el('p', 'text-base text-base-content', { text: role }),
        ],
      }),
      body(note),
    ],
  });
}

/** The team, with a line each. A grid of faces and job titles tells a visitor almost
 *  nothing; one sentence per person is what makes it worth the space. */
export function teamGrid(): Node {
  return section([
    sectionHead('The people you will actually meet'),
    gridThree([
      person(
        'Ada Mercer',
        'Founder',
        'Started the workshop in 2016 and still does the measuring on every job.'
      ),
      person(
        'Tom Whitlock',
        'Workshop lead',
        'Twenty years on the bench. If it has a joint in it, he cut it.'
      ),
      person(
        'Priya Raman',
        'Project manager',
        'The person who calls you before you have to call us.'
      ),
    ]),
  ]);
}

/** One person, at length — a founder's note, an owner's introduction. */
export function founderNote(): Node {
  return section([
    el('div', 'grid grid-cols-1 items-start gap-10 @3xl:grid-cols-3', {
      children: [
        picture('Ada Mercer, founder', 'square'),
        el('div', 'flex flex-col gap-4 @3xl:col-span-2', {
          children: [
            el('h2', 'text-3xl font-semibold text-base-content', { text: 'Why we do it this way' }),
            body(
              'I spent nine years fitting other people’s kitchens before I started this. Almost every ' +
                'complaint I heard came down to the same two things: nobody said when they were coming, ' +
                'and the final bill was not the quoted one.'
            ),
            body(
              'So we fixed those two things first and built the rest around them. It is not complicated ' +
                'and it is not a slogan — it is just the part everybody else seems to skip.'
            ),
            el('div', 'flex flex-col gap-1', {
              children: [
                el('p', 'text-base font-semibold text-base-content', { text: 'Ada Mercer' }),
                caption('Founder'),
              ],
            }),
          ],
        }),
      ],
    }),
  ]);
}

/** A single large quote — the one testimonial worth building a band around. */
export function quoteBand(): Node {
  return sectionAlt([
    el('figure', 'mx-auto flex max-w-3xl flex-col gap-6', {
      children: [
        el('blockquote', 'text-2xl font-medium leading-snug text-base-content @3xl:text-3xl', {
          text: '“They gave us a date in March and finished on it. After two builders and a year of excuses, that was the whole thing.”',
        }),
        el('figcaption', 'flex flex-col gap-1', {
          children: [
            el('p', 'text-base font-semibold text-base-content', { text: 'Helen Voss' }),
            caption('Riverside kitchen, completed March'),
          ],
        }),
      ],
    }),
  ]);
}

/** Three quotes side by side. Shorter than the band version by design — three long
 *  quotes is a wall nobody reads. */
export function quoteGrid(): Node {
  const quote = (text: string, name: string, where: string): Node =>
    el('figure', CARD, {
      children: [
        el('blockquote', 'text-lg text-base-content', { text: `“${text}”` }),
        el('figcaption', 'flex flex-col gap-1', {
          children: [
            el('p', 'text-base font-semibold text-base-content', { text: name }),
            caption(where),
          ],
        }),
      ],
    });
  return section([
    sectionHead('What customers say'),
    gridThree([
      quote(
        'Quoted on a Tuesday, started the following month, finished early.',
        'Helen Voss',
        'Riverside kitchen'
      ),
      quote(
        'The only trade I have used who left the house tidier than they found it.',
        'Michael Adeyemi',
        'Loft conversion'
      ),
      quote(
        'They talked me out of the expensive option. That is why I went back to them.',
        'Sara Lindqvist',
        'Garden room'
      ),
    ]),
  ]);
}

/** A review summary — the score, the count, and where it comes from. The source line
 *  is not optional: a rating with no provenance is a number a business gave itself. */
export function reviewSummary(): Node {
  return sectionAlt([
    el('div', 'flex flex-col items-start gap-4', {
      children: [
        el('p', 'text-5xl font-semibold text-base-content', { text: '4.9' }),
        el('p', 'text-lg text-base-content', { text: '★★★★★  from 214 reviews' }),
        caption('Collected independently. We cannot edit or remove them.'),
        actions([secondaryAction('Read every review')]),
      ],
    }),
  ]);
}

/** A careers list — open roles, each linking to its own detail. */
export function openRoles(): Node {
  const role = (title: string, where: string, terms: string): Node =>
    el(
      'li',
      'flex flex-col gap-3 border-t border-base-300 py-6 @2xl:flex-row @2xl:items-center @2xl:justify-between',
      {
        children: [
          el('div', 'flex flex-col gap-1', {
            children: [
              el('h3', 'text-xl font-semibold text-base-content', { text: title }),
              el('p', 'text-base text-base-content', { text: `${where} · ${terms}` }),
            ],
          }),
          el('a', 'btn btn-neutral btn-outline', { attrs: { href: '#' }, text: 'See the role' }),
        ],
      }
    );
  return section([
    sectionHead('Working here', 'We hire rarely and keep people a long time. These are open now.'),
    el('ul', 'flex flex-col', {
      children: [
        role('Bench joiner', 'Mill Lane workshop', 'Full time'),
        role('Fitter', 'On site, within 50 miles', 'Full time'),
        role('Apprentice', 'Mill Lane workshop', 'Three-year apprenticeship'),
      ],
    }),
  ]);
}

/** An author byline — for a post, a guide, or anything with a named writer. */
export function authorByline(): Node {
  return el('div', 'flex items-center gap-4 rounded-box border border-base-300 bg-base-100 p-6', {
    children: [
      el('img', 'size-16 shrink-0 rounded-full border border-base-300 bg-base-200 object-cover', {
        attrs: { src: '', alt: 'Ada Mercer', loading: 'lazy' },
      }),
      el('div', 'flex flex-col gap-1', {
        children: [
          el('p', 'text-base font-semibold text-base-content', { text: 'Ada Mercer' }),
          el('p', 'text-base text-base-content', {
            text: 'Founder. Writes about timber, drying, and why the cheap option costs more.',
          }),
        ],
      }),
    ],
  });
}

/** A pair of trust facts with a supporting action — accreditations, years trading,
 *  guarantees. Cards rather than a bare row so each fact has room to be specific. */
export function trustRow(): Node {
  const fact = (headline: string, detail: string): Node =>
    card(CARD, [cardTitle(headline), body(detail)]);
  return section([
    gridTwo([
      fact('Trading since 2016', 'Same owners, same workshop, same phone number.'),
      fact('Fully insured to $5M', 'Certificates on request, before you book, not after.'),
    ]),
    actions([primaryAction('Talk to us'), secondaryAction('See our work')]),
  ]);
}
