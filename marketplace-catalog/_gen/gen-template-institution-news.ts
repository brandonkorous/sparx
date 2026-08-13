// sparx-institution-news — a reference-driven CONTENT site template
// (docs/templates/content/harvard-gazette). The institutional-newsroom archetype: the
// official news office of a large, storied organisation, translated to sparx. Where the
// news-feed template models a scan-speed tech wire, this models a UNIVERSITY newsroom —
// a curated research/news front, a departments directory that mirrors the institution's
// real structure, an upcoming-events band (the campus is a living place), and a bylined
// research writeup as the signature article surface.
//
// Dressed in the bespoke `quad` theme (paper ground, a DEEP NAVY primary + an academic
// CRIMSON accent, a display serif over a clean sans — the authoritative institutional
// look a university, hospital system, museum or agency newsroom wants). A generic
// academic direction, never one school's trademarked crimson.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`, and the bylined article DATA plumbing in the shared
// `template-sites/article.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-template-institution-news.ts"
//   pnpm exec prettier --write "marketplace-catalog/_gen/gen-template-institution-news.ts" \
//     "marketplace-catalog/blueprints/sparx-institution-news/**"
//
// A CONTENT template still ships the full 9-page superset (the module-independent rule:
// author complete, the installer writes the tenant's enabled slices) — so it carries a
// LIGHT commerce slice (a small university press + alumni merch) that doubles as the
// content+commerce demo on one institutional site. Content is unambiguously the spine.
//
// WHY RELATIVE IMPORTS — see the harness header (marketplace-catalog has no node_modules).

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  el,
  type Node,
} from '../../packages/silica-catalog/node_modules/@wizeworks/silicaui-html/dist/index.js';
import { productsBlock } from '../../packages/silica-catalog/src/commerce';
import { blogPostGrid } from '../../packages/silica-catalog/src/cms';
import { safeParseBlueprint } from '../../packages/blueprints/src/validate';

import { contactSection } from './shared/contact-section';
import { emitBundle, type TemplateSiteSpec } from './template-sites/harness';
import { writeTemplatePreview } from './template-sites/preview';
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
// Royalty-free Unsplash photographs — campus, library, laboratory and event scenes,
// the editorial-photography-first identity the institutional archetype leans on.
const U = (id: string): string => `https://images.unsplash.com/photo-${id}?w=1400&q=80`;

const IMG = {
  // Lead + story imagery (also registered in `assets`)
  leadResearch: '1532094349884-543bc11b234d', // a researcher at a microscope
  storyMovein: '1523050854058-8df90110c9f1', // students in graduation gowns / campus
  storySleep: '1576091160399-112ba8d25d1d', // clinical / study scene
  storyRobotics: '1581091226825-a6a2a5aee158', // hands on a laptop / lab
  storyOrchestra: '1519683384663-c9b1e5f6f9f0', // an orchestra hall
  library: '1521587760476-6c12a4b040da', // library stacks
  campus: '1562774053-701939374585', // a university building
  events: '1523240795612-9a054b0db644', // a lecture hall audience
  // Author portraits
  authorMarsh: '1573497019940-1c28c88b4f3e', // portrait, Elena Marsh
  authorPark: '1500648767791-00dcc994a43e', // portrait, Theo Park
  authorOkonkwo: '1580489944761-15a19d654956', // portrait, Nadia Okonkwo
  // Store imagery
  anthology: '1544716278-ca5e3f4abd8c', // a hardback book on a desk
  historyBook: '1512820790803-83ca734da794', // an open book / archive
  tee: '1521572163474-6864f9cf17ab', // a folded t-shirt
  mug: '1514228742587-6b1558fcca3d', // a ceramic mug on a desk
} as const;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'lead-research', url: U(IMG.leadResearch), alt: 'A Northgate researcher at a microscope in a campus lab' },
  { id: 'story-movein', url: U(IMG.storyMovein), alt: 'Students gathered on the Northgate quad' },
  { id: 'story-sleep', url: U(IMG.storySleep), alt: 'A clinician reviewing notes in a campus health study' },
  { id: 'story-robotics', url: U(IMG.storyRobotics), alt: 'A student working at a laptop in a robotics lab' },
  { id: 'story-orchestra', url: U(IMG.storyOrchestra), alt: 'A student orchestra performing in a concert hall' },
  { id: 'library-hall', url: U(IMG.library), alt: 'The reading room of the Northgate library' },
  { id: 'campus-building', url: U(IMG.campus), alt: 'A Northgate University building at dusk' },
  { id: 'events-hall', url: U(IMG.events), alt: 'An audience in a Northgate lecture hall' },
  { id: 'author-marsh', url: U(IMG.authorMarsh), alt: 'Portrait of Elena Marsh' },
  { id: 'author-park', url: U(IMG.authorPark), alt: 'Portrait of Theo Park' },
  { id: 'author-okonkwo', url: U(IMG.authorOkonkwo), alt: 'Portrait of Nadia Okonkwo' },
  { id: 'press-anthology', url: U(IMG.anthology), alt: 'The Northgate Press anthology, a hardback book' },
  { id: 'history-book', url: U(IMG.historyBook), alt: 'An open archival book of Northgate history' },
  { id: 'alumni-tee', url: U(IMG.tee), alt: 'A folded Northgate alumni t-shirt' },
  { id: 'campus-mug', url: U(IMG.mug), alt: 'A ceramic Northgate campus mug' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-institution-news: unknown asset "${id}"`);
  return a.url;
};

// ── Home page bands (the curated institutional front) ─────────────────────────────

/** A story LINK — the secondary items in the lead's rail. A department rubric over a
 *  headline: an editorial device the platform bans on its OWN surfaces but a tenant's
 *  published site is free to use (design freedom), so it is authored here at the bundle
 *  level, never through the house-ruled catalog. */
function storyLink(rubric: string, headline: string, meta: string): Node {
  return el('a', 'group flex flex-col gap-2 border-t border-base-300 py-5', {
    attrs: { href: '/journal' },
    children: [
      el('span', 'text-sm font-semibold uppercase tracking-wide text-accent', { text: rubric }),
      // h2, not h3: these rail stories are peers of the lead's h1, not subordinate to it —
      // an h1→h3 jump is a skipped level a screen-reader outline reports (blueprint-sweep).
      el('h2', 'text-lg font-semibold leading-snug text-base-content', { text: headline }),
      el('p', 'text-sm text-base-content', { text: meta }),
    ],
  });
}

/** The curated LEAD region — a marquee research finding given the width, with the day's
 *  next few stories down a rail beside it. The editor's selection, not auto-recency. */
function leadBand(): Node {
  return el('section', 'bg-base-100 @container px-6 py-14', {
    children: [
      el('div', 'mx-auto grid w-full max-w-6xl gap-10 @4xl:grid-cols-3', {
        children: [
          // The lead feature — two-thirds of the width on a wide container.
          el('a', 'group flex flex-col gap-5 @4xl:col-span-2', {
            attrs: { href: '/journal' },
            children: [
              el(
                'img',
                'aspect-video w-full rounded-box border border-base-300 bg-base-200 object-cover',
                {
                  attrs: {
                    src: assetUrl('lead-research'),
                    alt: 'A Northgate researcher at a microscope in a campus lab',
                    loading: 'lazy',
                  },
                },
              ),
              el('span', 'text-sm font-semibold uppercase tracking-wide text-accent', {
                text: 'Research',
              }),
              el(
                'h1',
                'text-4xl font-bold leading-tight tracking-tight text-base-content @3xl:text-5xl',
                { text: 'Northgate scientists find coastal marshes store far more carbon than models assumed' },
              ),
              el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                text: 'A six-year survey led by the School of Public Health and the coastal ecology lab remeasured how much carbon a tidal marsh holds below the waterline. The number is large enough to change how the state values the wetlands it has been draining.',
              }),
              el('p', 'text-sm text-base-content', {
                text: 'By Elena Marsh · School of Arts & Sciences · 6 August',
              }),
            ],
          }),
          // The rail of the front's other selections.
          el('div', 'flex flex-col', {
            children: [
              storyLink(
                'Campus & Community',
                'The first-year move-in that reshaped a neighbourhood',
                'By Theo Park · 5 August',
              ),
              storyLink(
                'Health',
                'A campus clinic study rethinks how students sleep',
                'By Nadia Okonkwo · 5 August',
              ),
              storyLink(
                'Science & Tech',
                'Inside the lab teaching robots to read handwriting',
                'By Elena Marsh · 4 August',
              ),
            ],
          }),
        ],
      }),
    ],
  });
}

/** A plain section heading band, for the label over the bound live feed. */
function headingBand(heading: string, lead: string): Node {
  return el('section', 'bg-base-100 @container px-6 pt-12 pb-2', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-3', {
        children: [
          el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
            text: heading,
          }),
          el('p', 'max-w-2xl text-lg text-base-content', { text: lead }),
        ],
      }),
    ],
  });
}

/** The departments DIRECTORY — the institutional site-map affordance. Grouped, labelled
 *  columns (News · Research · Campus · Athletics) mirroring the real parts of the
 *  university, each a navy small-caps title over a set of links. This is the department
 *  grid as the front's backbone: the site reads as a directory of the organisation. */
function departmentsBand(): Node {
  const group = (title: string, links: [string, string][]): Node =>
    el('div', 'flex flex-col gap-4 border-t border-base-300 pt-6', {
      children: [
        // h3 under the band's h2 — a real sublevel, no skip.
        el('h3', 'text-sm font-semibold uppercase tracking-wide text-primary', { text: title }),
        el('ul', 'flex flex-col gap-3', {
          children: links.map(([label, meta]) =>
            el('li', undefined, {
              children: [
                el('a', 'group flex flex-col gap-1', {
                  attrs: { href: '/journal' },
                  children: [
                    el('span', 'text-lg font-semibold leading-snug text-base-content', { text: label }),
                    el('span', 'text-sm text-base-content', { text: meta }),
                  ],
                }),
              ],
            }),
          ),
        }),
        el('a', 'text-base font-semibold text-accent', {
          attrs: { href: '/journal' },
          text: `More in ${title} →`,
        }),
      ],
    });
  return el('section', 'bg-base-200 @container px-6 py-16', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-8', {
        children: [
          el('div', 'flex flex-col gap-3', {
            children: [
              el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
                text: 'Explore Northgate',
              }),
              el('p', 'max-w-2xl text-lg text-base-content', {
                text: 'Reporting from every part of the university — findings from the labs, life on the quad, and the teams that carry the Northgate name.',
              }),
            ],
          }),
          el('div', 'grid grid-cols-1 gap-8 @3xl:grid-cols-2 @5xl:grid-cols-4', {
            children: [
              group('News', [
                ['University announcements', 'Policy, appointments and the record'],
                ['Nation & World', 'Northgate voices on the wider story'],
                ['Work & Economy', 'Research that reaches beyond campus'],
              ]),
              group('Research', [
                ['Findings', 'The marquee work from the labs'],
                ['Health & Medicine', 'Studies from the medical school'],
                ['Science & Tech', 'Engineering, computing and the sciences'],
              ]),
              group('Campus', [
                ['Campus & Community', 'Student life, housing and the city'],
                ['Arts & Culture', 'Music, theatre and the galleries'],
                ['Sustainability', 'How the campus runs, and greener'],
              ]),
              group('Athletics', [
                ['Northgate Athletics', 'Scores, seasons and the teams'],
                ['Club & intramural', 'Sport beyond the varsity roster'],
                ['Alumni & legends', 'The record book and its keepers'],
              ]),
            ],
          }),
        ],
      }),
    ],
  });
}

/** Upcoming events — the institution-as-place module. Dated rows, each with the where.
 *  A defining difference from a pure news feed. */
function eventsBand(): Node {
  const event = (day: string, month: string, title: string, detail: string, place: string): Node =>
    el('li', 'flex flex-col gap-4 border-t border-base-300 py-6 @2xl:flex-row @2xl:gap-8', {
      children: [
        el('div', 'flex items-baseline gap-2 @2xl:w-24 @2xl:flex-col @2xl:items-start @2xl:gap-0', {
          children: [
            el('span', 'text-3xl font-bold leading-none text-primary', { text: day }),
            el('span', 'text-base font-semibold text-base-content', { text: month }),
          ],
        }),
        el('div', 'flex flex-col gap-2', {
          children: [
            el('h3', 'text-xl font-semibold text-base-content', { text: title }),
            el('p', 'text-base leading-relaxed text-base-content', { text: detail }),
            el('p', 'text-sm text-base-content', { text: place }),
            el('a', 'text-base font-semibold text-accent', {
              attrs: { href: '/journal' },
              text: 'Details →',
            }),
          ],
        }),
      ],
    });
  return el('section', 'bg-base-100 @container px-6 py-16', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-6', {
        children: [
          el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
            text: 'On campus this month',
          }),
          el('ul', 'flex flex-col', {
            children: [
              event(
                '12',
                'Sep',
                'The President’s Lecture: what a coastline is worth',
                'Elena Marsh and the coastal ecology lab present the marsh-carbon findings, followed by a public Q&A.',
                'Hartwell Hall · 6pm · free and open to the public',
              ),
              event(
                '27',
                'Sep',
                'Fall Research Showcase',
                'Two hundred undergraduate and graduate projects across every school, in one afternoon under the atrium.',
                'Science Quad Atrium · 1pm · all welcome',
              ),
              event(
                '05',
                'Oct',
                'Northgate Symphony: a century in the hall',
                'The student orchestra reopens the restored Whitfield Hall with a programme spanning its hundred years.',
                'Whitfield Hall · 7:30pm · tickets at the box office',
              ),
              event(
                '19',
                'Oct',
                'Alumni & Careers Fair',
                'Employers, graduate schools and the alumni network, with drop-in advising for every year.',
                'Reeve Fieldhouse · 10am · students and alumni',
              ),
            ],
          }),
        ],
      }),
    ],
  });
}

const HOME: Node[] = [
  leadBand(),
  headingBand('Across the university', 'The newest reporting from every corner of campus.'),
  blogPostGrid(),
  departmentsBand(),
  eventsBand(),
  // The content→commerce bridge: the university press + alumni store, as a live carousel.
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'University Press' }),
];

// ── The bespoke article page (the content template's signature surface) ───────────
// A bylined research/news feature: the department rubric over a serif headline, a real
// byline (author + date), the lead image, the written body, and an author card at the
// foot. Every bound field resolves against the routed post (the `article.ts` kit's
// `repeat('blog_post')` scope); the byline lights up from the storefront's projection —
// a post with no author simply renders no byline, never a blank line.

/** The article MASTHEAD — authored UNSCOPED; `articlePage` wraps it in `repeat('blog_post')`. */
function articleMasthead(): Node {
  return el('section', 'bg-base-200 @container px-6 pt-12 pb-14 @2xl:pt-16', {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-5', {
        children: [
          el('a', 'inline-flex w-fit items-center gap-2 text-base font-semibold text-accent', {
            attrs: { href: '/journal' },
            children: [
              el('span', undefined, { text: '←' }),
              el('span', undefined, { text: 'All stories' }),
            ],
          }),
          // The department rubric — the editorial eyebrow, bound to the post's category.
          articleRubric('text-sm font-semibold uppercase tracking-wide text-accent'),
          articleTitle(
            'h1',
            'text-4xl font-bold leading-tight tracking-tight text-base-content @2xl:text-5xl',
          ),
          articleStandfirst('max-w-2xl text-xl leading-relaxed text-base-content'),
          // The byline row — author portrait, name, and date.
          el('div', 'mt-2 flex items-center gap-3', {
            children: [
              articleAuthorAvatar('h-11 w-11 rounded-full border border-base-300 object-cover'),
              el('div', 'flex flex-col', {
                children: [
                  articleAuthorName('text-base font-semibold text-base-content'),
                  articleDate('text-sm text-base-content'),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** The featured image band, at the article measure. */
function articleImageBand(): Node {
  return el('section', 'bg-base-100 @container px-6 py-10', {
    children: [
      el('div', 'mx-auto w-full max-w-3xl', {
        children: [
          articleFeaturedImage(
            'aspect-video w-full rounded-box border border-base-300 bg-base-200 object-cover',
          ),
        ],
      }),
    ],
  });
}

/** The author card at the foot — portrait, name, bio. Gated on the author bio, so it
 *  appears only when there is genuinely something to say about who wrote the piece. */
function articleFoot(): Node {
  return el('section', 'bg-base-100 @container px-6 pb-16', {
    children: [
      el('div', 'mx-auto w-full max-w-3xl', {
        children: [
          articleAuthorCard({
            cardClass:
              'flex flex-col gap-4 rounded-box border border-base-300 bg-base-200 p-6 @2xl:flex-row @2xl:items-center',
            avatarClass: 'h-16 w-16 rounded-full border border-base-300 object-cover',
            nameClass: 'text-lg font-semibold text-base-content',
            bioClass: 'text-base leading-relaxed text-base-content',
          }),
        ],
      }),
    ],
  });
}

const ARTICLE: Node = articlePage(
  el('div', 'flex flex-col', { children: [articleMasthead(), articleImageBand()] }),
  { foot: articleFoot(), backHref: '/journal' },
);

// ── The journal index masthead (over the bound post grid) ─────────────────────────

const JOURNAL: Node[] = [
  el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-4', {
        children: [
          el('h1', 'text-4xl font-bold leading-tight tracking-tight text-base-content @3xl:text-6xl', {
            text: 'The Northgate Newsroom',
          }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Research findings, campus life, and the people who make the university — reported by the news office for students, faculty, alumni and the public.',
          }),
        ],
      }),
    ],
  }),
];

// ── About + Contact (Northgate-voiced) ────────────────────────────────────────────

const ABOUT: Node[] = [
  el('section', 'bg-base-100 @container px-6 py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-6', {
        children: [
          el('h1', 'text-4xl font-bold tracking-tight text-base-content @2xl:text-5xl', {
            text: 'About the Newsroom',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'The Northgate Newsroom is the official news office of Northgate University. We report on the research, teaching and life of the institution — the findings coming out of the labs, the decisions shaping the campus, and the students, faculty and staff behind them.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Our job is to tell the university’s story plainly and accurately, to a mixed audience of the campus community, alumni, the press and the wider public. When we cover research, we read the study before we write the headline, and we say clearly what has been found and what has not.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Media Relations can arrange interviews, provide images and connect reporters with faculty experts. Story ideas from across the university are always welcome.',
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
    heading: 'Contact the Newsroom',
    intro: 'For a media enquiry, an interview request, images, or a story tip from within the university, reach the news office directly. We respond to press on deadline and read every tip.',
    submitLabel: 'Email Media Relations',
  }),
];

// ── Light commerce (the University Press + alumni store) ───────────────────────────

const money = (dollars: number): number => Math.round(dollars * 100);

interface Variant {
  sku: string;
  priceCents: number;
  isDefault?: boolean;
  inventoryPolicy: 'continue';
}
interface Product {
  handle: string;
  title: string;
  description: string;
  status: 'active';
  productType: string;
  vendor: string;
  tags: string[];
  categoryHandles: string[];
  collectionHandles: string[];
  seoTitle: string;
  seoDescription: string;
  variants: Variant[];
  images: { assetId: string; isPrimary: true; alt: string }[];
}

const PRODUCTS: Product[] = [
  {
    handle: 'northgate-press-anthology',
    title: 'Northgate Review — the tenth anthology',
    description:
      'A hardback collection of the best essays, poetry and long-form reporting from a decade of the Northgate Review, the university’s literary and ideas journal. Edited by the faculty of Arts & Sciences.',
    status: 'active',
    productType: 'Book',
    vendor: 'Northgate University Press',
    tags: ['press', 'book', 'anthology'],
    categoryHandles: ['press'],
    collectionHandles: ['featured'],
    seoTitle: 'Northgate Review — the tenth anthology | Northgate University Press',
    seoDescription: 'A hardback decade anthology of essays, poetry and reporting from the Northgate Review.',
    variants: [{ sku: 'NGP-ANTH-10', priceCents: money(32), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'press-anthology', isPrimary: true, alt: 'The Northgate Review anthology, a hardback book' }],
  },
  {
    handle: 'northgate-a-history',
    title: 'Northgate: A History of the University',
    description:
      'The definitive illustrated history of Northgate, from its founding charter to the modern research campus. Written by the university archivist, with two hundred photographs from the collection.',
    status: 'active',
    productType: 'Book',
    vendor: 'Northgate University Press',
    tags: ['press', 'book', 'history'],
    categoryHandles: ['press'],
    collectionHandles: ['featured'],
    seoTitle: 'Northgate: A History of the University | Northgate University Press',
    seoDescription: 'The definitive illustrated history of Northgate University, by the university archivist.',
    variants: [{ sku: 'NGP-HIST', priceCents: money(45), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'history-book', isPrimary: true, alt: 'An open archival book of Northgate history' }],
  },
  {
    handle: 'northgate-alumni-tee',
    title: 'Northgate Alumni Tee',
    description:
      'A heavyweight cotton t-shirt with the Northgate seal printed small on the chest. Cut for everyday wear and made to last a few reunions.',
    status: 'active',
    productType: 'Apparel',
    vendor: 'Northgate University',
    tags: ['merch', 'apparel', 'alumni'],
    categoryHandles: ['merch'],
    collectionHandles: ['featured'],
    seoTitle: 'Northgate Alumni Tee — heavyweight cotton t-shirt',
    seoDescription: 'A heavyweight cotton t-shirt with the Northgate seal, cut for everyday wear.',
    variants: [{ sku: 'NG-TEE-ALUM', priceCents: money(26), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'alumni-tee', isPrimary: true, alt: 'A folded Northgate alumni t-shirt' }],
  },
  {
    handle: 'northgate-campus-mug',
    title: 'Northgate Campus Mug',
    description:
      'A stoneware mug with a line drawing of Hartwell Hall wrapped around it. Holds a proper amount of coffee for a long afternoon in the stacks.',
    status: 'active',
    productType: 'Merch',
    vendor: 'Northgate University',
    tags: ['merch', 'mug'],
    categoryHandles: ['merch'],
    collectionHandles: [],
    seoTitle: 'Northgate Campus Mug — stoneware mug',
    seoDescription: 'A stoneware mug with a line drawing of Hartwell Hall.',
    variants: [{ sku: 'NG-MUG', priceCents: money(18), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'campus-mug', isPrimary: true, alt: 'A ceramic Northgate campus mug' }],
  },
];

const COMMERCE = {
  categories: [
    { handle: 'press', name: 'University Press', description: 'Books from Northgate University Press.', featured: true },
    { handle: 'merch', name: 'Alumni & Merch', description: 'Carry a bit of Northgate with you.', featured: true },
  ],
  collections: [
    {
      handle: 'featured',
      name: 'Featured',
      description: 'What the Press and the alumni office are pointing at this term.',
      type: 'manual',
      featured: true,
      productHandles: ['northgate-press-anthology', 'northgate-a-history', 'northgate-alumni-tee'],
    },
  ],
  products: PRODUCTS,
};

// ── The masthead (byline personas) ────────────────────────────────────────────────
// Real staff writers the posts reference by `authorSlug`. The installer seeds these as
// CMS `Author` rows scoped to the site, and the storefront byline projection resolves
// them — so the bespoke article page shows a real name, portrait and bio.

const AUTHORS = [
  {
    slug: 'elena-marsh',
    displayName: 'Elena Marsh',
    bio: 'Elena Marsh is a science writer in the Northgate news office, covering research across the sciences and engineering. She has a background in environmental biology and has reported on the university’s labs for eight years.',
    avatarAssetId: 'author-marsh',
  },
  {
    slug: 'theo-park',
    displayName: 'Theo Park',
    bio: 'Theo Park covers campus and community for the Northgate Newsroom — student life, housing, the arts, and the relationship between the university and the city around it.',
    avatarAssetId: 'author-park',
  },
  {
    slug: 'nadia-okonkwo',
    displayName: 'Nadia Okonkwo',
    bio: 'Nadia Okonkwo is the Newsroom’s health and medicine editor, reporting from the medical school and the campus clinics. She previously edited a regional health desk.',
    avatarAssetId: 'author-okonkwo',
  },
];

// ── Content (the Northgate reporting) ─────────────────────────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });

const CONTENT = [
  {
    typeKey: 'blog_post',
    slug: 'coastal-marshes-store-more-carbon',
    status: 'published',
    authorSlug: 'elena-marsh',
    categories: ['Research'],
    tags: ['Environment', 'Biology'],
    body: {
      title: 'Northgate scientists find coastal marshes store far more carbon than models assumed',
      excerpt:
        'A six-year survey remeasured how much carbon a tidal marsh holds below the waterline. The number is large enough to change how the state values the wetlands it has been draining.',
      featuredImage: { $asset: 'lead-research' },
      body: {
        type: 'doc',
        content: [
          para('For decades the carbon a salt marsh holds was estimated from the top layer of soil, because that is the part a researcher can reach with a hand corer on a low tide. A Northgate team spent six years reaching deeper, and found that most of the story was buried where nobody had been counting.'),
          h2('What the survey measured'),
          para('Working across eleven marshes along the state’s coast, the group drove cores two metres down and dated each layer. Below the reach of the usual sample, the sediment kept holding carbon — the slow accumulation of centuries of tidal plants, sealed away from the air by the water above it.'),
          para('Averaged over the sites, the marshes were storing roughly forty per cent more carbon per hectare than the figures the state currently uses in its planning. The oldest, least disturbed marshes held the most.'),
          h2('Why it matters beyond the lab'),
          para('That gap is not academic. The same wetlands are routinely valued at close to nothing when a road, a port expansion or a housing tract is weighed against them. If a hectare of marsh is holding decades of a small town’s emissions, the accounting that treats it as empty ground is simply wrong.'),
          para('The team has handed its dataset to the state coastal commission, which is revising the numbers it uses to price wetland loss. “We did not set out to write policy,” Marsh’s co-author said. “We set out to measure a thing properly. It turns out measuring it properly changes what it is worth.”'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'first-year-move-in-reshaped-neighbourhood',
    status: 'published',
    authorSlug: 'theo-park',
    categories: ['Campus & Community'],
    tags: ['Student life', 'Housing'],
    body: {
      title: 'The first-year move-in that reshaped a neighbourhood',
      excerpt:
        'A new residential college opened its doors this term, moving eight hundred first-years off the far campus and into the streets around Gate Square. The block has been quietly rearranging itself ever since.',
      featuredImage: { $asset: 'story-movein' },
      body: {
        type: 'doc',
        content: [
          para('On the last Saturday of August, eight hundred first-year students carried boxes up the steps of the new East Quad residential college — and a neighbourhood that had spent thirty years as a quiet edge of campus became, overnight, its front door.'),
          h2('A block that changed with them'),
          para('The café on the corner has doubled its morning staff. The old hardware store now stocks desk lamps and command hooks alongside the paint. A long-empty storefront reopened as a study space that keeps the lights on until two in the morning, because that is when the students are awake.'),
          para('Not everyone welcomed the change at the same pace. Residents who had grown used to the calm came to the community board with real questions about noise, rubbish and rent. The university sent people to listen, and — for once — kept sending them after the first meeting.'),
          h2('The deal that made it work'),
          para('What has held the peace is an agreement most students never see: the college funds a neighbourhood liaison, the city holds the university to a noise plan, and a share of ground-floor space is reserved for local businesses rather than campus chains. It is not a truce so much as a working relationship, and both sides seem faintly surprised it is working.'),
          para('“I moved here for quiet,” one long-time resident said, watching a line form at the reopened café. “I got a college instead. But it’s a better café than the quiet ever gave me.”'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'campus-clinic-study-student-sleep',
    status: 'published',
    authorSlug: 'nadia-okonkwo',
    categories: ['Health'],
    tags: ['Wellbeing', 'Study'],
    body: {
      title: 'A campus clinic study rethinks how students sleep',
      excerpt:
        'The university health service tracked the sleep of six hundred students for a semester. The finding that surprised the clinicians was not how little they slept, but how differently.',
      featuredImage: { $asset: 'story-sleep' },
      body: {
        type: 'doc',
        content: [
          para('Every campus clinician knows students do not sleep enough. The Northgate health service wanted to know something more useful: not the average, but the shape of it — who is losing sleep, when, and to what.'),
          h2('The pattern under the average'),
          para('Over a semester, six hundred volunteers wore a simple wrist tracker. The average landed where everyone expected, at a little under seven hours. But the average hid two very different populations. One group kept a steady, if short, schedule. The other swung wildly — five hours one night, ten the next — chasing a debt they never repaid.'),
          para('It was the second group, the clinicians found, that reported the most anxiety and the lowest marks, regardless of how many total hours they logged. The problem was not the quantity of sleep. It was the chaos of it.'),
          h2('What the clinic changed'),
          para('The health service has rebuilt its sleep advice around consistency rather than duration. The new first line is not “sleep more” but “sleep at the same time,” a message that turns out to be far easier for a stressed nineteen-year-old to act on than an instruction to find two more hours in a day that has none.'),
          para('A follow-up cohort begins this term. “We were measuring the wrong thing for years,” the lead clinician said. “Not the amount. The rhythm.”'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'lab-teaching-robots-to-read-handwriting',
    status: 'published',
    authorSlug: 'elena-marsh',
    categories: ['Science & Tech'],
    tags: ['Robotics', 'Computing'],
    body: {
      title: 'Inside the lab teaching robots to read handwriting',
      excerpt:
        'A Northgate engineering group is training machines to read the one thing they have always failed at — a doctor’s scrawl, a field notebook, a century-old ledger. The trick was to stop treating it as text.',
      featuredImage: { $asset: 'story-robotics' },
      body: {
        type: 'doc',
        content: [
          para('Handwriting is the problem computers were supposed to have solved decades ago and never quite did. A printed page is easy; a hurried note in a margin, a field biologist’s pencil, a nineteenth-century clerk’s cursive — those still defeat the best systems on the market. A lab in the Northgate engineering school thinks it knows why.'),
          h2('Reading strokes, not letters'),
          para('“Everyone tries to turn the writing into letters and then read the letters,” the lab’s director explained. “We stopped doing that.” Instead, their system watches the physical motion the pen would have made — the order and direction of strokes — and learns handwriting the way a person learns to read a friend’s scrawl: by getting used to the hand, not by decoding each mark.'),
          para('On a benchmark of archival documents that off-the-shelf tools read at barely fifty per cent accuracy, the Northgate model passed ninety. On field notebooks — smudged, abbreviated, half in Latin — it still cleared eighty.'),
          h2('Where it goes first'),
          para('The first users are not banks or hospitals but archives and natural-history collections, sitting on centuries of handwritten records nobody has the labour to transcribe. A museum partner has already fed the system a shelf of Victorian specimen logs, and watched a decade of unread observations become searchable in a weekend.'),
          para('“It is not glamorous,” the director said. “But there are libraries full of things people wrote down and no one has read since. We would like to change that.”'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'student-orchestra-fills-restored-hall',
    status: 'published',
    authorSlug: 'theo-park',
    categories: ['Arts & Culture'],
    tags: ['Music', 'Campus life'],
    body: {
      title: 'The student orchestra that filled a century-old hall',
      excerpt:
        'Whitfield Hall reopened this month after a three-year restoration. The student symphony that played the first night gave it back the one thing the builders could not — a full house that knew the room.',
      featuredImage: { $asset: 'story-orchestra' },
      body: {
        type: 'doc',
        content: [
          para('For three years Whitfield Hall sat behind scaffolding while restorers put back a ceiling, a century of plasterwork, and an acoustic that a 1970s renovation had quietly ruined. The night it reopened, ninety student musicians walked onto the stage to find out whether the room worked.'),
          h2('An acoustic that came back'),
          para('It worked. The restoration had chased an old set of drawings and a stubborn belief that the hall’s original shape — narrower, taller, wrapped in wood — was the reason players a hundred years ago had loved it. The first chord settled the argument. The sound bloomed and held, the way the oldest recordings from the room suggested it once had.'),
          para('“You could hear the back of the orchestra from the front,” the symphony’s conductor said afterwards, still slightly stunned. “In the old hall you fought the room. In this one it helps you.”'),
          h2('A full house that knew the room'),
          para('What the restoration could not supply, the students did: a hall full of people who cared. The programme spanned the room’s hundred years, and the audience — parents, faculty, alumni who had played the same stage decades before — treated each piece like a homecoming, because for many of them it was.'),
          para('The symphony has a full season booked in the hall now. The first tickets sold out in a morning.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'institution-news',
  key: 'sparx-institution-news',
  name: 'sparx — Institution News',
  summary:
    'A curated institutional newsroom for a university, hospital system, museum or agency — a marquee research lead over a rail of the day’s stories, a live feed, a departments directory, an upcoming-events band, and a bespoke bylined research writeup, in a paper-ground navy-primary + crimson-accent serif theme. Shipped as the Northgate University news office, with a light university-press + alumni store to demo content + commerce together.',
  tagline: 'An authoritative newsroom template for an institution that reports and belongs to a place.',
  vertical: 'content',
  industry: 'University & campus news',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 100,
  brand: {
    businessName: 'Northgate University',
    tagline: 'News from across the university.',
  },
  // A brand-left header with no CTA (an institutional newsroom’s conversion is subscribe,
  // not a hard sell), over the multi-column footer institutions carry.
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: false },
  seo: {
    home: {
      title: 'Northgate University — news, research and campus life',
      description:
        'The official news office of Northgate University — research findings from the labs, campus and community reporting, health and science, arts and athletics, and what is happening on campus.',
    },
    about: {
      title: 'About the Northgate Newsroom — the university news office',
      description:
        'Who the Northgate Newsroom is and how it works — the official news office reporting the research, teaching and life of the university to the campus, alumni and the public.',
    },
  },
  home: HOME,
  journal: JOURNAL,
  article: ARTICLE,
  about: ABOUT,
  contact: CONTACT,
  commerce: COMMERCE,
  authors: AUTHORS,
  content: CONTENT,
  assets: ASSETS,
};

// ── Main ─────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { dir, theme } = await emitBundle(SPEC);
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
  const { path: previewPath } = await writeTemplatePreview(SPEC, theme);
  console.log(`· preview → ${previewPath}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
