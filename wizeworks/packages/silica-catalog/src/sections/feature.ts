// Full-bleed pictures with words ON them — the opening almost every real store leads
// with, and the one shape the section library was missing.
//
// THE GAP THESE CLOSE. Every picture block before these put the words UNDER the image
// (`pictureBand`, `pictureSplit`, `heroPictureUnder`) — deliberately, because words laid
// directly on an unknown photograph cannot be proven readable, and a headline that is
// legible on the author's monitor can be invisible on a customer's phone in daylight.
// So the strongest opening in modern commerce — a photograph that fills the screen with
// the headline sitting inside it — had no block, and every template that wanted one had
// nowhere to get it.
//
// HOW THE READABILITY PROBLEM IS SOLVED, ONCE. Not with a scrim. A translucent dark
// layer over the photo makes the text's contrast depend on whatever the photo happens to
// be — bright sky behind white type is gone — which is precisely the failure
// `commerce.ts` refuses for its carousel controls, and which the platform's contrast
// linter cannot even measure (it will not guess a color it cannot name). Instead the
// picture is full-bleed BEHIND a SOLID panel: the image is `absolute inset-0 object-cover`,
// and the words live in a contained `bg-base-100` card with `text-base-content` on it —
// a real theme pair, measurably AA in both modes, on every one of the shipped and
// template themes. The catalog sweep (`site-lint/catalog-sweep.test.ts`) proves it.
//
// WHY THESE ARE NOT WRAPPED IN `section()`. A full-bleed band runs edge to edge; the
// shared shell caps everything at `max-w-6xl`. So the section here is its own outer
// element (still `@container`, still the house rhythm), and only the CONTENT is capped —
// the picture is allowed the whole width, which is the entire point of the shape.

import { el, type Node } from '@wizeworks/silicaui-html';

import { actions, primaryAction, secondaryAction, gridTwo } from './_shell';

/** The full-bleed picture that sits behind the words. Full box, cropped to fill, never
 *  distorted — and it ships with an empty `src` like every other placeholder, so the
 *  pre-publish check asks the author to choose the photograph rather than letting a grey
 *  box go live. */
function backdrop(alt: string): Node {
  return el('img', 'absolute inset-0 h-full w-full object-cover', {
    attrs: { src: '', alt, loading: 'lazy' },
  });
}

/**
 * The shared builder both the hero and the mid-page band are made of: a full-bleed
 * picture, and a solid readable panel anchored bottom-left over it.
 *
 * The panel is `bg-base-100` with `text-base-content` inside — the one pairing the theme
 * guarantees is legible, so the words stay readable whatever photograph the author drops
 * behind them and whichever theme the site wears. `tall` gives the hero a real minimum
 * height; the mid-page band takes its height from its own padding.
 */
function overlayBand(opts: {
  heading: Node;
  lead: string;
  alt: string;
  tall: boolean;
  cta: Node;
}): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      backdrop(opts.alt),
      el(
        'div',
        `relative mx-auto flex w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-16 @3xl:px-10 @3xl:py-20${
          opts.tall ? ' min-h-96' : ''
        }`,
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                opts.heading,
                el('p', 'text-lg text-base-content', { text: opts.lead }),
                opts.cta,
              ],
            }),
          ],
        }
      ),
    ],
  });
}

/**
 * A full-bleed opening — one photograph filling the width, the headline and two actions
 * sitting in a solid panel over it. The dominant opening across modern stores.
 */
export function heroOverlay(): Node {
  return overlayBand({
    heading: el('h1', 'text-4xl font-semibold leading-tight text-base-content @3xl:text-5xl', {
      text: 'The new season is here',
    }),
    lead: 'One photograph, your words on it, and the two things you want a visitor to do first. Swap the picture for your own and rewrite the rest.',
    alt: 'A photograph that fills the width behind the words',
    tall: true,
    cta: actions([primaryAction('Shop the collection'), secondaryAction('Our story')]),
  });
}

/**
 * The same builder as a mid-page band — a full-bleed picture carrying a heading, a short
 * paragraph and one onward link. For the "here is what makes this different" moment
 * partway down a page: a material, a place, a way of working.
 */
export function featureOverlay(): Node {
  return overlayBand({
    heading: el('h2', 'text-3xl font-semibold text-base-content @3xl:text-4xl', {
      text: 'Made to a standard, not a price',
    }),
    lead: 'A band you drop halfway down a page to slow a visitor down and show them the one thing that sets you apart. The picture carries the feeling; these words carry the fact.',
    alt: 'A wide photograph behind a single point worth making',
    tall: false,
    cta: actions([secondaryAction('See how it is made')]),
  });
}

/**
 * A two-up grid of editorial tiles — each a full-bleed picture with its own title and a
 * link, in a solid panel over the image. The "shop the look" / "explore the range" grid
 * that a lookbook page is built from. Two across on a wide container, one on a narrow one.
 */
export function lookbookTiles(): Node {
  const tile = (title: string, cue: string, alt: string): Node =>
    el(
      'div',
      'relative flex min-h-96 flex-col justify-end overflow-hidden rounded-box border border-base-300 bg-base-200 p-4',
      {
        children: [
          backdrop(alt),
          el('div', 'relative flex flex-col gap-3 rounded-box bg-base-100 p-6', {
            children: [
              el('h3', 'text-xl font-semibold text-base-content', { text: title }),
              el('a', 'btn btn-primary btn-sm', { attrs: { href: '#' }, text: cue }),
            ],
          }),
        ],
      }
    );
  return el('section', 'bg-base-100 @container px-6 py-16', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-10', {
        children: [
          el('h2', 'text-3xl font-semibold text-base-content @3xl:text-4xl', {
            text: 'Explore the range',
          }),
          gridTwo([
            tile('New arrivals', 'Shop new in', 'A photograph for the first tile'),
            tile('The essentials', 'Shop essentials', 'A photograph for the second tile'),
            tile('This season', 'Shop the season', 'A photograph for the third tile'),
            tile('Last chance', 'Shop the sale', 'A photograph for the fourth tile'),
          ]),
        ],
      }),
    ],
  });
}
