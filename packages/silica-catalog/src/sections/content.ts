// Long-form content — the bands a page of writing is built from.
//
// The gap these close: a publisher, a consultancy and any business that explains
// itself at length had a prose section and nothing else. No article header, no
// definition list, no changelog, no callout for the thing that matters most, no
// downloads block.
//
// NO PULL QUOTES, NO DROP CAPS, NO DECORATIVE RULES. Those are magazine devices and
// this is product content (CLAUDE.md RULE #2). Emphasis here is carried by a real
// semantic device — a callout that says what kind of thing it is, a heading at the
// right level, a list that is actually a list.

import { el, type Node } from '@wizeworks/silicaui-html';

import {
  body,
  caption,
  card,
  cardTitle,
  gridTwo,
  picture,
  section,
  sectionAlt,
  sectionHead,
  sectionNarrow,
  CARD,
} from './_shell';

/** An article header — title, standfirst, and the byline facts, in reading order. */
export function articleHeader(): Node {
  return sectionNarrow([
    el('h1', 'text-4xl font-semibold leading-tight text-base-content @3xl:text-5xl', {
      text: 'Why we stopped buying kiln-dried timber',
    }),
    el('p', 'text-xl text-base-content', {
      text: 'It cost more, arrived wetter than the label said, and moved after we had fitted it. So we built a drying shed and learned to do it ourselves.',
    }),
    el('p', 'text-base text-base-content', { text: 'Ada Mercer · 18 July 2026 · 6 minute read' }),
    picture('The drying shed at Mill Lane', 'wide'),
  ]);
}

/** The body of a piece — headings and paragraphs at a readable measure. */
export function prose(): Node {
  return sectionNarrow([
    el('h2', 'text-3xl font-semibold text-base-content', { text: 'What went wrong' }),
    body(
      'Every load we bought was sold as 12% moisture content. Roughly one in three measured above 16% ' +
        'when it reached the bench, and by the time that shows up the piece is already made.'
    ),
    body(
      'Timber that dries after it is fitted shrinks across the grain. A door that closed perfectly in ' +
        'March binds in July, and the customer is not wrong to call it a fault.'
    ),
    el('h2', 'text-3xl font-semibold text-base-content', { text: 'What we do instead' }),
    body(
      'We buy green, stack it ourselves, and check it with a meter before anything is cut. It takes ' +
        'longer and it ties up money, and it is the single change that most reduced our callbacks.'
    ),
  ]);
}

/**
 * A callout — the paragraph that matters more than the ones around it.
 *
 * Four tones, each SAYING what it is rather than relying on colour alone: somebody
 * reading in greyscale, or with a colour vision difference, gets the same warning.
 * This is the sanctioned way to emphasise a passage; a pull quote is not.
 */
export function callout(): Node {
  return sectionNarrow([
    el('aside', 'flex flex-col gap-2 rounded-box border border-warning bg-warning/10 p-6', {
      children: [
        el('p', 'text-base font-semibold text-warning', { text: 'Worth knowing' }),
        el('p', 'text-base text-base-content', {
          text: 'Moisture readings taken on a cold morning read low. Bring the piece indoors for an hour before you trust the number.',
        }),
      ],
    }),
  ]);
}

/** A glossary — terms and what they mean, as a real definition list. */
export function glossary(): Node {
  const term = (word: string, meaning: string): Node =>
    el('div', 'flex flex-col gap-1 border-t border-base-300 py-5', {
      children: [
        el('dt', 'text-lg font-semibold text-base-content', { text: word }),
        el('dd', 'text-base text-base-content', { text: meaning }),
      ],
    });
  return section([
    sectionHead(
      'The words we use',
      'Trade language, explained. Ask us if we use one that is not here.'
    ),
    el('dl', 'grid grid-cols-1 gap-x-10 @2xl:grid-cols-2', {
      children: [
        term(
          'Green timber',
          'Wood that has not been dried yet. Cheaper, heavier, and it will move.'
        ),
        term('Movement', 'How much a piece swells or shrinks as the air around it changes.'),
        term(
          'Scribing',
          'Cutting a piece to follow a wall that is not straight — which is all of them.'
        ),
        term('Carcass', 'The box of a unit, before the door and the worktop go on.'),
      ],
    }),
  ]);
}

/** A changelog or news list — dated entries, newest first. */
export function updateList(): Node {
  const update = (when: string, title: string, text: string): Node =>
    el('li', 'flex flex-col gap-2 border-t border-base-300 py-6', {
      children: [
        caption(when),
        el('h3', 'text-xl font-semibold text-base-content', { text: title }),
        body(text),
      ],
    });
  return sectionAlt([
    sectionHead('What has changed'),
    el('ul', 'flex flex-col', {
      children: [
        update(
          '18 July 2026',
          'Lead times down to four weeks',
          'The new drying shed is full, so we are no longer waiting on deliveries.'
        ),
        update(
          '2 June 2026',
          'Saturday fittings',
          'We can now fit on Saturdays for anyone who cannot take a weekday off.'
        ),
        update(
          '14 April 2026',
          'Ten-year guarantee',
          'Extended from five, on everything we make ourselves.'
        ),
      ],
    }),
  ]);
}

/** Downloads — a brochure, a specification, a care guide. Each row says what the file
 *  IS and how big it is, because a link that silently starts a 40 MB download on
 *  mobile data is a small betrayal. */
export function downloads(): Node {
  const file = (name: string, what: string, size: string): Node =>
    el(
      'li',
      'flex flex-col gap-3 border-t border-base-300 py-5 @2xl:flex-row @2xl:items-center @2xl:justify-between',
      {
        children: [
          el('div', 'flex flex-col gap-1', {
            children: [
              el('h3', 'text-lg font-semibold text-base-content', { text: name }),
              el('p', 'text-base text-base-content', { text: what }),
            ],
          }),
          el('a', 'btn btn-neutral btn-outline', {
            attrs: { href: '#' },
            text: `Download (${size})`,
          }),
        ],
      }
    );
  return section([
    sectionHead('Things to take away'),
    el('ul', 'flex flex-col', {
      children: [
        file('Our brochure', 'Everything we make, with prices.', 'PDF, 4 MB'),
        file('Care guide', 'How to look after an oiled finish.', 'PDF, 600 KB'),
        file('Technical specification', 'Materials, tolerances and fixings.', 'PDF, 1 MB'),
      ],
    }),
  ]);
}

/** Two columns of running text under one heading — for an "about us" that needs
 *  length without becoming a wall. */
export function twoColumnProse(): Node {
  return section([
    sectionHead('About us'),
    gridTwo([
      el('div', 'flex flex-col gap-4', {
        children: [
          body(
            'We started in 2016 with one bench and one van. The work came by word of mouth and it still ' +
              'mostly does, which is the part we are proudest of.'
          ),
          body(
            'There are eleven of us now. Everybody who makes something also fits it, so nobody hands a ' +
              'problem over the wall to somebody else.'
          ),
        ],
      }),
      el('div', 'flex flex-col gap-4', {
        children: [
          body(
            'We dry our own timber, which is unusual for a workshop this size and is the reason our lead ' +
              'times are four weeks rather than twelve.'
          ),
          body(
            'We do not subcontract. If somebody is in your house wearing our name, we employ them and we ' +
              'trained them.'
          ),
        ],
      }),
    ]),
  ]);
}

/** A resource grid — guides, articles, or anything worth linking out to. */
export function resourceGrid(): Node {
  const resource = (title: string, text: string): Node =>
    card(CARD, [
      cardTitle(title),
      body(text),
      el('a', 'text-base font-semibold text-base-content', {
        attrs: { href: '#' },
        text: 'Read it →',
      }),
    ]);
  return sectionAlt([
    sectionHead('Worth reading first'),
    el('div', 'grid grid-cols-1 gap-6 @2xl:grid-cols-2 @4xl:grid-cols-3', {
      children: [
        resource('Choosing a timber', 'What each one is actually good at, and what it costs.'),
        resource(
          'What a quote should contain',
          'The six lines that should be on it, so you can compare like with like.'
        ),
        resource(
          'Living with an oiled finish',
          'Ten minutes twice a year, and it outlasts a lacquer.'
        ),
      ],
    }),
  ]);
}
