// sparx-civic-portal — a first-party CONTENT site template
// (docs/templates/content/nasa). The government / public-service member of the content
// set: where news-feed models a WORDPRESS-scale publisher, this models a CITY GOVERNMENT
// PORTAL — the services directory, the public-notices record, and the news feed that a
// municipality, agency, library system or public institution needs, ported to sparx.
//
// The accessibility-first archetype, translated to sparx: a clear welcome band, a
// task-first SERVICES DIRECTORY (Permits / Utilities / Transit / Parks), a state-aware
// PUBLIC-NOTICES + ALERTS band, the bound blogPostGrid() news feed, and a very light
// civic shop (a city publication, a transit pass, a parks pass). Dressed in the bespoke
// `agency` theme (white ground, deep FEDERAL-BLUE primary at AAA on white, one flag-red
// accent held for the alert, high-legibility sans throughout) — clarity is the whole
// brief.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts` (content-theme resolution + the `article` slot). The article
// DATA plumbing lives in the shared `template-sites/article.ts` kit. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-template-civic-portal.ts"
//   pnpm exec prettier --write "marketplace-catalog/_gen/gen-template-civic-portal.ts" \
//     "marketplace-catalog/blueprints/sparx-civic-portal/**"
//
// A CONTENT template still ships the full 9-page superset (the module-independent rule:
// author complete, the installer writes the tenant's enabled slices) — so it carries a
// LIGHT commerce slice (a publication, two passes) that doubles as the content+commerce
// demo. The bespoke effort goes where a civic site lives: the article / public-notice page.
//
// ACCESSIBILITY IS THE HEADLINE FEATURE. Every text/ink pair uses a real token (never a
// faded/soft ink), body sits at a generous ≥16px floor, the alert is a SOLID panel (never
// text on a photo), and headings never skip a level. RULE #3 is the design brief here, not
// an afterthought.
//
// WHY RELATIVE IMPORTS — see the harness header (marketplace-catalog has no node_modules).

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  el,
  type Node,
} from '../../wizeworks/packages/silica-catalog/node_modules/@wizeworks/silicaui-html/dist/index.js';
import { productsBlock } from '../../wizeworks/packages/silica-catalog/src/commerce';
import { blogPostGrid } from '../../wizeworks/packages/silica-catalog/src/cms';
import { safeParseBlueprint } from '../../wizeworks/packages/blueprints/src/validate';

import { contactSection } from './shared/contact-section';
import { emitBundle, type TemplateSiteSpec } from './template-sites/harness';
import { writeTemplatePreview } from './template-sites/preview';
import {
  articleAuthorAvatar,
  articleAuthorCard,
  articleDate,
  articleFeaturedImage,
  articlePage,
  articleAuthorName,
  articleRubric,
  articleStandfirst,
  articleTitle,
} from './template-sites/article';

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Royalty-free Unsplash photographs — civic / city / public-building scenes.
const U = (id: string): string => `https://images.unsplash.com/photo-${id}?w=1400&q=80`;

const IMG = {
  // Hero + news imagery
  cityHall: '1529107386315-e1a2ed48a620',
  roads: '1451187580459-43490279c0fa',
  council: '1540575467063-178a50c2df87',
  parks: '1466611653911-95081537e5b7',
  water: '1461749280684-dccba630e2f6',
  library: '1507842217343-583bb7270b66',
  // Issuing-office / official portraits
  comms: '1573497019940-1c28c88b4f3e',
  mayor: '1494790108377-be9c29b29330',
  clerk: '1500648767791-00dcc994a43e',
  // Civic-shop imagery
  guide: '1543286386-713bdd548da4',
  transit: '1544620347-c4fd4a3d5957',
  parksPass: '1441974231531-c6227db76b6e',
} as const;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'hero-city-hall', url: U(IMG.cityHall), alt: 'The colonnade of the Rivermark city hall' },
  { id: 'news-roads', url: U(IMG.roads), alt: 'A city bridge and roadway at dusk' },
  { id: 'news-council', url: U(IMG.council), alt: 'Residents seated in a public council chamber' },
  { id: 'news-parks', url: U(IMG.parks), alt: 'A green city park on a hillside' },
  { id: 'news-water', url: U(IMG.water), alt: 'A utility control room with monitoring screens' },
  { id: 'news-library', url: U(IMG.library), alt: 'The reading room of a public library' },
  { id: 'office-comms', url: U(IMG.comms), alt: 'A communications officer at the city press desk' },
  { id: 'official-mayor', url: U(IMG.mayor), alt: 'Portrait of Mayor Elena Ruiz' },
  { id: 'official-clerk', url: U(IMG.clerk), alt: 'Portrait of City Clerk David Okafor' },
  { id: 'pub-city-guide', url: U(IMG.guide), alt: 'The cover of the Rivermark resident guide' },
  { id: 'pass-transit', url: U(IMG.transit), alt: 'A city transit bus at a stop' },
  { id: 'pass-parks', url: U(IMG.parksPass), alt: 'A wooded trail in a city park' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-civic-portal: unknown asset "${id}"`);
  return a.url;
};

// ── Home page bands ────────────────────────────────────────────────────────────

/** The welcome / hero band — a plain-language greeting, the two most-used civic actions,
 *  and a city image beside the text (NEVER text on the photo — a solid text column and a
 *  separate image column, which is the accessibility-first way to carry both). */
function heroBand(): Node {
  return el('section', 'bg-base-100 @container px-6 py-16 @2xl:py-20', {
    children: [
      el('div', 'mx-auto grid w-full max-w-6xl items-center gap-10 @4xl:grid-cols-2', {
        children: [
          el('div', 'flex flex-col gap-6', {
            children: [
              el(
                'h1',
                'text-4xl font-bold leading-tight tracking-tight text-primary @3xl:text-5xl',
                { text: 'Welcome to the City of Rivermark' },
              ),
              el('p', 'max-w-xl text-lg leading-relaxed text-base-content @2xl:text-xl', {
                text: 'Your city, online. Pay a bill, apply for a permit, find a meeting, or report a problem — the things residents do most, all in one clear place.',
              }),
              el('div', 'flex flex-col gap-4 @2xl:flex-row', {
                children: [
                  el('a', 'btn btn-primary btn-lg', {
                    attrs: { href: '/shop' },
                    text: 'Pay a utility bill',
                  }),
                  el('a', 'btn btn-primary btn-outline btn-lg', {
                    attrs: { href: '/contact' },
                    text: 'Report an issue',
                  }),
                ],
              }),
            ],
          }),
          el('img', 'aspect-video w-full rounded-box border border-base-300 bg-base-200 object-cover', {
            attrs: {
              src: assetUrl('hero-city-hall'),
              alt: 'The colonnade of the Rivermark city hall',
              loading: 'lazy',
            },
          }),
        ],
      }),
    ],
  });
}

/** One labelled service link inside a directory column. */
function serviceLink(label: string, href: string): Node {
  return el('li', 'border-t border-base-300', {
    children: [
      el('a', 'block py-3 text-lg font-medium text-primary', {
        attrs: { href },
        text: label,
      }),
    ],
  });
}

/** One directory column — a plain-language group title (h3, under the band's h2) over its
 *  labelled links. Citizens think in tasks, so the labels are verbs and nouns, not org
 *  charts. */
function serviceColumn(title: string, links: { label: string; href: string }[]): Node {
  return el('div', 'flex flex-col gap-2', {
    children: [
      el('h3', 'text-xl font-semibold text-base-content', { text: title }),
      el('ul', 'flex flex-col', {
        children: links.map((l) => serviceLink(l.label, l.href)),
      }),
    ],
  });
}

/** The SERVICES DIRECTORY band — the civic heart. A grouped, labelled link directory of
 *  the tasks residents actually come for, arranged services-first. */
function servicesDirectory(): Node {
  return el('section', 'bg-base-200 @container px-6 py-16', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-10', {
        children: [
          el('div', 'flex flex-col gap-3', {
            children: [
              el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
                text: 'City services',
              }),
              el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                text: 'Everything the city does for residents, grouped so you can find your task without knowing which department owns it.',
              }),
            ],
          }),
          el('div', 'grid grid-cols-1 gap-8 @2xl:grid-cols-2 @4xl:grid-cols-4', {
            children: [
              serviceColumn('Permits & licenses', [
                { label: 'Apply for a building permit', href: '/contact' },
                { label: 'Business licenses & registrations', href: '/contact' },
                { label: 'Request public records', href: '/contact' },
              ]),
              serviceColumn('Utilities & payments', [
                { label: 'Pay a water or sewer bill', href: '/shop' },
                { label: 'Start or stop service', href: '/contact' },
                { label: 'Report an outage', href: '/contact' },
              ]),
              serviceColumn('Transit & streets', [
                { label: 'Buy a monthly transit pass', href: '/shop' },
                { label: 'Report a pothole or streetlight', href: '/contact' },
                { label: 'Schedules & road detours', href: '/journal' },
              ]),
              serviceColumn('Parks & recreation', [
                { label: 'Reserve a park shelter', href: '/contact' },
                { label: 'Get an annual parks pass', href: '/shop' },
                { label: 'Program & class registration', href: '/journal' },
              ]),
            ],
          }),
        ],
      }),
    ],
  });
}

/** One public-notice row — a type tag, the notice title, and its posted date, hairline
 *  divided and imageless (the civic public-record form). Links through to the full notice. */
function noticeRow(tag: string, title: string, date: string): Node {
  return el('li', 'border-t border-base-300', {
    children: [
      el('a', 'flex flex-col gap-2 py-5 @2xl:flex-row @2xl:items-center @2xl:gap-6', {
        attrs: { href: '/journal' },
        children: [
          el(
            'span',
            'w-fit rounded-field border border-primary px-3 py-1 text-sm font-semibold uppercase tracking-wide text-primary',
            { text: tag },
          ),
          el('span', 'flex-1 text-lg font-semibold leading-snug text-base-content', {
            text: title,
          }),
          el('span', 'text-sm font-medium text-base-content', { text: date }),
        ],
      }),
    ],
  });
}

/** The PUBLIC NOTICES + ALERTS band. Opens with a SOLID, high-contrast alert callout (the
 *  civic-red accent, held only for genuine urgency — the one non-blue element on the page),
 *  then the structured, dated public-notices record beneath it. */
function noticesBand(): Node {
  return el('section', 'bg-base-100 @container px-6 py-16', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-10', {
        children: [
          // The alert — a SOLID white panel edged in the civic-red accent, with a filled
          // accent tag. Ink stays near-black on white (highest contrast, the accessibility
          // point); the red is the one non-blue signal on the page, held for real urgency.
          // Text sits in the panel, never on an image — the civic "official channel".
          el('div', 'flex flex-col gap-3 rounded-box border border-accent bg-base-100 p-6 @2xl:flex-row @2xl:items-center @2xl:gap-6', {
            children: [
              el(
                'span',
                'w-fit rounded-field bg-accent px-3 py-1 text-sm font-bold uppercase tracking-wide text-accent-content',
                { text: 'Alert' },
              ),
              el('p', 'flex-1 text-lg font-semibold leading-snug text-base-content', {
                text: 'Boil-water advisory in effect for the Highlands until further notice. Bring water to a rolling boil before drinking.',
              }),
              el('a', 'text-lg font-bold text-accent underline', {
                attrs: { href: '/journal' },
                text: 'Read the advisory',
              }),
            ],
          }),
          el('div', 'flex flex-col gap-6', {
            children: [
              el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
                text: 'Public notices',
              }),
              el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                text: 'Hearings, agendas, and bid postings, published as the public record — newest first.',
              }),
              el('ul', 'flex flex-col', {
                children: [
                  noticeRow(
                    'Hearing',
                    'Notice of public hearing: proposed 4th Street rezoning',
                    'Posted 5 August',
                  ),
                  noticeRow(
                    'Notice',
                    'Snow-route parking rules take effect across the North Ward',
                    'Posted 4 August',
                  ),
                  noticeRow(
                    'RFP',
                    'Bid posting: street resurfacing program (RFP-27-014)',
                    'Posted 2 August',
                  ),
                  noticeRow(
                    'Agenda',
                    'City Council regular meeting agenda — 12 August, 6:00pm',
                    'Posted 1 August',
                  ),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** A plain section heading band, for the label over the bound live news feed. */
function headingBand(heading: string, lead: string): Node {
  return el('section', 'bg-base-100 @container px-6 pt-10 pb-2', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-3', {
        children: [
          el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
            text: heading,
          }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', { text: lead }),
        ],
      }),
    ],
  });
}

const HOME: Node[] = [
  heroBand(),
  servicesDirectory(),
  noticesBand(),
  headingBand('City news & updates', 'Announcements and service changes from City Hall.'),
  blogPostGrid(),
  // The content→commerce bridge: the city's own shop, as a live carousel.
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'Publications & Passes' }),
];

// ── The bespoke article page (a news post / public-notice writeup) ────────────────
// A plain-language civic writeup: the rubric (News / Notice / Press Release) over the
// headline, a real byline (the issuing office/official + date), the lead image, the body,
// and an issuing-office card at the foot. Every bound field resolves against the routed
// post (the `article.ts` kit's `repeat('blog_post')` scope).

/** The article MASTHEAD — authored UNSCOPED; `articlePage` wraps it in `repeat('blog_post')`. */
function articleMasthead(): Node {
  return el('section', 'bg-base-200 @container px-6 pt-12 pb-14 @2xl:pt-16', {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-5', {
        children: [
          el('a', 'inline-flex w-fit items-center gap-2 text-lg font-semibold text-primary', {
            attrs: { href: '/journal' },
            children: [
              el('span', undefined, { text: '←' }),
              el('span', undefined, { text: 'All news & notices' }),
            ],
          }),
          // The rubric — bound to the post's category (News / Notice / Press Release).
          articleRubric('text-sm font-semibold uppercase tracking-wide text-primary'),
          articleTitle(
            'h1',
            'text-4xl font-bold leading-tight tracking-tight text-primary @2xl:text-5xl',
          ),
          articleStandfirst('max-w-2xl text-xl leading-relaxed text-base-content'),
          // The byline row — issuing office portrait, name, and posted date.
          el('div', 'mt-2 flex items-center gap-3', {
            children: [
              articleAuthorAvatar('h-11 w-11 rounded-full border border-base-300 object-cover'),
              el('div', 'flex flex-col', {
                children: [
                  articleAuthorName('text-base font-semibold text-base-content'),
                  articleDate('text-sm font-medium text-base-content'),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** The lead image band, at the article measure. */
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

/** The issuing-office card at the foot — portrait, name, and what the office does. Gated on
 *  the author bio, so it appears only when the post names an issuing office. */
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
          el('h1', 'text-4xl font-bold leading-tight tracking-tight text-primary @3xl:text-6xl', {
            text: 'City news & notices',
          }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Announcements, service changes, and the public record from the City of Rivermark, in plain language, newest first.',
          }),
        ],
      }),
    ],
  }),
];

// ── About + Contact (Rivermark-voiced) ────────────────────────────────────────────

const ABOUT: Node[] = [
  el('section', 'bg-base-100 @container px-6 py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-6', {
        children: [
          el('h1', 'text-4xl font-bold tracking-tight text-primary @2xl:text-5xl', {
            text: 'About the City of Rivermark',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Rivermark is a mid-size city of roughly 118,000 residents on the west bank of the Clearwater River. This site is the front door to city government: the services residents use, the meetings that decide how the city is run, and the notices we are required to publish.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We built this portal around one idea — that finding a city service should not require knowing which department owns it. Everything here is written in plain language, tested against accessibility standards, and organized around the tasks residents actually come to do.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'City Hall is at 200 Riverside Plaza and is open Monday through Friday, 8:00am to 5:00pm. Council meetings are open to the public and streamed live; agendas are posted at least 72 hours in advance under Public notices.',
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
    heading: 'Contact the city',
    intro: 'Reach City Hall at 200 Riverside Plaza, Monday through Friday, 8:00am to 5:00pm. For a non-emergency issue — a pothole, a streetlight, a missed pickup — the fastest route is the online service request, staffed during business hours. In an emergency, always call 911.',
    submitLabel: 'Email the city help desk',
  }),
];

// ── Light commerce (the city shop — a publication and two passes) ─────────────────

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
    handle: 'rivermark-resident-guide',
    title: 'Rivermark Resident Guide 2026',
    description:
      'The printed guide to living in Rivermark: every city service, the recycling and yard-waste calendar, park and facility hours, and who to call for what. 64 pages, mailed to your door.',
    status: 'active',
    productType: 'Publication',
    vendor: 'City of Rivermark',
    tags: ['publication', 'guide'],
    categoryHandles: ['publications'],
    collectionHandles: ['featured'],
    seoTitle: 'Rivermark Resident Guide 2026 — City of Rivermark',
    seoDescription:
      'The printed guide to city services, the waste calendar, and facility hours, mailed to your door.',
    variants: [
      { sku: 'RVM-PUB-GUIDE26', priceCents: money(12), isDefault: true, inventoryPolicy: 'continue' },
    ],
    images: [{ assetId: 'pub-city-guide', isPrimary: true, alt: 'The Rivermark Resident Guide 2026' }],
  },
  {
    handle: 'monthly-transit-pass',
    title: 'Monthly Transit Pass',
    description:
      'Unlimited rides on every Rivermark Transit bus route for one calendar month. Tap to board — no exact change needed. Reduced-fare pricing is available for seniors and students at any transit center.',
    status: 'active',
    productType: 'Pass',
    vendor: 'City of Rivermark',
    tags: ['pass', 'transit'],
    categoryHandles: ['passes'],
    collectionHandles: ['featured'],
    seoTitle: 'Monthly Transit Pass — Rivermark Transit',
    seoDescription: 'Unlimited rides on every Rivermark Transit bus route for one calendar month.',
    variants: [
      { sku: 'RVM-PASS-TRANSIT', priceCents: money(45), isDefault: true, inventoryPolicy: 'continue' },
    ],
    images: [{ assetId: 'pass-transit', isPrimary: true, alt: 'A Rivermark Transit bus at a stop' }],
  },
  {
    handle: 'annual-parks-pass',
    title: 'Annual Parks Pass',
    description:
      'A full year of parking and entry at every Rivermark park, trailhead, and boat launch, plus discounted shelter reservations. One pass covers a household and hangs from your mirror.',
    status: 'active',
    productType: 'Pass',
    vendor: 'City of Rivermark',
    tags: ['pass', 'parks'],
    categoryHandles: ['passes'],
    collectionHandles: ['featured'],
    seoTitle: 'Annual Parks Pass — City of Rivermark',
    seoDescription:
      'A year of parking and entry at every Rivermark park, trailhead, and boat launch for a household.',
    variants: [
      { sku: 'RVM-PASS-PARKS', priceCents: money(30), isDefault: true, inventoryPolicy: 'continue' },
    ],
    images: [{ assetId: 'pass-parks', isPrimary: true, alt: 'A wooded trail in a Rivermark park' }],
  },
];

const COMMERCE = {
  categories: [
    {
      handle: 'publications',
      name: 'Publications',
      description: 'Printed guides and reports from the city.',
      featured: true,
    },
    {
      handle: 'passes',
      name: 'Passes',
      description: 'Transit and parks passes for residents.',
      featured: true,
    },
  ],
  collections: [
    {
      handle: 'featured',
      name: 'Featured',
      description: 'The passes and publications residents ask for most.',
      type: 'manual',
      featured: true,
      productHandles: ['rivermark-resident-guide', 'monthly-transit-pass', 'annual-parks-pass'],
    },
  ],
  products: PRODUCTS,
};

// ── The masthead (issuing offices + officials) ────────────────────────────────────
// The byline personas the posts reference by `authorSlug`. On a civic site the byline is
// the ISSUING OFFICE, not a reporter — a communications office plus two named officials.
// The installer seeds these as CMS `Author` rows scoped to the site, and the storefront
// byline projection resolves them onto the bespoke article page.

const AUTHORS = [
  {
    slug: 'communications-office',
    displayName: 'Office of Communications',
    bio: 'The City of Rivermark Office of Communications issues city announcements, service changes, and press releases, and keeps this portal current across every department.',
    avatarAssetId: 'office-comms',
  },
  {
    slug: 'mayor-elena-ruiz',
    displayName: 'Office of Mayor Elena Ruiz',
    bio: 'Elena Ruiz is the Mayor of Rivermark, elected in 2024. The Mayor’s Office leads the annual budget, the city’s strategic priorities, and its work with residents and regional partners.',
    avatarAssetId: 'official-mayor',
  },
  {
    slug: 'city-clerk',
    displayName: 'Office of the City Clerk',
    bio: 'David Okafor is the Rivermark City Clerk. The Clerk’s Office keeps the public record, posts meeting agendas and legal notices, runs municipal elections, and fills public-records requests.',
    avatarAssetId: 'official-clerk',
  },
];

// ── Content (the city news + notices) ─────────────────────────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });

const CONTENT = [
  {
    typeKey: 'blog_post',
    slug: 'riverside-bridge-lane-closure',
    status: 'published',
    authorSlug: 'communications-office',
    categories: ['News'],
    tags: ['Roads', 'Public Works'],
    body: {
      title: 'Riverside Bridge lane closure begins Monday',
      excerpt:
        'One southbound lane of the Riverside Bridge closes Monday for deck repairs expected to last three weeks. Plan for delays during the morning commute.',
      featuredImage: { $asset: 'news-roads' },
      body: {
        type: 'doc',
        content: [
          para(
            'Starting Monday, Public Works will close the outermost southbound lane of the Riverside Bridge to replace worn expansion joints and resurface the deck. The work is scheduled to run for about three weeks, weather permitting, and the bridge will stay open to traffic the entire time.',
          ),
          h2('What to expect'),
          para(
            'Expect the heaviest delays between 7:00 and 9:00 in the morning, when a single southbound lane carries the full commute. Northbound lanes are not affected. Drivers who can shift their trip earlier or later, or use the 9th Street bridge, will save the most time.',
          ),
          h2('Why now'),
          para(
            'The joints being replaced were flagged in the city’s last bridge inspection and are the kind of repair that gets far more expensive if it waits. Doing the work now, in dry late-summer weather, lets the new surface cure properly before the first freeze.',
          ),
          para(
            'Real-time detour information is posted under Schedules & road detours, and message boards on the approaches will show current lane status.',
          ),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'council-adopts-fy27-budget',
    status: 'published',
    authorSlug: 'mayor-elena-ruiz',
    categories: ['Press Release'],
    tags: ['Budget', 'City Council'],
    body: {
      title: 'City Council adopts the FY27 budget',
      excerpt:
        'The Council approved a $214 million budget for the coming year, holding the property-tax rate flat while funding road repair, transit, and a new after-school program.',
      featuredImage: { $asset: 'news-council' },
      body: {
        type: 'doc',
        content: [
          para(
            'On Tuesday evening the City Council voted 6–1 to adopt the fiscal-year 2027 budget, a $214 million plan that takes effect on October 1. The rate residents pay in city property taxes stays exactly where it is for the third year running.',
          ),
          h2('Where the money goes'),
          para(
            'The largest new commitment is $18 million for road and bridge repair, front-loading a backlog the city has been chipping away at for years. Transit keeps its expanded weekend service, and a new after-school program will open at four community centers in the spring.',
          ),
          h2('How it was decided'),
          para(
            'The budget followed three public hearings and an online comment period that drew more than 400 responses. Residents asked, above all, for the roads to be fixed and for transit to keep its weekend hours — both of which the adopted budget funds.',
          ),
          para(
            'The full adopted budget, including every department’s detail, is posted under Public notices for anyone who wants to read it line by line.',
          ),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'boil-water-advisory-lifted-highlands',
    status: 'published',
    authorSlug: 'city-clerk',
    categories: ['Notice'],
    tags: ['Water', 'Utilities'],
    body: {
      title: 'Boil-water advisory lifted for the Highlands',
      excerpt:
        'Testing has cleared the water supply in the Highlands neighborhood. Residents no longer need to boil water before drinking or cooking.',
      featuredImage: { $asset: 'news-water' },
      body: {
        type: 'doc',
        content: [
          para(
            'The precautionary boil-water advisory issued last Thursday for the Highlands neighborhood is now lifted. Two consecutive rounds of testing came back clear, and Water & Utilities has confirmed the supply is safe for drinking, cooking, and every other use.',
          ),
          h2('What happened'),
          para(
            'A water main break near Highland Avenue dropped pressure in the local system, which can let contaminants in. Whenever that happens, the city issues a boil-water advisory as a precaution while crews repair the line and testing confirms the water is safe — which it now has.',
          ),
          h2('What to do now'),
          para(
            'You can resume normal use immediately. As a routine step after any advisory, run each cold-water tap for one minute before drinking, replace any filter cartridges, and empty and refill automatic ice makers once.',
          ),
          para(
            'Residents with questions can reach Water & Utilities through the city help desk during business hours.',
          ),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'summer-parks-program-registration-opens',
    status: 'published',
    authorSlug: 'communications-office',
    categories: ['News'],
    tags: ['Parks', 'Recreation'],
    body: {
      title: 'Summer parks program registration opens',
      excerpt:
        'Registration for summer camps, swim lessons, and sports leagues opens next week, with reduced-fee and scholarship spots reserved for every program.',
      featuredImage: { $asset: 'news-parks' },
      body: {
        type: 'doc',
        content: [
          para(
            'Parks & Recreation opens registration for its full slate of summer programs next Monday: day camps, learn-to-swim lessons, youth and adult sports leagues, and the popular nature series at Cedar Ridge. Programs run from mid-June through August.',
          ),
          h2('Reserved and reduced-fee spots'),
          para(
            'Every program holds a share of its spots for reduced-fee and scholarship registration, and no eligible child is turned away for cost. Households already enrolled in city assistance are pre-qualified; anyone else can apply in the same registration step.',
          ),
          h2('How to register'),
          para(
            'Registration is online through Program & class registration, or in person at any community center with help from staff. Popular camps fill quickly, so it is worth setting a reminder for opening morning.',
          ),
          para(
            'An annual parks pass, which covers parking and entry at every park and trailhead, is available in the city shop.',
          ),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'library-extends-weekend-hours',
    status: 'published',
    authorSlug: 'communications-office',
    categories: ['News'],
    tags: ['Library'],
    body: {
      title: 'The public library extends its weekend hours',
      excerpt:
        'Starting this month, all three Rivermark library branches stay open later on Saturdays and add Sunday afternoon hours, funded in the new budget.',
      featuredImage: { $asset: 'news-library' },
      body: {
        type: 'doc',
        content: [
          para(
            'All three branches of the Rivermark Public Library are expanding their weekend hours this month. Saturday hours now run until 6:00pm, and every branch adds a Sunday afternoon session from 1:00 to 5:00 — the first regular Sunday hours the system has offered in over a decade.',
          ),
          h2('What the extra hours cover'),
          para(
            'The added time is not just for browsing. Weekend hours now include the after-school homework help desk, open computer and printing access, and the meeting rooms residents and small groups can book at no cost.',
          ),
          h2('Made possible by the budget'),
          para(
            'The expansion is funded in the fiscal-year 2027 budget the Council just adopted, after weekend access came up repeatedly during the public comment period. It is a direct example of a budget line that started as resident feedback.',
          ),
          para('Branch locations and full hours are listed in the Rivermark Resident Guide.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'civic-portal',
  key: 'sparx-civic-portal',
  name: 'Civic Portal',
  summary:
    'An accessibility-first portal for a city or public agency — a clear welcome band, a task-first services directory, a state-aware public-notices and alerts channel, a live news feed, and a light civic shop, in a white-ground deep-federal-blue theme tuned for AAA contrast. Modelled on the government/public-service archetype; shipped as the City of Rivermark. Ships a light shop (a city publication, two passes) to demonstrate content + commerce together.',
  tagline: 'An accessibility-first template for a city, agency, or public institution.',
  vertical: 'content',
  industry: 'City & public services',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 100,
  brand: {
    businessName: 'City of Rivermark',
    tagline: 'Your city, online.',
  },
  // A brand-left header, no marketing CTA (a civic site leads with services, not a "Sign up"),
  // and a columns footer whose bottom bar carries the live © business name.
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: false },
  seo: {
    home: {
      title: 'City of Rivermark — services, news, and notices',
      description:
        'The official portal for the City of Rivermark: pay a bill, apply for a permit, find a meeting, report an issue, and read city news and public notices — all in one place.',
    },
    about: {
      title: 'About the City of Rivermark',
      description:
        'Who the City of Rivermark serves and how this portal is organized — plain-language, accessibility-first city government built around the tasks residents actually do.',
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
