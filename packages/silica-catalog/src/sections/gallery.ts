// Showing the work — galleries, before/after, and the picture-led bands.
//
// The gap these close: a photographer, a builder, a salon, a restaurant and a
// manufacturer all sell by SHOWING, and until now the only picture-bearing block on
// the shelf was a product card. An author with twelve photographs of finished work had
// nowhere to put them.
//
// Every one ships with real placeholder pictures and real placeholder captions, so the
// block reads as a design the moment it is dropped rather than as an empty frame the
// author has to imagine their way past.

import { atom, behave, el, part, type Node } from '@wizeworks/silicaui-html';

import {
  actions,
  body,
  caption,
  card,
  cardTitle,
  gridThree,
  gridTwo,
  picture,
  primaryAction,
  section,
  sectionAlt,
  sectionHead,
  CARD,
} from './_shell';

/** A tile: picture, then its own caption. The caption is genuinely secondary text —
 *  a title and a place — so `caption` is the right size here rather than body copy. */
function tile(alt: string, title: string, note: string): Node {
  return el('figure', 'flex flex-col gap-3', {
    children: [
      picture(alt, 'square'),
      el('figcaption', 'flex flex-col gap-1', {
        children: [
          el('h3', 'text-base font-semibold text-base-content', { text: title }),
          caption(note),
        ],
      }),
    ],
  });
}

/** A photo grid — the everyday "here is our work" block. */
export function galleryGrid(): Node {
  return section([
    sectionHead(
      'Recent work',
      'A few of the projects we have finished this year. Every photograph is our own.'
    ),
    gridThree([
      tile('A finished project', 'Riverside kitchen', 'Completed March'),
      tile('A finished project', 'Oak staircase', 'Completed April'),
      tile('A finished project', 'Garden room', 'Completed June'),
      tile('A finished project', 'Loft conversion', 'Completed June'),
      tile('A finished project', 'Shopfront rebuild', 'Completed July'),
      tile('A finished project', 'Barn restoration', 'Completed August'),
    ]),
  ]);
}

/**
 * A horizontal scroller — the same photographs where vertical space is short.
 *
 * CSS-only on purpose: `overflow-x-auto snap-x` scrolls with a finger, a trackpad, a
 * scroll wheel and the keyboard, with no JavaScript and nothing to hydrate. A
 * behaviour-driven carousel is the right tool when slides ADVANCE THEMSELVES; for a
 * strip of pictures a visitor browses at their own pace it is machinery that can only
 * take things away.
 */
export function galleryStrip(): Node {
  const shot = (alt: string, title: string): Node =>
    el('figure', 'flex w-64 shrink-0 snap-start flex-col gap-3', {
      children: [
        picture(alt, 'square'),
        el('figcaption', 'text-base font-semibold text-base-content', { text: title }),
      ],
    });
  return section([
    sectionHead('In the workshop'),
    el('div', 'flex snap-x gap-6 overflow-x-auto pb-4', {
      children: [
        shot('A photograph from the workshop', 'Cutting to size'),
        shot('A photograph from the workshop', 'Hand-finishing'),
        shot('A photograph from the workshop', 'The spray booth'),
        shot('A photograph from the workshop', 'Final inspection'),
        shot('A photograph from the workshop', 'Loading out'),
      ],
    }),
  ]);
}

/**
 * Before and after — two pictures side by side, each labelled.
 *
 * Deliberately NOT a drag-slider. A slider hides half the evidence behind an
 * interaction a visitor has to discover, it is unusable on a keyboard without real
 * work, and it prints as one arbitrary frame. Two pictures side by side make the same
 * argument, work everywhere, and can be read at a glance.
 */
export function beforeAfter(): Node {
  const half = (label: string, alt: string): Node =>
    el('figure', 'flex flex-col gap-3', {
      children: [
        picture(alt, 'wide'),
        el('figcaption', 'text-lg font-semibold text-base-content', { text: label }),
      ],
    });
  return sectionAlt([
    sectionHead('Before and after', 'The same room, photographed from the same corner.'),
    gridTwo([half('Before', 'The room before the work'), half('After', 'The room after the work')]),
  ]);
}

/** A picture beside a paragraph — the workhorse "what we do" band. Reversible by
 *  moving the two children in the Navigator, which is why the order is plain rather
 *  than controlled by a prop nobody would find. */
export function pictureSplit(): Node {
  return section([
    el('div', 'grid grid-cols-1 items-center gap-10 @3xl:grid-cols-2', {
      children: [
        picture('Our team at work', 'wide'),
        el('div', 'flex flex-col gap-4', {
          children: [
            el('h2', 'text-3xl font-semibold text-base-content', { text: 'Made here, by us' }),
            body(
              'Everything we sell is made in our own workshop. Nothing is bought in and re-badged, ' +
                'which is why we can tell you exactly where each piece came from and repair it years later.'
            ),
            actions([primaryAction('See how we work')]),
          ],
        }),
      ],
    }),
  ]);
}

/** A full-width picture band with a short line under it — a chapter break with
 *  something to look at. */
export function pictureBand(): Node {
  return section([
    el('figure', 'flex flex-col gap-4', {
      children: [
        picture('The workshop from the yard', 'wide'),
        el('figcaption', 'text-lg text-base-content', {
          text: 'The workshop on Mill Lane, where everything is made.',
        }),
      ],
    }),
  ]);
}

/**
 * An auto-advancing showcase — the one gallery that genuinely needs the runtime.
 *
 * `carousel` with `autoplay` earns its JavaScript: the slides move on their own, which
 * no CSS arrangement can do. Prev/next buttons and dots come with it so the visitor
 * can take control the moment they want to, which is the difference between a
 * showcase and a thing that moves while you are trying to read it.
 */
export function galleryShowcase(): Node {
  const slide = (alt: string, title: string): Node =>
    part(
      el('figure', 'flex w-full shrink-0 flex-col gap-3', {
        children: [
          picture(alt, 'wide'),
          el('figcaption', 'text-lg font-semibold text-base-content', { text: title }),
        ],
      }),
      'slide'
    );
  return section([
    sectionHead('Featured projects'),
    behave(
      el('div', 'flex flex-col gap-4 overflow-hidden', {
        children: [
          part(
            el('div', 'flex', {
              children: [
                slide('A featured project', 'Riverside kitchen'),
                slide('A featured project', 'Oak staircase'),
                slide('A featured project', 'Garden room'),
              ],
            }),
            'track'
          ),
          el('div', 'flex items-center justify-center gap-3', {
            children: [
              part(
                el('button', 'btn btn-neutral btn-outline btn-sm', { text: 'Previous' }),
                'prev'
              ),
              part(el('button', 'btn btn-neutral btn-outline btn-sm', { text: 'Next' }), 'next'),
            ],
          }),
        ],
      }),
      // `interval` is MILLISECONDS (the engine's default is 5000). Six seconds, not
      // the default five: these are photographs of work rather than a promotional
      // strip, and a slide that leaves before you have finished looking at it is worse
      // than one that stays too long. Autoplay is suppressed in the canvas and for
      // anyone who prefers reduced motion — the engine handles both.
      { type: 'carousel', params: { autoplay: true, interval: 6000 } }
    ),
  ]);
}

/** A tight logo wall — a NEUTRAL mark + wordmark per tile, so it reads as an actual
 *  logo wall (not a text list) while still being an obvious placeholder: an abstract
 *  monochrome mark is not a claim about a specific customer the way a real borrowed logo
 *  would be. The author swaps each name for a real client (and can drop in a real logo
 *  image). The mark cycles a small set of geometric icons so the six tiles read as
 *  distinct marks rather than a repeat. */
export function logoWall(): Node {
  const tile = (icon: string): Node =>
    el(
      'div',
      'flex h-20 items-center justify-center gap-3 rounded-box border border-base-300 bg-base-100',
      {
        children: [
          el('div', 'flex size-8 shrink-0 items-center justify-center rounded-field bg-base-200', {
            children: [atom('Icon', 'size-4 text-base-content', { name: icon })],
          }),
          el('span', 'text-base font-semibold text-base-content', { text: 'Your client' }),
        ],
      }
    );
  const marks = ['globe', 'shield', 'zap', 'sparkles', 'command', 'box'];
  return sectionAlt([
    sectionHead('Who we work with'),
    el('div', 'grid grid-cols-2 gap-4 @2xl:grid-cols-3 @4xl:grid-cols-6', {
      children: marks.map((m) => tile(m)),
    }),
  ]);
}

/** A case study card — picture, what the job was, and what changed. Three of them
 *  make a portfolio page on their own. */
export function caseStudies(): Node {
  const study = (title: string, what: string, result: string): Node =>
    card(CARD, [
      picture('The finished job', 'wide'),
      cardTitle(title),
      body(what),
      el('p', 'text-base font-semibold text-base-content', { text: result }),
    ]);
  return section([
    sectionHead('Case studies', 'Three jobs, what they involved, and how they turned out.'),
    gridThree([
      study(
        'Riverside kitchen',
        'A full refit in a listed building, working around a floor we were not allowed to touch.',
        'Finished two weeks early'
      ),
      study(
        'Shopfront rebuild',
        'A tired frontage replaced overnight so the shop never lost a trading day.',
        'No days closed'
      ),
      study(
        'Barn restoration',
        'Original beams saved and re-used where every quote we were shown had assumed replacement.',
        'Two thirds of the timber kept'
      ),
    ]),
  ]);
}
