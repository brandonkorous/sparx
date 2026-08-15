// sparx-portfolio-photographer — the IMAGE-FIRST photographer portfolio (codename Silver).
//
// A photographer's gallery site where the work is the design and the chrome disappears: a
// centered wordmark, a near-full-bleed hero, selected series as large edge-to-edge frames,
// and photo-story detail pages that read like a quiet gallery wall. Type is recessive — small
// refined serif titles, generous whitespace, muted gallery neutrals — because the photographs
// carry all the colour. Dressed in the bespoke `silver` theme (a cool gallery-white paper, a
// near-black MONO primary with NO chromatic accent, zero radius, serif display Fraunces over
// an Inter body). Restraint is the whole point.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `portfolio-sites/harness.ts`; the photo-story page's DATA plumbing lives in the shared
// `template-sites/article.ts` kit (a project is a `cms.blog_post` record — see the harness
// header for why). Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-portfolio-photographer.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-portfolio-photographer/**" \
//     "marketplace-catalog/_gen/gen-portfolio-photographer.ts"
//
// LIGHT THEME, SEMANTIC TOKENS ONLY. `silver` is a gallery-white page (`bg-base-100`), ink is
// near-black (`text-base-content`), the primary is a MONO near-black (`text-primary` /
// `btn-primary`) — no chromatic accent, by design. `text-secondary` is the readable
// micro-label ink (a caption, a date, a location). No hardcoded colours — surfaces separate by
// a `bg-base-200` shift + a hairline border, never a gradient or a shadow.
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
// curl-driven Unsplash swap fills `PHOTO` with verified real imagery before ship. `src(id)`
// keys the map by asset id.
const PHOTO: Record<string, string> = {
  "silver-hero": "https://images.unsplash.com/photo-1534568292380-49954e6859e8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWluaW1hbCUyMGxhbmRzY2FwZSUyMGhvcml6b24lMjBmb2clMjBmaXJzdCUyMGxpZ2h0fGVufDB8MHx8fDE3ODYzOTk3NTR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "silver-tideline": "https://images.unsplash.com/photo-1599731657300-ec850de01ab8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8YmVhY2glMjBzZWElMjBzYW5kJTIwbG93JTIwdGlkZSUyMG1pbmltYWwlMjBncmV5fGVufDB8MHx8fDE3ODYzOTk3NTd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "silver-quiet-rooms": "https://images.unsplash.com/photo-1763890699217-62a9f7638da6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RpbGwlMjBsaWZlJTIwd2luZG93c2lsbCUyMHNvZnQlMjBsaWdodHxlbnwwfDB8fHwxNzg2Mzk5NzYwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "silver-north-faces": "https://images.unsplash.com/photo-1759349107284-fdd3b76c57eb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cG9ydHJhaXQlMjBwZXJzb24lMjBvdXRkb29ycyUyMHdlYXRoZXJlZHxlbnwwfDB8fHwxNzg2Mzk5NzYzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "silver-salt": "https://images.unsplash.com/photo-1648670078167-2b3bea515202?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2FsdCUyMGZsYXRzJTIwdGV4dHVyZSUyMHdoaXRlJTIwbWluaW1hbHxlbnwwfDB8fHwxNzg2Mzk5NzY3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "silver-portrait": "https://images.unsplash.com/photo-1618746647602-1384364ac94b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGhvdG9ncmFwaGVyJTIwcG9ydHJhaXQlMjBzdHVkaW8lMjBsaWdodHxlbnwwfDB8fHwxNzg2Mzk5NzcwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string =>
  PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'silver-hero', url: src('silver-hero'), alt: 'A wide, still landscape at first light — a low horizon and pale, even sky' },
  { id: 'silver-tideline', url: src('silver-tideline'), alt: 'The line where a grey sea meets wet sand at low tide, redrawn by the water' },
  { id: 'silver-quiet-rooms', url: src('silver-quiet-rooms'), alt: 'A still life of ordinary objects on a windowsill in soft, raking domestic light' },
  { id: 'silver-north-faces', url: src('silver-north-faces'), alt: 'A weathered portrait of a person who works outdoors, looking just off camera' },
  { id: 'silver-salt', url: src('silver-salt'), alt: 'A near-white study of salt flats, all texture and pale field with no horizon' },
  { id: 'silver-portrait', url: src('silver-portrait'), alt: 'Portrait of Mara Ilić, photographer, in even studio light' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-portfolio-photographer: unknown asset "${id}"`);
  return a.url;
};

// ── Home page bands ────────────────────────────────────────────────────────────────

/** The HERO — near-full-bleed. One large image edge to edge, with the title set BELOW it in a
 *  solid `bg-base-100` panel (never ink on the photograph). Type is recessive; the image is the
 *  first and loudest thing on the page. */
function heroBand(): Node {
  return el('section', 'bg-base-100', {
    children: [
      // Edge-to-edge image — no horizontal padding, no rounding (the theme is zero-radius).
      el('div', 'w-full', {
        children: [
          el('img', 'aspect-video w-full object-cover', {
            attrs: {
              src: assetUrl('silver-hero'),
              alt: 'A wide, still landscape at first light — a low horizon and pale, even sky',
              loading: 'eager',
            },
          }),
        ],
      }),
      // The title panel — a spare, solid statement under the frame.
      el('div', '@container px-6 py-16', {
        children: [
          el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-6', {
            children: [
              el(
                'h1',
                'max-w-4xl text-4xl font-normal leading-tight tracking-tight text-base-content @2xl:text-6xl @5xl:text-7xl',
                { text: 'Photographs that hold still.' }
              ),
              el('p', 'max-w-2xl text-lg leading-relaxed text-base-content @2xl:text-xl', {
                text: 'Mara Ilić — portrait, landscape and still-life photography, made slowly and in natural light. Selected series below; the rest are on the work page.',
              }),
              el('div', 'mt-2 flex flex-wrap items-center gap-4', {
                children: [
                  el('a', 'inline-flex w-fit items-center gap-2 text-base font-semibold text-primary', {
                    attrs: { href: '/work' },
                    children: [
                      el('span', undefined, { text: 'View the work' }),
                      el('span', undefined, { text: '→' }),
                    ],
                  }),
                  el('a', 'inline-flex w-fit items-center gap-2 text-base font-semibold text-secondary', {
                    attrs: { href: '/about' },
                    children: [el('span', undefined, { text: 'About Mara' })],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** One SELECTED-SERIES frame — a large, edge-to-edge photograph with a single quiet caption
 *  line and a "View series →" link to the series' `/blog/:slug` story. The photograph does the
 *  talking; the caption is a whisper in the readable secondary ink. */
function seriesFrame(opts: {
  img: string;
  alt: string;
  title: string;
  caption: string;
  href: string;
}): Node {
  return el('article', 'flex flex-col gap-4', {
    children: [
      el('a', 'block w-full', {
        attrs: { href: opts.href },
        children: [
          el('img', 'aspect-video w-full object-cover transition hover:opacity-90', {
            attrs: { src: assetUrl(opts.img), alt: opts.alt, loading: 'lazy' },
          }),
        ],
      }),
      el('div', '@container px-6', {
        children: [
          el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-3 @2xl:flex-row @2xl:items-baseline @2xl:justify-between', {
            children: [
              el('div', 'flex flex-col gap-2', {
                children: [
                  el('h3', 'text-2xl font-normal tracking-tight text-base-content @2xl:text-3xl', {
                    text: opts.title,
                  }),
                  el('p', 'max-w-xl text-base leading-relaxed text-secondary', { text: opts.caption }),
                ],
              }),
              el('a', 'inline-flex w-fit items-center gap-2 text-base font-semibold text-primary', {
                attrs: { href: opts.href },
                children: [
                  el('span', undefined, { text: 'View series' }),
                  el('span', undefined, { text: '→' }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** The selected-series section — a spare heading, then a stack of large frames. Calm and
 *  image-led; the frames run nearly full width with generous air between them. */
function selectedSeriesBand(): Node {
  return el('section', 'bg-base-100 py-16 @3xl:py-24', {
    children: [
      el('div', 'flex flex-col gap-16', {
        children: [
          el('div', '@container px-6', {
            children: [
              el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-3', {
                children: [
                  el('h2', 'text-sm font-semibold uppercase tracking-wide text-secondary', {
                    text: 'Selected series',
                  }),
                  el('p', 'max-w-2xl text-2xl font-normal leading-snug tracking-tight text-base-content @2xl:text-3xl', {
                    text: 'Three bodies of work made over the last few years — the coast, the rooms, and the people who live by them.',
                  }),
                ],
              }),
            ],
          }),
          seriesFrame({
            img: 'silver-tideline',
            alt: 'The line where a grey sea meets wet sand at low tide, redrawn by the water',
            title: 'Tideline',
            caption: 'One winter along a northern coast, photographed at the hour the light arrives.',
            href: '/blog/tideline',
          }),
          seriesFrame({
            img: 'silver-quiet-rooms',
            alt: 'A still life of ordinary objects on a windowsill in soft, raking domestic light',
            title: 'Quiet Rooms',
            caption: 'Still lifes made in borrowed houses, from the things people leave behind.',
            href: '/blog/quiet-rooms',
          }),
          seriesFrame({
            img: 'silver-north-faces',
            alt: 'A weathered portrait of a person who works outdoors, looking just off camera',
            title: 'North Faces',
            caption: 'Portraits of people who work outdoors, made where they work, in the weather they work in.',
            href: '/blog/north-faces',
          }),
        ],
      }),
    ],
  });
}

/** A short one-line statement band — a single serif line, generous space. The maker's stance,
 *  said once. No eyebrow; the line carries itself. */
function statementBand(): Node {
  return el('section', 'bg-base-200 @container px-6 py-20 @3xl:py-24', {
    children: [
      el('div', 'mx-auto w-full max-w-3xl', {
        children: [
          el('p', 'text-2xl font-normal leading-snug tracking-tight text-base-content @2xl:text-4xl', {
            text: 'I photograph slowly, in the light that is already there — and I wait for the moment a thing goes quiet enough to hold still.',
          }),
        ],
      }),
    ],
  });
}

/** The quiet closing "commissions" line — a single sentence with an underspoken link to the
 *  contact page. Restraint, not a coloured call-to-action band. */
function commissionsBand(): Node {
  return el('section', 'bg-base-100 @container px-6 py-16 @3xl:py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-4', {
        children: [
          el('p', 'text-lg leading-relaxed text-base-content @2xl:text-xl', {
            text: 'Commissions and print sales by request — portraits, editorial, and a small edition of archival prints from each series.',
          }),
          el('a', 'inline-flex w-fit items-center gap-2 text-base font-semibold text-primary', {
            attrs: { href: '/contact' },
            children: [
              el('span', undefined, { text: 'Enquire about a commission or a print' }),
              el('span', undefined, { text: '→' }),
            ],
          }),
        ],
      }),
    ],
  });
}

const HOME: Node[] = [heroBand(), selectedSeriesBand(), statementBand(), commissionsBand()];

// ── Work index masthead (over the live, linkable project grid) ─────────────────────

const WORK: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-12 @3xl:pt-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-4', {
        children: [
          el(
            'h1',
            'text-5xl font-normal leading-none tracking-tight text-base-content @3xl:text-7xl',
            { text: 'Series' }
          ),
          el('p', 'max-w-2xl text-lg leading-relaxed text-secondary', {
            text: 'Complete bodies of work — landscape, still life and portrait. Each opens to the full series and a short note on where it was made.',
          }),
        ],
      }),
    ],
  }),
];

// ── The bespoke photo-story page ───────────────────────────────────────────────────
// A photographer's case study reads like a gallery wall: a small location rubric over a spare
// title, a one-line standfirst, a minimal date byline, then a large featured plate and a short,
// evocative body (where it was shot, what it's about) and a quiet card about the photographer.
// Every bound field resolves against the routed project via the article kit's
// `repeat('blog_post')` scope.

function projectMasthead(): Node {
  return el('section', 'bg-base-100 @container px-6 pt-16 pb-12', {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-5', {
        children: [
          el('a', 'inline-flex w-fit items-center gap-2 text-base font-semibold text-secondary', {
            attrs: { href: '/work' },
            children: [
              el('span', undefined, { text: '←' }),
              el('span', undefined, { text: 'All series' }),
            ],
          }),
          // A small, quiet location/section rubric — metadata, not a loud rubric.
          articleRubric('text-sm font-semibold uppercase tracking-wide text-secondary'),
          articleTitle(
            'h1',
            'text-4xl font-normal leading-tight tracking-tight text-base-content @2xl:text-6xl',
          ),
          articleStandfirst('max-w-2xl text-xl leading-relaxed text-secondary'),
          el('div', 'mt-2 flex items-center gap-3', {
            children: [
              articleAuthorAvatar('h-10 w-10 rounded-full border border-base-300 object-cover'),
              el('div', 'flex flex-col', {
                children: [
                  articleAuthorName('text-base font-semibold text-base-content'),
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

/** The featured plate — a large photograph, edge to edge within a wide measure, no rounding. */
function projectImageBand(): Node {
  return el('section', 'bg-base-100 pb-8', {
    children: [
      el('div', 'w-full', {
        children: [
          articleFeaturedImage('aspect-video w-full bg-base-200 object-cover'),
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
              'flex flex-col gap-4 border-t border-base-300 pt-6 @2xl:flex-row @2xl:items-center',
            avatarClass: 'h-16 w-16 rounded-full border border-base-300 object-cover',
            nameClass: 'text-lg font-semibold text-base-content',
            bioClass: 'text-base leading-relaxed text-secondary',
          }),
        ],
      }),
    ],
  });
}

const PROJECT: Node = articlePage(
  el('div', 'flex flex-col', { children: [projectMasthead(), projectImageBand()] }),
  { foot: projectFoot(), backHref: '/work' },
);

// ── About + Contact (Mara-voiced) ───────────────────────────────────────────────────

const ABOUT: Node[] = [
  el('section', 'bg-base-100 @container px-6 py-20', {
    children: [
      el('div', 'mx-auto grid w-full max-w-5xl gap-12 @3xl:grid-cols-3 @3xl:items-start', {
        children: [
          el('div', 'flex flex-col gap-6 @3xl:col-span-2', {
            children: [
              el('h1', 'text-5xl font-normal tracking-tight text-base-content @2xl:text-6xl', {
                text: 'About Mara',
              }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: 'I am a photographer working in portrait, landscape and still life. I make pictures slowly and in the light that is already there — I would rather wait an hour for the weather than change it afterwards.',
              }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: 'My work moves between the coast and the studio: long series made outdoors over a season, and quieter still lifes built from ordinary things on a windowsill. Whatever the subject, I am after the same moment — when a scene settles and goes still enough to hold.',
              }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: 'I shoot on film and digital, print in editions, and take on a small number of portrait and editorial commissions each year. Work has appeared in independent journals and gallery shows across the north.',
              }),
            ],
          }),
          el('div', 'flex flex-col gap-6', {
            children: [
              el('img', 'aspect-square w-full border border-base-300 object-cover', {
                attrs: {
                  src: assetUrl('silver-portrait'),
                  alt: 'Portrait of Mara Ilić, photographer, in even studio light',
                  loading: 'lazy',
                },
              }),
              el('div', 'flex flex-col gap-3 border-t border-base-300 pt-6', {
                children: [
                  el('span', 'text-sm font-semibold uppercase tracking-wide text-secondary', {
                    text: 'Working in',
                  }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'Portraiture, landscape and still life — on film and digital, in natural light. Archival pigment prints in small editions.',
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
    heading: 'Commissions & prints',
    intro: [
      'I take on a few portrait and editorial commissions a year, and sell a small edition of archival prints from each series. Tell me a little about what you have in mind — the subject, roughly when, and where — and I will write back.',
      'By appointment, on the north coast. Print orders ship worldwide.',
    ],
    submitLabel: 'Write to the studio',
    secondary: { label: 'See the series first', href: '/work' },
  }),
];

// ── The author (the byline persona) ─────────────────────────────────────────────────

const AUTHORS = [
  {
    slug: 'mara-ilic',
    displayName: 'Mara Ilić',
    bio: 'Mara Ilić is a photographer working in portrait, landscape and still life — slowly, in natural light, between the coast and the studio. She prints in small editions and takes a handful of commissions each year.',
    avatarAssetId: 'silver-portrait',
  },
];

// ── Content (the series, as blog_post photo stories) ─────────────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({
  type: 'heading',
  attrs: { level: 2 },
  content: [{ type: 'text', text }],
});

const CONTENT = [
  {
    typeKey: 'blog_post',
    slug: 'tideline',
    status: 'published',
    authorSlug: 'mara-ilic',
    categories: ['Landscape'],
    tags: ['Coast', 'Film'],
    body: {
      title: 'Tideline',
      excerpt:
        'One winter along a northern coast, photographed at the hour the light arrives — the line where water meets land, redrawn by every tide.',
      featuredImage: { $asset: 'silver-tideline' },
      body: {
        type: 'doc',
        content: [
          para('A series of thirty-one photographs, made over a single winter on a stretch of northern coast a few miles long. Medium-format film, always at first light, always at low water.'),
          h2('Where'),
          para('The same beach, walked at dawn through December, January and February. Nothing dramatic happens there — no cliffs, no surf. Just a wide, patient flat of sand and a grey sea that comes and goes twice a day, leaving a new drawing behind each time.'),
          h2('What it is about'),
          para('It is about the tideline itself: the exact edge where the water has just been, marked in weed, foam and the small architecture of what the sea sorts and leaves. That line is never the same twice, and it never lasts — the next tide erases it and draws another. I wanted a record of a few of them, held still.'),
          para('I worked slowly on purpose. A tripod, a light meter, and the discipline of waiting for the flat minute before the wind picks up and the surface breaks. Most mornings I made one frame, sometimes none. The series is what survived that patience.'),
          h2('The prints'),
          para('Tideline prints as a set of six or as single plates, on cotton rag in an edition of fifteen. The tonal range is narrow by design — a coast this quiet has no place for a black or a bright white, only the long grey in between.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'quiet-rooms',
    status: 'published',
    authorSlug: 'mara-ilic',
    categories: ['Still life'],
    tags: ['Interiors', 'Domestic light'],
    body: {
      title: 'Quiet Rooms',
      excerpt:
        'Still lifes made in borrowed houses, from the ordinary things people leave behind — a study of domestic light and the objects that hold a life.',
      featuredImage: { $asset: 'silver-quiet-rooms' },
      body: {
        type: 'doc',
        content: [
          para('An ongoing series of still lifes, each made inside a house I did not live in — rentals, a friend’s empty flat, a family home between owners — using only what was already on the shelves.'),
          h2('Where'),
          para('Wherever I was staying. The rule was simple: nothing brought in, nothing bought. A windowsill, an afternoon, and whatever the last person left — a glass, a folded cloth, three pears going soft, a comb. I moved things by inches and let the light do the rest.'),
          h2('What it is about'),
          para('It is about how ordinary objects hold a life once the person is gone from the room. A still life has always been a quiet argument about time, and a borrowed house makes that argument for you: everything in it is a small evidence of someone, arranged without meaning to be looked at.'),
          para('The light is the real subject. I only worked in the hour when the sun came in low and raking, when a plain object grows a long shadow and a cheap surface turns to something worth photographing. When the light went flat, I stopped.'),
          h2('The prints'),
          para('Quiet Rooms is printed small — the plates are close to life size, the way you would actually stand to look at the things themselves. An edition of twenty, on warm-toned rag.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'north-faces',
    status: 'published',
    authorSlug: 'mara-ilic',
    categories: ['Portrait'],
    tags: ['People', 'Editorial'],
    body: {
      title: 'North Faces',
      excerpt:
        'Portraits of people who work outdoors, made where they work and in the weather they work in — a fisherman, a shepherd, a keeper of a light.',
      featuredImage: { $asset: 'silver-north-faces' },
      body: {
        type: 'doc',
        content: [
          para('A set of eighteen portraits of people whose work keeps them outside — made on their ground, in their own light, with no studio and no retouching.'),
          h2('Where'),
          para('Harbours, hill farms, a lighthouse, a salt works. I went to them rather than asking them to come to me, because a person stands differently on the ground they know. Each sitting took an afternoon: a long conversation first, a few frames near the end, once they had forgotten the camera was there.'),
          h2('What it is about'),
          para('It is about weather written into a face — the particular composure of people who have spent years reading the sky for a living. I did not want anyone smiling for me, and I did not want anyone braced. Just the ordinary, off-camera expression of someone thinking about the tide, or the ewe, or the walk home.'),
          para('I shot into whatever light the day gave, and kept it. A flat grey sky is honest light for a working face; it hides nothing and flatters nothing, and that felt right for these particular people.'),
          h2('The prints'),
          para('North Faces prints large, at the scale of a real head, in an edition of ten. Each print carries the sitter’s first name and trade, and nothing else.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'salt',
    status: 'published',
    authorSlug: 'mara-ilic',
    categories: ['Landscape'],
    tags: ['Abstract', 'Field'],
    body: {
      title: 'Salt',
      excerpt:
        'A near-white series made on the salt flats at harvest — texture, field and pale, with the horizon deliberately left out.',
      featuredImage: { $asset: 'silver-salt' },
      body: {
        type: 'doc',
        content: [
          para('Twelve photographs made over three days at a working salt lagoon during the summer harvest, when the beds are raked and the pans crust white.'),
          h2('Where'),
          para('A shallow coastal salt works, all straight lines and standing water. I photographed almost straight down, close in, so the pictures lose their scale — a cracked pan could be a foot across or a mile, and the eye cannot tell which.'),
          h2('What it is about'),
          para('It is about the edge of a photograph becoming pure field. With the horizon removed there is nowhere for the eye to rest and no obvious subject — only texture, tone and the faint grid the workers leave. I was interested in how little a landscape can hold and still be a landscape.'),
          para('The tonal range is almost gone by design: everything sits in the top of the scale, white on white, separated only by grain and the thinnest shadow. Printing it was the hard part — hold too much and it turns grey; hold too little and the surface disappears.'),
          h2('The prints'),
          para('Salt prints as a suite of four or as single large plates, on bright rag in an edition of twelve. It is meant to be hung where the wall behind it is white too.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: PortfolioSiteSpec = {
  slug: 'portfolio-photographer',
  key: 'sparx-portfolio-photographer',
  name: 'Photographer Portfolio',
  summary:
    'An image-first portfolio for a photographer: a centered wordmark, a near-full-bleed hero, selected series as large edge-to-edge frames, and photo-story pages that read like a gallery wall. Chrome recedes and type stays recessive so the photographs carry all the colour. Dressed in a cool gallery-white theme with a near-black mono primary, zero radius and a serif display. Shipped as Mara Ilić.',
  tagline: 'An image-first gallery portfolio for a photographer.',
  industry: 'Photographer',
  requiresModules: ['builder', 'cms', 'email'],
  sortWeight: 89,
  brand: {
    businessName: 'Mara Ilić',
    tagline: 'Photographs that hold still.',
  },
  // An editorial header that leads with a CENTERED wordmark and carries NO filled CTA — the
  // chrome recedes so the images lead — over the columns footer whose bottom bar carries the
  // live © name and the tenant's published legal links.
  chrome: { navbar: 'centerLogo', footer: 'columns', showCta: false },
  seo: {
    home: {
      title: 'Mara Ilić — photographer',
      description:
        'Mara Ilić is a photographer working in portrait, landscape and still life — selected series, a photographer’s statement, and how to commission work or buy a print.',
    },
    about: {
      title: 'About Mara Ilić — photographer',
      description:
        'A photographer working slowly and in natural light, between the coast and the studio — portraiture, landscape and still life, printed in small editions.',
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
