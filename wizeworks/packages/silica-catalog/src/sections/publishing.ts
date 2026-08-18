// News and listings — the bands a page that PUBLISHES is built from.
//
// The gap these close: the section library could write a single article (an
// `article_header` over `prose`), but a publisher's home page is not an article — it is
// a FEED of them, ranked, dated and grouped. A community paper, an arts venue, a
// university newsroom, a city library, a record label: every one of them opens on a
// list of things to read or attend, and the shelf had cards-with-a-picture (`case_studies`,
// `resource_grid`) and a dated changelog (`update_list`) and nothing shaped like a feed.
// These are the missing listing shapes: a lead-story feed, a text-only headline list, a
// ranked "most read", a dated "what's on", and a directory of onward sections.
//
// HOUSE-CLEAN BY CONSTRUCTION, like every section here. A newsroom's instinct is a
// section rubric ("CULTURE") sitting above each headline, and that is the eyebrow this
// platform bans on its OWN surfaces (CLAUDE.md RULE #2, and `sections.test.ts` checks it
// over this whole library). So the headline carries itself and the metadata sits BELOW
// it, where it is a fact about the thing rather than a kicker introducing it. The
// editorial rubric-above-headline treatment is a real thing a tenant may want — it lives
// in the template BUNDLES, authored under the design freedom a tenant's own site has,
// not in this shared, house-ruled palette.
//
// Static, like the rest of the section library: each `make()` stamps a frozen tree the
// author then owns. The DATA-BOUND feed — a live repeat over a tenant's real posts — is
// `blogPostGrid` in `cms.ts`; these are the hand-curated shapes beside it (an editor's
// pick, a most-read rail, an events list) that no repeat expresses.

import { el, type Node } from '@wizeworks/silicaui-html';

import { body, caption, picture, section, sectionAlt, sectionHead } from './_shell';

/** One secondary story in the feed — a smaller card under the lead. Picture, then the
 *  headline it illustrates, then the byline. The whole card is the link. */
function feedCard(headline: string, meta: string, alt: string): Node {
  return el('a', 'group flex flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-5', {
    attrs: { href: '#' },
    children: [
      picture(alt, 'wide'),
      el('h3', 'text-lg font-semibold leading-snug text-base-content', { text: headline }),
      caption(meta),
    ],
  });
}

/**
 * A news feed — one lead story given the room to breathe, then a row of the next few.
 *
 * The publisher's home page in one band. The lead is the picture-beside-the-words shape a
 * front page leads with; the three under it are the rest of the top of the fold. It is the
 * one section here whose whole job is to say "there is more than one thing to read".
 */
export function leadFeed(): Node {
  return section([
    sectionHead('Latest', 'The newest stories, and the ones worth going back for.'),
    el(
      'a',
      'group grid grid-cols-1 gap-6 rounded-box border border-base-300 bg-base-100 p-6 @3xl:grid-cols-2 @3xl:items-center',
      {
        attrs: { href: '#' },
        children: [
          picture('The lead story', 'wide'),
          el('div', 'flex flex-col gap-3', {
            children: [
              el('h3', 'text-2xl font-bold leading-tight text-base-content @3xl:text-3xl', {
                text: 'The library that stayed open all night, and what it changed',
              }),
              body(
                'For a month the Rivermark reading room never closed its doors. We asked the people who ' +
                  'came in at three in the morning what they were there for.'
              ),
              caption('By Dana Ruiz · 24 July'),
            ],
          }),
        ],
      }
    ),
    el('div', 'grid grid-cols-1 gap-6 @2xl:grid-cols-2 @4xl:grid-cols-3', {
      children: [
        feedCard(
          'A new season for the riverside stage',
          'By Marcus Bell · 22 July',
          'The riverside stage at dusk'
        ),
        feedCard(
          'Where the old print works went, and what came after',
          'By Priya Anand · 20 July',
          'The former print works'
        ),
        feedCard(
          'The volunteers keeping the last darkroom running',
          'By Sofia Marín · 18 July',
          'Hands in a darkroom'
        ),
      ],
    }),
  ]);
}

/**
 * A headline list — the "more stories" rail, text only.
 *
 * No pictures on purpose: this is the block that fits ten more things onto a page a feed
 * of cards would only fit three of. Each row is a real link with its byline underneath,
 * separated by an edge rather than a shadow.
 */
export function headlineList(): Node {
  const row = (headline: string, meta: string): Node =>
    el('li', 'border-t border-base-300', {
      children: [
        el('a', 'group flex flex-col gap-1 py-5', {
          attrs: { href: '#' },
          children: [
            el('h3', 'text-xl font-semibold leading-snug text-base-content', { text: headline }),
            caption(meta),
          ],
        }),
      ],
    });
  return sectionAlt([
    sectionHead('More from this week'),
    el('ul', 'flex flex-col', {
      children: [
        row('The bridge repair that turned into a festival', 'Community · 23 July'),
        row('Three questions for the incoming head of the archive', 'Interview · 21 July'),
        row('A map of every free piano in the city', 'Culture · 19 July'),
        row('What the flood plan actually says, in plain words', 'Explainer · 17 July'),
        row('The market traders who have been there fifty years', 'Feature · 15 July'),
      ],
    }),
  ]);
}

/**
 * Most read — the ranked list every publisher runs down its side.
 *
 * A real `<ol>`, so the order is announced and read as an order rather than as decoration.
 * The rank number leads the row because that is the whole information the block carries;
 * it is not a heading, so nothing here is a kicker above one.
 */
export function popularList(): Node {
  const row = (rank: string, headline: string): Node =>
    el('li', 'border-t border-base-300', {
      children: [
        el('a', 'group flex items-baseline gap-4 py-5', {
          attrs: { href: '#' },
          children: [
            el('span', 'text-2xl font-bold text-base-content', { text: rank }),
            el('span', 'text-lg font-semibold leading-snug text-base-content', { text: headline }),
          ],
        }),
      ],
    });
  return section([
    sectionHead('Most read'),
    el('ol', 'flex flex-col', {
      children: [
        row('1', 'The library that stayed open all night, and what it changed'),
        row('2', 'A map of every free piano in the city'),
        row('3', 'What the flood plan actually says, in plain words'),
        row('4', 'The volunteers keeping the last darkroom running'),
        row('5', 'The market traders who have been there fifty years'),
      ],
    }),
  ]);
}

/**
 * What's on — dated events, each with the where and the when a listing needs.
 *
 * Distinct from `update_list`, which is a changelog looking backward. This looks forward:
 * the date is a block a visitor scans down, and every entry says where to be and links to
 * the detail. For a venue, a talks programme, a tour, or a council's public notices.
 */
export function eventList(): Node {
  const event = (day: string, month: string, title: string, detail: string, place: string): Node =>
    el('li', 'flex flex-col gap-4 border-t border-base-300 py-6 @2xl:flex-row @2xl:gap-8', {
      children: [
        el('div', 'flex items-baseline gap-2 @2xl:w-28 @2xl:flex-col @2xl:items-start @2xl:gap-0', {
          children: [
            el('span', 'text-3xl font-bold leading-none text-base-content', { text: day }),
            el('span', 'text-base font-semibold text-base-content', { text: month }),
          ],
        }),
        el('div', 'flex flex-col gap-2', {
          children: [
            el('h3', 'text-xl font-semibold text-base-content', { text: title }),
            body(detail),
            caption(place),
            el('a', 'text-base font-semibold text-base-content', {
              attrs: { href: '#' },
              text: 'Details and tickets →',
            }),
          ],
        }),
      ],
    });
  return sectionAlt([
    sectionHead("What's on", 'The next few weeks at the riverside stage and the reading room.'),
    el('ul', 'flex flex-col', {
      children: [
        event(
          '24',
          'July',
          'Night at the archive',
          'The doors stay open until dawn, with readings on the hour and coffee that does not.',
          'Rivermark Reading Room · 8pm–6am'
        ),
        event(
          '02',
          'Aug',
          'The riverside season opens',
          'A free outdoor concert to start the summer programme. Bring a chair.',
          'Riverside Stage · 7pm'
        ),
        event(
          '09',
          'Aug',
          'Printmaking for absolute beginners',
          'Two hours, all materials provided, nothing to bring but your hands.',
          'The Old Print Works · 10am–12pm'
        ),
      ],
    }),
  ]);
}

/**
 * A directory — the onward sections of a large site, grouped and labelled.
 *
 * `onward_links` offers three; a newsroom, a university or a council has thirty, and they
 * are content a search engine should read as links, not a menu it cannot. Each column is a
 * real heading over a real list.
 */
export function directory(): Node {
  const column = (title: string, links: string[]): Node =>
    el('div', 'flex flex-col gap-3', {
      children: [
        el('h3', 'text-lg font-semibold text-base-content', { text: title }),
        el('ul', 'flex flex-col gap-2', {
          children: links.map((label) =>
            el('li', undefined, {
              children: [
                el('a', 'text-base text-base-content hover:underline', {
                  attrs: { href: '#' },
                  text: label,
                }),
              ],
            })
          ),
        }),
      ],
    });
  return section([
    sectionHead('Explore the newsroom', 'Every section, in one place.'),
    el('div', 'grid grid-cols-1 gap-8 @2xl:grid-cols-2 @4xl:grid-cols-4', {
      children: [
        column('News', ['City hall', 'Transport', 'Housing', 'The river', 'Schools']),
        column('Culture', ['Music', 'Stage', 'Books', 'Film', 'Food and drink']),
        column('Community', ['Volunteering', 'Events', 'Letters', 'Obituaries', 'Notices']),
        column('About us', ['Who we are', 'Contact the desk', 'Corrections', 'Jobs', 'Support us']),
      ],
    }),
  ]);
}
