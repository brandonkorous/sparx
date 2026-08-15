// sparx-portfolio-illustrator — the ILLUSTRATOR / visual-artist portfolio (codename Riso).
//
// The "hire-me" portfolio for an illustrator whose PERSONALITY is the product: the palette and
// the forms ARE the brand. A big, loud statement hero in coral, a dense playful WORK WALL of
// tiled pieces that tilt and jump on hover, a warm "hi, I'm Pilar" teaser band, and a
// commissions CTA — then case-study pages that walk the brief → the making → where it ran.
// Dressed in the bespoke `riso` theme (warm riso-cream carried by an electric CORAL primary +
// a COBALT accent over deep indigo ink, expressive Syne display over Work Sans). The opposite
// of the restrained designer template: this one is meant to be UNMISTAKABLY one maker.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `portfolio-sites/harness.ts`; the case-study page's DATA plumbing lives in the shared
// `template-sites/article.ts` kit (a project is a `cms.blog_post` record — see the harness
// header for why). Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-portfolio-illustrator.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-portfolio-illustrator/**" \
//     "marketplace-catalog/_gen/gen-portfolio-illustrator.ts"
//
// LIGHT-FORWARD THEME, SEMANTIC TOKENS ONLY. `riso` is a warm-cream page (`bg-base-100`), ink
// is deep indigo (`text-base-content`), the two signals are coral (`text-primary` /
// `btn-primary`) and cobalt (`text-accent` / `btn-accent`). No hardcoded colours, no gradients,
// no inline styles — the loudness rides the tokens and the type.
//
// WHY RELATIVE IMPORTS — see the harness header (marketplace-catalog has no node_modules).

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  el,
  type Node,
} from '../../packages/silica-catalog/node_modules/@wizeworks/silicaui-html/dist/index.js';
import { safeParseBlueprint } from '../../packages/blueprints/src/validate';

import { contactSection } from './shared/contact-section';
import { emitPortfolioBundle, type PortfolioSiteSpec } from './portfolio-sites/harness';
import { writePortfolioPreview } from './portfolio-sites/preview';
import {
  articleAuthorCard,
  articleAuthorAvatar,
  articleAuthorName,
  articleDate,
  articleFeaturedImage,
  articlePage,
  articleRubric,
  articleStandfirst,
  articleTitle,
} from './template-sites/article';

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Authored with an EMPTY photo map so the bundle validates on a picsum fallback; the
// curl-driven swap fills `PHOTO` with verified real imagery before ship. `src(id)` keys the
// map by asset id.
const PHOTO: Record<string, string> = {
  "riso-editorial": "https://images.unsplash.com/photo-1739476478915-8646a5f88d0d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29sb3JmdWwlMjBpbGx1c3RyYXRpb24lMjBhcnQlMjBwcmludCUyMGJvbGR8ZW58MHwwfHx8MTc4NjM5OTc5Mnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "riso-character": "https://images.unsplash.com/photo-1779967413999-d3813064b8b0?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2hhcmFjdGVyJTIwaWxsdXN0cmF0aW9uJTIwYXJ0JTIwY29sb3JmdWx8ZW58MHwwfHx8MTc4NjM5OTc5Nnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "riso-packaging": "https://images.unsplash.com/photo-1781110966661-22ad953a1b6a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFja2FnaW5nJTIwZGVzaWduJTIwY29sb3JmdWwlMjBpbGx1c3RyYXRpb258ZW58MHwwfHx8MTc4NjM5OTgwM3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "riso-mural": "https://images.unsplash.com/photo-1601913463731-cfba9fd31ed3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bXVyYWwlMjBzdHJlZXQlMjBhcnQlMjBjb2xvcmZ1bHxlbnwwfDB8fHwxNzg2Mzk5ODA2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "riso-portrait": "https://images.unsplash.com/photo-1655175480367-13985c5ca96d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YXJ0aXN0JTIwc3R1ZGlvJTIwcG9ydHJhaXQlMjBwcmludHN8ZW58MHwwfHx8MTc4NjM5OTgwOHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "riso-motion": "https://images.unsplash.com/photo-1532640331846-d2da5987c3ee?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29sb3JmdWwlMjBhYnN0cmFjdCUyMHBhaW50aW5nJTIwYm9sZHxlbnwwfDB8fHwxNzg2Mzk5ODk3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string =>
  PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1600`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'riso-editorial', url: src('riso-editorial'), alt: 'A riso-printed editorial cover illustration in coral and cobalt — a nightjar mid-flight over a city' },
  { id: 'riso-character', url: src('riso-character'), alt: 'A character design sheet — a brass automaton drawn from several angles in bold flat colour' },
  { id: 'riso-motion', url: src('riso-motion'), alt: 'A strip of animation frames of a dancing figure, printed in overlapping coral and blue' },
  { id: 'riso-packaging', url: src('riso-packaging'), alt: 'A set of hand-drawn juice labels for an orchard brand, loud saturated fruit on cream' },
  { id: 'riso-mural', url: src('riso-mural'), alt: 'A large painted wall mural of tangled plants and faces in coral, cobalt and cream' },
  { id: 'riso-portrait', url: src('riso-portrait'), alt: 'Portrait of Pilar Ortega, illustrator, in her studio surrounded by prints' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-portfolio-illustrator: unknown asset "${id}"`);
  return a.url;
};

// ── The work-wall pieces (shared between the HOME wall's static tiles and the CONTENT) ──
// Each tile links live to its case study at `/blog/:slug` — the slugs MUST match the
// `blog_post` records below. `tone` alternates coral/cobalt so the wall reads as a duotone.

interface Tile {
  slug: string;
  title: string;
  tag: string;
  img: string;
  alt: string;
  tone: 'primary' | 'accent';
}

const TILES: Tile[] = [
  { slug: 'nightjar-cover', title: 'Nightjar', tag: 'Editorial', img: 'riso-editorial', alt: 'A riso-printed editorial cover of a nightjar mid-flight', tone: 'primary' },
  { slug: 'brass-hollow-cast', title: 'Brass Hollow', tag: 'Character', img: 'riso-character', alt: 'A character design sheet of a brass automaton', tone: 'accent' },
  { slug: 'kinetic-supper', title: 'Kinetic Supper', tag: 'Motion', img: 'riso-motion', alt: 'Animation frames of a dancing figure printed in coral and blue', tone: 'accent' },
  { slug: 'pulp-orchard', title: 'Pulp Orchard', tag: 'Packaging', img: 'riso-packaging', alt: 'Hand-drawn juice labels for an orchard brand', tone: 'primary' },
];

const pillClass = (tone: 'primary' | 'accent'): string =>
  tone === 'primary'
    ? 'rounded-full bg-primary px-3 py-1 text-sm font-bold text-primary-content'
    : 'rounded-full bg-accent px-3 py-1 text-sm font-bold text-accent-content';

/** One WORK-WALL tile — an aspect-square piece that TILTS and JUMPS on hover, with the medium
 *  as a coral/cobalt pill and the piece name pinned to the bottom. The whole tile is the link
 *  to its case study. The playful hover IS the personality — a designer's grid would sit still. */
function workTile(t: Tile): Node {
  return el(
    'a',
    'relative block aspect-square overflow-hidden rounded-box border border-base-300 bg-base-200 transition hover:-rotate-2 hover:scale-105',
    {
      attrs: { href: `/blog/${t.slug}` },
      children: [
        el('img', 'absolute inset-0 h-full w-full object-cover', {
          attrs: { src: assetUrl(t.img), alt: t.alt, loading: 'lazy' },
        }),
        el('div', 'absolute inset-x-0 top-0 flex justify-start p-4', {
          children: [el('span', pillClass(t.tone), { text: t.tag })],
        }),
        el('div', 'absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-base-100 px-4 py-3', {
          children: [
            el('span', 'text-lg font-bold tracking-tight text-base-content', { text: t.title }),
            el('span', 'text-lg font-bold text-primary', { text: '→' }),
          ],
        }),
      ],
    }
  );
}

// ── Home page bands ────────────────────────────────────────────────────────────────

/** The LOUD statement hero — a huge two-tone Syne headline (coral over cobalt), a plain-spoken
 *  one-liner, and two actions. No image: the type + the colour do all the shouting. */
function heroBand(): Node {
  return el('section', 'bg-base-100 @container px-6 pt-20 pb-16 @3xl:pt-28', {
    children: [
      el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-8', {
        children: [
          el('div', 'flex flex-col gap-6', {
            children: [
              el(
                'h1',
                'max-w-4xl text-6xl font-bold leading-none tracking-tight @2xl:text-8xl @3xl:text-9xl',
                {
                  children: [
                    el('span', 'text-primary', { text: 'Loud pictures ' }),
                    el('span', 'text-accent', { text: 'for good stories.' }),
                  ],
                }
              ),
              el('p', 'max-w-2xl text-xl leading-relaxed text-base-content @2xl:text-2xl', {
                text: 'I’m Pilar Ortega — an illustrator drawing editorial covers with a pulse, characters you’d recognise on the street, and pictures that move. Big colour, big feeling, no beige.',
              }),
            ],
          }),
          el('div', 'flex flex-wrap items-center gap-3', {
            children: [
              el('a', 'btn btn-primary btn-lg', { attrs: { href: '/work' }, text: 'See the work' }),
              el('a', 'btn btn-accent btn-outline btn-lg', {
                attrs: { href: '/contact' },
                text: 'Commissions',
              }),
            ],
          }),
          el('span', 'text-sm font-semibold uppercase tracking-wide text-secondary', {
            text: 'Taking commissions for autumn 2026 · editorial · character · motion',
          }),
        ],
      }),
    ],
  });
}

/** The WORK WALL — a dense playful grid of tiled pieces, each linking to its case study. The
 *  heading is coral and oversized; the grid does the rest. This is the centrepiece of the home. */
function workWallBand(): Node {
  return el('section', 'bg-base-100 @container px-6 py-16 @3xl:py-24', {
    children: [
      el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-10', {
        children: [
          el('div', 'flex flex-col gap-3', {
            children: [
              el('h2', 'text-4xl font-bold leading-none tracking-tight text-primary @3xl:text-6xl', {
                text: 'The work wall',
              }),
              el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                text: 'Recent commissions and personal pieces. Give one a poke — they open to the whole story.',
              }),
            ],
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-3 @3xl:gap-6', {
            children: TILES.map(workTile),
          }),
        ],
      }),
    ],
  });
}

/** The warm "hi, I'm Pilar" teaser band — a personality-forward two-column: a short, friendly
 *  intro beside a tilted mural crop. Tinted (`bg-base-200`) so it reads as its own warm room. */
function aboutTeaserBand(): Node {
  return el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-24', {
    children: [
      el('div', 'mx-auto grid w-full max-w-5xl gap-10 @3xl:grid-cols-2 @3xl:items-center', {
        children: [
          el('div', 'flex flex-col gap-5', {
            children: [
              el('h2', 'text-4xl font-bold leading-tight tracking-tight text-primary @3xl:text-5xl', {
                text: 'Hi, I’m Pilar.',
              }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: 'I’ve been drawing for magazines, studios and stubborn small brands for ten years, out of a print-cluttered studio where the risograph is always warm and the coffee is always cold.',
              }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: 'I make editorial illustration, character design, short motion pieces, and the occasional very large wall. If it needs a picture with an opinion, I’m your maker.',
              }),
              el('a', 'inline-flex w-fit items-center gap-2 text-base font-bold text-accent', {
                attrs: { href: '/about' },
                children: [
                  el('span', undefined, { text: 'More about me' }),
                  el('span', undefined, { text: '→' }),
                ],
              }),
            ],
          }),
          el('div', 'overflow-hidden rounded-box border border-base-300 rotate-1', {
            children: [
              el('img', 'aspect-square w-full object-cover', {
                attrs: {
                  src: assetUrl('riso-mural'),
                  alt: 'A large painted wall mural in coral, cobalt and cream',
                  loading: 'lazy',
                },
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** The closing commissions CTA — a solid coral band, loud and inviting. */
function commissionsCtaBand(): Node {
  return el('section', 'bg-primary @container px-6 py-20 text-center', {
    children: [
      el('div', 'mx-auto flex w-full max-w-2xl flex-col items-center gap-5', {
        children: [
          el('h2', 'text-4xl font-bold tracking-tight text-primary-content @3xl:text-5xl', {
            text: 'Got a story that needs pictures?',
          }),
          el('p', 'text-lg leading-relaxed text-primary-content', {
            text: 'I take on a handful of commissions a season — editorial, covers, characters, packaging, motion. Tell me what you’re making and roughly when, and I’ll tell you how I’d draw it.',
          }),
          el('a', 'btn btn-lg mt-2 bg-base-100 text-base-content', {
            attrs: { href: '/contact' },
            text: 'Start a commission',
          }),
        ],
      }),
    ],
  });
}

const HOME: Node[] = [heroBand(), workWallBand(), aboutTeaserBand(), commissionsCtaBand()];

// ── Work index masthead (over the live, linkable project grid) ─────────────────────

const WORK: Node[] = [
  el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-4', {
        children: [
          el(
            'h1',
            'text-6xl font-bold leading-none tracking-tight text-primary @3xl:text-8xl',
            { text: 'Work' }
          ),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Every commission and personal piece, loudest first. Each one opens to the whole story — the brief, the making, and where it ran.',
          }),
        ],
      }),
    ],
  }),
];

// ── The bespoke case-study page ────────────────────────────────────────────────────
// An illustrator's case study: the medium/category as a coral rubric over the piece title, a
// standfirst, the byline (me + the date), the big featured piece, then the written body
// (the brief → the making → where it ran) and a card about me at the foot. Every bound field
// resolves against the routed project via the article kit's `repeat('blog_post')` scope.

function projectMasthead(): Node {
  return el('section', 'bg-base-100 @container px-6 pt-16 pb-12', {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-5', {
        children: [
          el('a', 'inline-flex w-fit items-center gap-2 text-base font-bold text-accent', {
            attrs: { href: '/work' },
            children: [
              el('span', undefined, { text: '←' }),
              el('span', undefined, { text: 'All work' }),
            ],
          }),
          articleRubric('text-sm font-bold uppercase tracking-wide text-primary'),
          articleTitle(
            'h1',
            'text-5xl font-bold leading-none tracking-tight text-base-content @2xl:text-7xl'
          ),
          articleStandfirst('max-w-2xl text-xl leading-relaxed text-base-content'),
          el('div', 'mt-2 flex items-center gap-3', {
            children: [
              articleAuthorAvatar('h-11 w-11 rounded-full border border-base-300 object-cover'),
              el('div', 'flex flex-col', {
                children: [
                  articleAuthorName('text-base font-bold text-base-content'),
                  articleDate('text-sm text-secondary'),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function projectImageBand(): Node {
  return el('section', 'bg-base-100 @container px-6 py-8', {
    children: [
      el('div', 'mx-auto w-full max-w-5xl', {
        children: [
          articleFeaturedImage(
            'aspect-video w-full rounded-box border border-base-300 bg-base-200 object-cover'
          ),
        ],
      }),
    ],
  });
}

function projectFoot(): Node {
  return el('section', 'bg-base-100 @container px-6 pb-16', {
    children: [
      el('div', 'mx-auto w-full max-w-3xl', {
        children: [
          articleAuthorCard({
            cardClass:
              'flex flex-col gap-4 rounded-box border border-base-300 bg-base-200 p-6 @2xl:flex-row @2xl:items-center',
            avatarClass: 'h-16 w-16 rounded-full border border-base-300 object-cover',
            nameClass: 'text-lg font-bold text-base-content',
            bioClass: 'text-base leading-relaxed text-base-content',
          }),
        ],
      }),
    ],
  });
}

const PROJECT: Node = articlePage(
  el('div', 'flex flex-col', { children: [projectMasthead(), projectImageBand()] }),
  { foot: projectFoot(), backHref: '/work' }
);

// ── About + Contact (Pilar-voiced) ─────────────────────────────────────────────────

const ABOUT: Node[] = [
  el('section', 'bg-base-100 @container px-6 py-20', {
    children: [
      el('div', 'mx-auto grid w-full max-w-5xl gap-10 @3xl:grid-cols-3 @3xl:items-start', {
        children: [
          el('div', 'flex flex-col gap-6 @3xl:col-span-2', {
            children: [
              el('h1', 'text-6xl font-bold leading-none tracking-tight text-primary @2xl:text-7xl', {
                text: 'About Pilar',
              }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: 'I’m an illustrator working out of a studio full of risograph prints and half-finished characters. For ten years I’ve drawn for magazines, record labels, publishers, and small brands who’d rather look like themselves than like everyone else.',
              }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: 'My work is loud on purpose — saturated colour, heavy line, real feeling. I’d rather a picture take a swing and miss than sit there being tasteful. Most jobs start as a scribble and a stubborn idea, and I love the part where a client’s vague brief turns into a face nobody expected.',
              }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: 'When I’m not drawing to a deadline you’ll find me pulling prints, painting the odd very large wall, or teaching a colour workshop and getting ink on everything.',
              }),
            ],
          }),
          el('div', 'flex flex-col gap-6', {
            children: [
              el('img', 'aspect-square w-full rounded-box border border-base-300 object-cover rotate-1', {
                attrs: {
                  src: assetUrl('riso-portrait'),
                  alt: 'Portrait of Pilar Ortega, illustrator, in her studio',
                  loading: 'lazy',
                },
              }),
              el('div', 'flex flex-col gap-3 rounded-box border border-base-300 bg-base-200 p-6', {
                children: [
                  el('span', 'text-sm font-bold uppercase tracking-wide text-accent', {
                    text: 'What I make',
                  }),
                  el('ul', 'flex flex-col gap-2', {
                    children: [
                      el('li', 'text-base font-semibold text-base-content', { text: 'Editorial illustration' }),
                      el('li', 'text-base font-semibold text-base-content', { text: 'Character design' }),
                      el('li', 'text-base font-semibold text-base-content', { text: 'Short motion & GIFs' }),
                      el('li', 'text-base font-semibold text-base-content', { text: 'Packaging & covers' }),
                      el('li', 'text-base font-semibold text-base-content', { text: 'Murals & live drawing' }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  }),
];

const CONTACT: Node[] = [
  // The page's own words, over the shared contact band: the business's phone and email
  // (each hidden until set in Site settings — never an invented number) and a working
  // enquiry form that reaches the tenant's Form submissions inbox. This used to end at a
  // `mailto:` to a placeholder domain, which was the only way to reach the business.
  contactSection({
    heading: 'Let’s make something loud',
    intro: 'I take on editorial, covers, character design, packaging and short motion — commissions and the occasional wall. Tell me what you’re making, who it’s for, and roughly when you need it. A rough idea and a deadline is a perfect place to start; I’ll come back with how I’d draw it and what it costs.',
    submitLabel: 'Email me',
    secondary: { label: 'See the work first', href: '/work' },
  }),
];

// ── The author (the byline persona) ─────────────────────────────────────────────────

const AUTHORS = [
  {
    slug: 'pilar-ortega',
    displayName: 'Pilar Ortega',
    bio: 'Pilar Ortega is an illustrator working across editorial, character design and motion — loud, saturated pictures for magazines, labels and brands who’d rather look like themselves. Ten years in, still getting ink on everything.',
    avatarAssetId: 'riso-portrait',
  },
];

// ── Content (the projects, as blog_post case studies) ───────────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({
  type: 'heading',
  attrs: { level: 2 },
  content: [{ type: 'text', text }],
});

const CONTENT = [
  {
    typeKey: 'blog_post',
    slug: 'nightjar-cover',
    status: 'published',
    authorSlug: 'pilar-ortega',
    categories: ['Editorial'],
    tags: ['Editorial', 'Cover', 'Riso'],
    body: {
      title: 'Nightjar — a cover that had to fly off the shelf',
      excerpt:
        'A magazine cover for a feature on city wildlife: one nightjar, mid-flight, drawn to catch the eye across a crowded newsstand.',
      featuredImage: { $asset: 'riso-editorial' },
      body: {
        type: 'doc',
        content: [
          para('Client: a monthly city magazine. Brief: the cover for a long feature about the wild animals quietly sharing the streets after dark. It had to work small, on a phone thumbnail, and loud, on a rack of forty other magazines.'),
          h2('The brief'),
          para('The editors wanted “nature, but not gentle” — nothing soft or sentimental, no watercolour foxes. They wanted the city to feel like it belonged to the animals for a few hours a night. The one rule: the cover lines had to stay readable over whatever I drew.'),
          h2('The making'),
          para('I built the whole thing around a single nightjar caught mid-wingbeat, cropped so it breaks the frame — the bird owns the page. I drew it in two riso passes, coral over cobalt, letting the misregistration do the work so the wings have a shivery, in-motion edge. The city sits underneath as a flat indigo silhouette, low enough to leave a clean band for the masthead and the cover lines.'),
          para('The colour was the argument: warm bird, cold city, and nothing in between to soften it. I tested the whole thing at thumbnail size before I inked a single final line — if it didn’t read at 2cm, it didn’t make the cut.'),
          h2('Where it ran'),
          para('It ran as the print cover and the whole digital package — social cards, the animated header on the article, and a poster the magazine sold in its shop. It was the best-selling single issue of that year, and the poster sold out twice. Not bad for one bird.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'brass-hollow-cast',
    status: 'published',
    authorSlug: 'pilar-ortega',
    categories: ['Character'],
    tags: ['Character', 'Games', 'Design'],
    body: {
      title: 'Brass Hollow — a cast of characters with a pulse',
      excerpt:
        'Character design for an indie adventure game: a whole cast of brass automatons, each one readable in a single silhouette.',
      featuredImage: { $asset: 'riso-character' },
      body: {
        type: 'doc',
        content: [
          para('Client: a small indie game studio. Brief: design the full playable cast for Brass Hollow, a story about clockwork automatons who’ve outlived their makers. Six heroes, a dozen supporting parts, all recognisable from across a room.'),
          h2('The brief'),
          para('The studio had the writing and the world but no faces yet. The one hard requirement was silhouette: each character had to be identifiable as a black shape alone, because the game’s lighting would often reduce them to exactly that.'),
          h2('The making'),
          para('I started with silhouettes only — no detail, no colour, just black shapes I could tell apart at a glance. Once the cast read as a group, I gave each one a single strong form idea (a lopsided lantern head, a barrel chest, a too-tall stoop) and drew turnarounds so the modellers had every angle.'),
          para('Colour came last and stayed disciplined: brass and bone as the base, then one saturated riso accent per character — coral for the reckless one, cobalt for the cautious one — so you learn a personality from a palette before anyone speaks a line.'),
          h2('Where it ran'),
          para('The designs became the in-game models, the key art, and a printed art book that shipped with the collector’s edition. Players started fan-drawing the cast within a week of launch — the surest sign the characters actually landed as characters, not just assets.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'kinetic-supper',
    status: 'published',
    authorSlug: 'pilar-ortega',
    categories: ['Motion'],
    tags: ['Motion', 'Animation', 'Social'],
    body: {
      title: 'Kinetic Supper — a menu that dances',
      excerpt:
        'A set of looping animated illustrations for a restaurant’s launch — food that moves, built to stop a thumb mid-scroll.',
      featuredImage: { $asset: 'riso-motion' },
      body: {
        type: 'doc',
        content: [
          para('Client: a new supper club opening in an old dance hall. Brief: a launch campaign of short looping animations for social — the food and the room brought to life, playful enough to make someone stop scrolling and book a table.'),
          h2('The brief'),
          para('They didn’t want photographs of plates; every restaurant has those. They wanted the feeling of the place — a bit theatrical, a bit late-night — as a run of GIFs and short clips that felt hand-made, not slick.'),
          h2('The making'),
          para('I drew every frame by hand and animated on twos to keep the boil — that lovely wobble where the line never quite sits still — so even a plate of noodles looks like it’s mid-dance. Each loop is built around one gag: a fork that conducts, a glass that pours itself, a chair that scoots in. Riso-style overprint gives the motion a flickering coral-and-blue trail.'),
          para('I kept every loop under two seconds and readable with the sound off, because that’s how anyone actually watches these. Twelve loops, one visual language, endlessly recombinable.'),
          h2('Where it ran'),
          para('The loops carried the whole pre-launch on social, plus the animated screens inside the restaurant itself. The opening month sold out on reservations, and the venue kept the loops running on its in-house screens long after the campaign ended.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'pulp-orchard',
    status: 'published',
    authorSlug: 'pilar-ortega',
    categories: ['Packaging'],
    tags: ['Packaging', 'Branding', 'Illustration'],
    body: {
      title: 'Pulp Orchard — labels loud enough to pick up',
      excerpt:
        'A full range of hand-drawn juice labels for a farm cooperative — saturated fruit on cream, built to win the supermarket shelf.',
      featuredImage: { $asset: 'riso-packaging' },
      body: {
        type: 'doc',
        content: [
          para('Client: a growers’ cooperative bottling cold-pressed juice. Brief: a label system for a starting range of six flavours that would stand out against the glossy national brands without pretending to be one of them.'),
          h2('The brief'),
          para('The co-op’s whole pitch was that the fruit was real, local, and a bit wonky — so the packaging couldn’t be sterile and corporate. It had to feel drawn by a person, scale across six flavours (and however many they added later), and survive being printed cheaply on a matte cream stock.'),
          h2('The making'),
          para('I hand-drew every fruit at full, unapologetic size — a whole pear filling the label, a fistful of berries spilling past the edge — in flat saturated colour on the warm cream of the bare stock. One coral accent runs across the range so the shelf reads as a family, while each flavour gets its own dominant hue so you can grab the right one without reading.'),
          para('The system was the deliverable, not six one-off labels: a fixed layout grid, a drawn logotype, and a colour rule any new flavour drops straight into. The co-op can add a seventh juice next season without calling me.'),
          h2('Where it ran'),
          para('The range launched across regional supermarkets and the co-op’s own market stall. Sell-through beat the co-op’s forecast by half again, and two more grocers picked up the line on the strength of the shelf presence alone.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: PortfolioSiteSpec = {
  slug: 'portfolio-illustrator',
  key: 'sparx-portfolio-illustrator',
  name: 'Illustrator Portfolio',
  summary:
    'A personality-first portfolio for an illustrator: a loud two-tone hero, a dense playful work wall of tiled pieces that tilt on hover, a warm “hi, I’m me” band, and case-study pages that walk the brief, the making and where it ran. The palette IS the brand — warm riso-cream carried by a coral primary and a cobalt accent, expressive Syne display. Shipped as Pilar Ortega.',
  tagline: 'A loud, work-wall portfolio for an illustrator.',
  industry: 'Illustrator & visual artist',
  requiresModules: ['builder', 'cms', 'email'],
  sortWeight: 88,
  brand: {
    businessName: 'Pilar Ortega',
    tagline: 'Loud pictures for good stories.',
  },
  // A centred-logo header with a filled CTA, over the columns footer whose bottom bar carries
  // the live © name and the tenant's published legal links.
  chrome: { navbar: 'centerLogo', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Pilar Ortega — illustrator',
      description:
        'Pilar Ortega is an illustrator working across editorial, character design and motion — loud, saturated pictures. Selected work, commissions, and how to start one.',
    },
    about: {
      title: 'About Pilar Ortega — illustrator',
      description:
        'Ten years of loud, saturated illustration across editorial, character design, motion and murals — for magazines, labels and brands who’d rather look like themselves.',
    },
  },
  home: HOME,
  work: WORK,
  project: PROJECT,
  about: ABOUT,
  contact: CONTACT,
  authors: AUTHORS,
  content: CONTENT,
  assets: ASSETS,
};

// ── Main ─────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { dir, theme } = await emitPortfolioBundle(SPEC);
  console.log(`· wrote bundle → ${dir}`);

  // Oracle 1 — the emitted bundle validates through the real loader.
  const mod = (await import(pathToFileURL(join(dir, 'blueprint.ts')).href)) as {
    default: unknown;
  };
  const result = safeParseBlueprint(mod.default);
  if (result.success) {
    console.log('· safeParseBlueprint → VALID');
  } else {
    console.error('· safeParseBlueprint → INVALID');
    for (const issue of result.issues) console.error(`    ${issue.path}: ${issue.message}`);
    process.exitCode = 1;
    return;
  }

  // Oracle 3 — a self-contained preview for visual review.
  const { path: previewPath } = await writePortfolioPreview(SPEC, theme);
  console.log(`· preview → ${previewPath}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
