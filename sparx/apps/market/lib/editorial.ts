// Editorial imagery + copy for the sparx.market discovery home.
//
// These are the ONLY stock photographs on the marketplace. They belong to the
// storytelling BANDS (the maker story, the "shop by mood" trio, the sell CTA) —
// never to product or category cards, which always show real catalog photography.
// The discipline is deliberate: stock lifestyle imagery carries narrative; product
// photography carries the shopping surfaces. Mixing the two would let stock stand
// in for real inventory, which it must never do.
//
// Sourced from Pexels (pexels.com), whose license permits commercial use with no
// attribution required. They're served straight off the Pexels CDN and sized
// responsively by the app's custom next/image loader (lib/image-loader.ts appends
// `?w=&q=`, and the Pexels CDN honors `w`). Every id below was verified to resolve
// (HTTP 200) at authoring time; to swap an image, change the id.

// Build a Pexels CDN url for a photo id. `auto=compress&cs=tinysrgb` asks the CDN
// for a compressed sRGB encode and `fit=crop` keeps a centered crop as the loader
// varies the width; the loader appends the final `w`/`q`.
function pexels(id: number): string {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&fit=crop`;
}

/** An independent clothing maker smiling at her worktable — the portrait media in
 *  the home hero. Portrait/vertical, warm and genuinely happy (a real seller, not a
 *  cold product shot). A vertical VIDEO would live just as well here, but Pexels
 *  blocks scraping its video-file CDN without their API, so this is a still for now. */
export const HERO_IMAGE = pexels(5934215);
export const HERO_ALT =
  'An independent clothing maker smiling at her worktable, a tape measure around her neck';

/** A potter finishing a hand-thrown vessel — the maker-story band. */
export const MAKER_IMAGE = pexels(8364658);
export const MAKER_ALT = 'An independent potter finishing a hand-thrown vessel at the wheel';

/** A shop owner wrapping an order to ship — the sell-on-sparx band. */
export const SELL_IMAGE = pexels(7289742);
export const SELL_ALT = 'A small-business owner wrapping a customer order to ship';

/** One "shop by mood" editorial tile: a lifestyle photo that deep-links into a
 *  real, always-resolvable catalog view. */
export interface LifestyleEdit {
  title: string;
  sub: string;
  href: string;
  image: string;
  alt: string;
}

export const LIFESTYLE_EDITS: LifestyleEdit[] = [
  {
    title: 'Cozy at home',
    sub: 'Ceramics, textiles & warm little details.',
    href: '/home',
    image: pexels(7220437),
    alt: 'A calm styled corner — a linen throw and woven basket against sage cabinetry',
  },
  {
    title: 'Handmade originals',
    sub: 'One-of-a-kind pieces, made by hand.',
    href: '/products?sort=rating',
    image: pexels(3654774),
    alt: 'Skeins of mustard yarn, a knit in progress, scissors and twine on a soft blanket',
  },
  {
    title: 'Small-batch tastes',
    sub: 'Coffee, treats & pantry finds.',
    href: '/food',
    image: pexels(2096840),
    alt: 'A freshly poured latte with leaf latte art on a warm wooden table',
  },
];
