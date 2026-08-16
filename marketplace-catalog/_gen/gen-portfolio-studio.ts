// sparx-portfolio-studio — the STUDIO / ARCHITECT portfolio (codename Atlas).
//
// The "hire-me" portfolio for an architect & spatial designer: range shown with precision.
// A statement hero pairing a precise architectural-grotesk claim with a large-format project
// image, a STRUCTURED grid of big project tiles, a sober "practice / capabilities" band, and
// project SHEETS that read like an architect's index card — a discipline rubric, a facts lead
// (Year / Role / Location / Scope), then the narrative of the site, the idea and the making.
// Dressed in the bespoke `atlas` theme (a bone/concrete chassis carried by one burnt-amber
// signal and a cool slate for the facts). Disciplined neutrality is the whole point — the
// large-format work is the color, the chassis stays quiet.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `portfolio-sites/harness.ts`; the project (case-study) page's DATA plumbing lives in the
// shared `template-sites/article.ts` kit (a project is a `cms.blog_post` record — see the
// harness header for why). Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-portfolio-studio.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-portfolio-studio/**" \
//     "marketplace-catalog/_gen/gen-portfolio-studio.ts"
//
// LIGHT THEME, SEMANTIC TOKENS ONLY. `atlas` is a concrete/bone page (`bg-base-100`), ink is
// near-black (`text-base-content`); the ONE signal is burnt amber (`text-primary` /
// `btn-primary`) on the CTA, the active category and the project year, with a cool slate
// (`text-accent`) reserved for the facts. No hardcoded colors — surfaces separate by a
// `bg-base-200` shift + a hairline border, never a gradient or a shadow.
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
    "atlas-hero": "https://images.unsplash.com/photo-1532888277436-2286814f0ee1?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bW9kZXJuJTIwY29uY3JldGUlMjBnbGFzcyUyMGJ1aWxkaW5nJTIwZHVzayUyMGFyY2hpdGVjdHVyZXxlbnwwfDB8fHwxNzg2Mzk5ODMyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "atlas-mirador": "https://images.unsplash.com/photo-1631645033513-15144f920557?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29uY3JldGUlMjBob3VzZSUyMGhpbGxzaWRlJTIwbW9kZXJuJTIwYXJjaGl0ZWN0dXJlfGVufDB8MHx8fDE3ODYzOTk4MzV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "atlas-civic": "https://images.unsplash.com/photo-1627397159237-d2acb7f500af?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2l2aWMlMjBidWlsZGluZyUyMGNvbG9ubmFkZSUyMGFyY2hpdGVjdHVyZXxlbnwwfDB8fHwxNzg2Mzk5ODM5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "atlas-foundry": "https://images.unsplash.com/photo-1565610222536-ef125c59da2e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29udmVydGVkJTIwaW5kdXN0cmlhbCUyMGJ1aWxkaW5nJTIwZ2FsbGVyeSUyMGludGVyaW9yfGVufDB8MHx8fDE3ODYzOTk4NDJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "atlas-meridian": "https://images.unsplash.com/photo-1556761175-4b46a572b786?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8b2ZmaWNlJTIwaW50ZXJpb3IlMjBvYWslMjBnbGF6ZWQlMjB3b3JrcGxhY2V8ZW58MHwwfHx8MTc4NjM5OTg0NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "atlas-portrait": "https://images.unsplash.com/photo-1676989880361-091e12efc056?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YXJjaGl0ZWN0JTIwcG9ydHJhaXQlMjBwcm9mZXNzaW9uYWx8ZW58MHwwfHx8MTc4NjM5OTg0OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string =>
    PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
    id: string;
    url: string;
    alt: string;
}

const ASSETS: Asset[] = [
    { id: 'atlas-hero', url: src('atlas-hero'), alt: 'A large-format concrete-and-glass building at dusk, seen from a low corner' },
    { id: 'atlas-mirador', url: src('atlas-mirador'), alt: 'A hillside house of board-formed concrete opening to a terraced garden' },
    { id: 'atlas-civic', url: src('atlas-civic'), alt: 'A civic hall with a deep colonnade and a wide public forecourt' },
    { id: 'atlas-foundry', url: src('atlas-foundry'), alt: 'A converted industrial foundry, its steel roof trusses left exposed above a gallery' },
    { id: 'atlas-meridian', url: src('atlas-meridian'), alt: 'A daylit workplace interior with oak joinery and a full-height glazed wall' },
    { id: 'atlas-portrait', url: src('atlas-portrait'), alt: 'Portrait of Nadia Rehman, architect and spatial designer' },
];

const assetUrl = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-portfolio-studio: unknown asset "${id}"`);
    return a.url;
};

// ── Home page bands ────────────────────────────────────────────────────────────────

/** The STATEMENT hero — a precise architectural-grotesk claim and a one-line what-I-do over a
 *  large-format project image. The type carries the room; the image proves the range. Two
 *  actions, amber on the primary; a slate-keyed facts strip anchors the practice. */
function heroBand(): Node {
    return el('section', 'bg-base-100 @container px-6 pt-20 pb-16 @3xl:pt-28', {
        children: [
            el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-12', {
                children: [
                    el('div', 'flex flex-col gap-6', {
                        children: [
                            el(
                                'h1',
                                'max-w-4xl text-5xl font-bold uppercase leading-none tracking-tight text-base-content @2xl:text-7xl @3xl:text-8xl',
                                { text: 'Buildings and spaces that know why they exist.' }
                            ),
                            el('p', 'max-w-2xl text-xl leading-relaxed text-base-content @2xl:text-2xl', {
                                text: 'I’m Nadia Rehman — an architect and spatial designer working across homes, civic buildings, cultural spaces and workplaces. Every project starts with the question of what the place is for, and holds that answer from the first sketch to the last detail.',
                            }),
                            el('div', 'flex flex-wrap items-center gap-3', {
                                children: [
                                    el('a', 'btn btn-primary btn-lg', { attrs: { href: '/work' }, text: 'See the work' }),
                                    el('a', 'btn btn-neutral btn-outline btn-lg', {
                                        attrs: { href: '/about' },
                                        text: 'About the practice',
                                    }),
                                ],
                            }),
                        ],
                    }),
                    // The large-format proof — one wide image, hairline-framed, no flourish.
                    el('div', 'overflow-hidden rounded-box border border-base-300', {
                        children: [
                            el('img', 'aspect-video w-full object-cover', {
                                attrs: {
                                    src: assetUrl('atlas-hero'),
                                    alt: 'A large-format concrete-and-glass building at dusk, seen from a low corner',
                                    loading: 'lazy',
                                },
                            }),
                        ],
                    }),
                    // A slate-keyed facts strip — the practice at a glance. Keys in the readable
                    // secondary micro-label ink, values in the cool slate accent (the facts color).
                    el('div', 'grid gap-6 border-t border-base-300 pt-8 @md:grid-cols-3', {
                        children: [
                            factCell('Practice', 'Rehman Studio, since 2014'),
                            factCell('Based', 'Lisbon, working internationally'),
                            factCell('Fields', 'Residential · Civic · Cultural · Workplace'),
                        ],
                    }),
                ],
            }),
        ],
    });
}

/** One key/value fact — a slate value under a secondary micro-label key. The facts-column
 *  idiom the whole portfolio leans on: keys in `text-secondary`, values in `text-accent`. */
function factCell(key: string, value: string): Node {
    return el('div', 'flex flex-col gap-1', {
        children: [
            el('span', 'text-sm font-semibold uppercase tracking-wide text-secondary', { text: key }),
            el('span', 'text-lg font-semibold leading-snug text-accent', { text: value }),
        ],
    });
}

/** One project TILE — a big aspect-video image over a meta row (category + year, both in the
 *  amber signal) and an architectural-grotesk title. The whole tile links to the project
 *  sheet; its border lifts to amber on hover. */
function projectTile(opts: {
    img: string;
    alt: string;
    category: string;
    year: string;
    title: string;
    href: string;
}): Node {
    return el(
        'a',
        'group block overflow-hidden rounded-box border border-base-300 bg-base-100 transition hover:border-primary',
        {
            attrs: { href: opts.href },
            children: [
                el('img', 'aspect-video w-full object-cover', {
                    attrs: { src: assetUrl(opts.img), alt: opts.alt, loading: 'lazy' },
                }),
                el('div', 'flex flex-col gap-3 p-6', {
                    children: [
                        el('div', 'flex items-baseline justify-between gap-4', {
                            children: [
                                el('span', 'text-sm font-semibold uppercase tracking-wide text-primary', {
                                    text: opts.category,
                                }),
                                el('span', 'text-sm font-semibold text-primary', { text: opts.year }),
                            ],
                        }),
                        el(
                            'h3',
                            'text-2xl font-bold uppercase leading-tight tracking-tight text-base-content @2xl:text-3xl',
                            { text: opts.title }
                        ),
                    ],
                }),
            ],
        }
    );
}

/** The structured project grid — a heading over a two-column grid of big project tiles. This
 *  is the portfolio's spine: the range shown at a glance, each tile a live link to its sheet. */
function projectGridBand(): Node {
    return el('section', 'bg-base-100 @container px-6 py-16 @3xl:py-24', {
        children: [
            el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-12', {
                children: [
                    el('div', 'flex flex-col gap-3', {
                        children: [
                            el(
                                'h2',
                                'text-3xl font-bold uppercase tracking-tight text-base-content @3xl:text-4xl',
                                { text: 'Selected projects' }
                            ),
                            el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                                text: 'Four recent buildings, one from each field the practice works in. Each opens to the full sheet — the site, the idea, and how it was made.',
                            }),
                        ],
                    }),
                    el('div', 'grid gap-8 @3xl:grid-cols-2', {
                        children: [
                            projectTile({
                                img: 'atlas-mirador',
                                alt: 'A hillside house of board-formed concrete opening to a terraced garden',
                                category: 'Residential',
                                year: '2026',
                                title: 'Casa Mirador',
                                href: '/blog/casa-mirador',
                            }),
                            projectTile({
                                img: 'atlas-civic',
                                alt: 'A civic hall with a deep colonnade and a wide public forecourt',
                                category: 'Civic',
                                year: '2025',
                                title: 'Riverside Civic Hall',
                                href: '/blog/riverside-civic-hall',
                            }),
                            projectTile({
                                img: 'atlas-foundry',
                                alt: 'A converted industrial foundry, its steel roof trusses left exposed above a gallery',
                                category: 'Cultural',
                                year: '2024',
                                title: 'Foundry Arts Centre',
                                href: '/blog/foundry-arts-centre',
                            }),
                            projectTile({
                                img: 'atlas-meridian',
                                alt: 'A daylit workplace interior with oak joinery and a full-height glazed wall',
                                category: 'Workplace',
                                year: '2025',
                                title: 'Meridian Workspace',
                                href: '/blog/meridian-workspace',
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });
}

/** The "practice / capabilities" band — four plain capability cards on a base-200 shift. No
 *  eyebrow; the heading carries it. What the practice actually does, stated soberly. */
function practiceBand(): Node {
    const card = (title: string, body: string): Node =>
        el('div', 'flex flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-8', {
            children: [
                el('h3', 'text-xl font-semibold uppercase tracking-tight text-base-content', {
                    text: title,
                }),
                el('p', 'text-base leading-relaxed text-base-content', { text: body }),
            ],
        });
    return el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-24', {
        children: [
            el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-10', {
                children: [
                    el(
                        'h2',
                        'max-w-3xl text-3xl font-bold uppercase tracking-tight text-base-content @3xl:text-4xl',
                        { text: 'One practice, from the masterplan to the door handle.' }
                    ),
                    el('div', 'grid gap-6 @md:grid-cols-2', {
                        children: [
                            card(
                                'Architecture',
                                'New buildings and thoughtful additions — houses, halls and cultural spaces designed from their structure and light out, not their surface in.',
                            ),
                            card(
                                'Interiors',
                                'The rooms people actually live and work in: materials, joinery, and the daylight that makes a plan feel inevitable once you are standing inside it.',
                            ),
                            card(
                                'Masterplanning',
                                'How a site holds more than one building — routes, thresholds and public space that make a place legible before a visitor has read a single sign.',
                            ),
                            card(
                                'Exhibition',
                                'Temporary and civic installations where the brief is a story, not a programme — pavilions and displays that teach a space how to be read.',
                            ),
                        ],
                    }),
                ],
            }),
        ],
    });
}

/** The closing CTA — a solid burnt-amber band inviting a first conversation. */
function contactCtaBand(): Node {
    return el('section', 'bg-primary @container px-6 py-20 text-center', {
        children: [
            el('div', 'mx-auto flex w-full max-w-2xl flex-col items-center gap-5', {
                children: [
                    el('h2', 'text-3xl font-bold uppercase tracking-tight text-primary-content @3xl:text-4xl', {
                        text: 'Have a site and a reason to build?',
                    }),
                    el('p', 'text-lg leading-relaxed text-primary-content', {
                        text: 'I take on a small number of projects at a time and stay close to each one. If yours has a real question at its centre, I’d like to hear about it.',
                    }),
                    el('a', 'btn btn-lg mt-2 bg-base-100 text-base-content', {
                        attrs: { href: '/contact' },
                        text: 'Start a project',
                    }),
                ],
            }),
        ],
    });
}

const HOME: Node[] = [heroBand(), projectGridBand(), practiceBand(), contactCtaBand()];

// ── Work index masthead (over the live, linkable project grid) ─────────────────────

const WORK: Node[] = [
    el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-20', {
        children: [
            el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-6', {
                children: [
                    el('div', 'flex flex-col gap-4', {
                        children: [
                            el(
                                'h1',
                                'text-5xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-7xl',
                                { text: 'Work' }
                            ),
                            el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                                text: 'Selected projects from the last few years, across the four fields the practice works in. Each sheet lays out the site, the idea, and how the building was made.',
                            }),
                        ],
                    }),
                    // The range framed by category — the four fields, each in the amber signal, as the
                    // taxonomy the grid below reads against.
                    el('div', 'flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-base-300 pt-6', {
                        children: [
                            el('span', 'text-sm font-semibold uppercase tracking-wide text-primary', { text: 'Residential' }),
                            el('span', 'text-sm font-semibold uppercase tracking-wide text-primary', { text: 'Civic' }),
                            el('span', 'text-sm font-semibold uppercase tracking-wide text-primary', { text: 'Cultural' }),
                            el('span', 'text-sm font-semibold uppercase tracking-wide text-primary', { text: 'Workplace' }),
                        ],
                    }),
                ],
            }),
        ],
    }),
];

// ── The bespoke project (case-study) SHEET ─────────────────────────────────────────
// An architect's index card: the discipline rubric (the category, in amber) over the project
// title, a standfirst, the byline (me + the date), a large featured image, then the written
// body — which OPENS with the facts lead (Year / Role / Location / Scope) before the narrative
// — and a card about me at the foot. Every bound field resolves against the routed project via
// the article kit's `repeat('blog_post')` scope.

function projectMasthead(): Node {
    return el('section', 'bg-base-100 @container px-6 pt-16 pb-12', {
        children: [
            el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-5', {
                children: [
                    el('a', 'inline-flex w-fit items-center gap-2 text-base font-semibold text-primary', {
                        attrs: { href: '/work' },
                        children: [
                            el('span', undefined, { text: '←' }),
                            el('span', undefined, { text: 'All work' }),
                        ],
                    }),
                    articleRubric('text-sm font-semibold uppercase tracking-wide text-primary'),
                    articleTitle(
                        'h1',
                        'text-4xl font-bold uppercase leading-tight tracking-tight text-base-content @2xl:text-6xl',
                    ),
                    articleStandfirst('max-w-2xl text-xl leading-relaxed text-base-content'),
                    el('div', 'mt-2 flex items-center gap-3', {
                        children: [
                            articleAuthorAvatar('h-11 w-11 rounded-full border border-base-300 object-cover'),
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

function projectImageBand(): Node {
    return el('section', 'bg-base-100 @container px-6 py-8', {
        children: [
            el('div', 'mx-auto w-full max-w-5xl', {
                children: [
                    articleFeaturedImage(
                        'aspect-video w-full rounded-box border border-base-300 bg-base-200 object-cover',
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
                        nameClass: 'text-lg font-semibold text-base-content',
                        bioClass: 'text-base leading-relaxed text-base-content',
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

// ── About + Contact (Nadia-voiced) ─────────────────────────────────────────────────

const ABOUT: Node[] = [
    el('section', 'bg-base-100 @container px-6 py-20', {
        children: [
            el('div', 'mx-auto grid w-full max-w-5xl gap-10 @3xl:grid-cols-3 @3xl:items-start', {
                children: [
                    el('div', 'flex flex-col gap-6 @3xl:col-span-2', {
                        children: [
                            el('h1', 'text-5xl font-bold uppercase tracking-tight text-base-content @2xl:text-6xl', {
                                text: 'About Nadia',
                            }),
                            el('p', 'text-lg leading-relaxed text-base-content', {
                                text: 'I’m an architect and spatial designer, and I run a small practice out of Lisbon. For over a decade I’ve worked across scales — a single house, a civic hall, the reuse of an old foundry, a workplace fit-out — and the thread through all of it is a stubborn interest in why a place exists before what it looks like.',
                            }),
                            el('p', 'text-lg leading-relaxed text-base-content', {
                                text: 'I keep the studio deliberately small so I can stay on the drawing and on site. That means the person you brief is the person who resolves the junction detail, and it means every project is designed from its structure, light and use outward — not decorated after the fact.',
                            }),
                            el('p', 'text-lg leading-relaxed text-base-content', {
                                text: 'Before founding the studio I worked at two international practices on cultural and civic buildings, and I still teach a design studio one term a year. I take on a handful of projects at a time, and I care most about the parts a photograph never shows — the threshold, the section, the way a room meets the light at four in the afternoon.',
                            }),
                            // A selected-clients line — collaborators, not logos (no third-party marks).
                            el('div', 'flex flex-col gap-3 border-t border-base-300 pt-6', {
                                children: [
                                    el('span', 'text-sm font-semibold uppercase tracking-wide text-secondary', {
                                        text: 'Selected clients & collaborators',
                                    }),
                                    el('div', 'flex flex-wrap gap-x-8 gap-y-2', {
                                        children: [
                                            el('span', 'text-base font-semibold text-base-content', { text: 'City of Porto' }),
                                            el('span', 'text-base font-semibold text-base-content', { text: 'Fundação Aramar' }),
                                            el('span', 'text-base font-semibold text-base-content', { text: 'Meridian Group' }),
                                            el('span', 'text-base font-semibold text-base-content', { text: 'Casa do Vale' }),
                                            el('span', 'text-base font-semibold text-base-content', { text: 'Bilbao Arts Trust' }),
                                        ],
                                    }),
                                ],
                            }),
                        ],
                    }),
                    el('div', 'flex flex-col gap-6', {
                        children: [
                            el('img', 'aspect-square w-full rounded-box border border-base-300 object-cover', {
                                attrs: {
                                    src: assetUrl('atlas-portrait'),
                                    alt: 'Portrait of Nadia Rehman, architect and spatial designer',
                                    loading: 'lazy',
                                },
                            }),
                            // The practice at a glance — a slate-keyed facts column.
                            el('div', 'flex flex-col gap-4 rounded-box border border-base-300 bg-base-200 p-6', {
                                children: [
                                    factCell('Founded', '2014, Lisbon'),
                                    factCell('Team', 'Six architects & designers'),
                                    factCell('Registration', 'Ordem dos Arquitectos'),
                                    factCell('Capabilities', 'Architecture · Interiors · Masterplanning · Exhibition'),
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
        heading: 'Start a project',
        intro: [
            'I’m taking on a small number of new projects. A good first enquiry tells me the site or building, who it’s for, roughly what you hope to do, and when you’d like to start — but if you only have a plot and an idea, that’s a fine place to begin too.',
            'I’ll usually reply within a few days to say whether it’s a good fit and to suggest a first conversation. New work generally begins two to three months out.',
        ],
        submitLabel: 'Email the studio',
        secondary: { label: 'See the work first', href: '/work' },
    }),
];

// ── The author (the byline persona) ─────────────────────────────────────────────────

const AUTHORS = [
    {
        slug: 'nadia-rehman',
        displayName: 'Nadia Rehman',
        bio: 'Nadia Rehman is an architect and spatial designer, and the founder of Rehman Studio in Lisbon. She works across houses, civic buildings, cultural spaces and workplaces — from the masterplan to the door handle — and still teaches a design studio one term a year.',
        avatarAssetId: 'atlas-portrait',
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
        slug: 'casa-mirador',
        status: 'published',
        authorSlug: 'nadia-rehman',
        categories: ['Residential'],
        tags: ['House', 'Board-formed concrete'],
        body: {
            title: 'Casa Mirador',
            excerpt:
                'A hillside house that treats the view as a room you earn — board-formed concrete anchored to the slope, opening only where the landscape asks it to.',
            featuredImage: { $asset: 'atlas-mirador' },
            body: {
                type: 'doc',
                content: [
                    para('Year 2026 · Role Lead architect · Location Lisbon · Scope Full design, concept to completion.'),
                    para('Casa Mirador is a family house on a steep south-facing slope above the Tagus. The clients had lived with the view from a caravan on the plot for two summers before they briefed it, so they knew exactly which minutes of the day mattered — and they did not want a glass box that surrendered all of them at once.'),
                    h2('The site'),
                    para('The slope falls nearly a full storey across the footprint, and the best light arrives late and low. Rather than cut a flat pad and perch a house on it, we let the building step with the ground — three half-levels tied to a single board-formed concrete spine that does the structural work and the retaining at once.'),
                    para('The concrete is not a finish choice so much as a site strategy: the same wall that holds the hill back becomes the thermal mass that carries the house through a hot afternoon and a cool night with almost no mechanical help.'),
                    h2('The idea'),
                    para('The house withholds the view and then gives it. You arrive at the top, in shadow, against solid concrete; the landscape is entirely hidden. Only as you descend through the plan does the wall open — first a slot, then a room, then the full terrace where the whole valley is finally in front of you. The view is the reward at the end of the sequence, not the first thing you see.'),
                    h2('The making'),
                    para('Board-formed concrete is unforgiving — every joint and tie is permanent — so we built a full-height sample panel on site and cast three test pours before the first real wall. The timber boards were milled from a single batch to keep the grain consistent, and the crew poured in the early morning to slow the cure. What you read as a quiet monolith is the product of a very loud few weeks of getting it exactly right.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'riverside-civic-hall',
        status: 'published',
        authorSlug: 'nadia-rehman',
        categories: ['Civic'],
        tags: ['Public building', 'Colonnade'],
        body: {
            title: 'Riverside Civic Hall',
            excerpt:
                'A public hall built around its threshold — a deep colonnade and a generous forecourt that make the building legible as everyone’s before anyone reads the sign.',
            featuredImage: { $asset: 'atlas-civic' },
            body: {
                type: 'doc',
                content: [
                    para('Year 2025 · Role Design lead · Location Porto · Scope Architecture & public realm.'),
                    para('Riverside Civic Hall replaces a tired municipal annexe on the riverfront with a building that had to do an unusual amount of civic work: register offices, a council chamber, a public exhibition floor, and — the part the brief kept coming back to — somewhere the city could simply gather. Won in open competition for the City of Porto.'),
                    h2('The site'),
                    para('The plot sits between a busy embankment road and the water, on ground that floods in the worst winters. We lifted the occupied floors a full storey and gave the flood level back to the city as a sheltered, hard-wearing public room — a deep colonnade that runs the length of the building and a forecourt that steps down to the quay.'),
                    h2('The idea'),
                    para('A civic building earns its name at the threshold, not in the chamber. So the whole design argument is the edge: the colonnade is deliberately oversized, deep enough to hold a market, a protest or a wedding party, and it belongs to the street whether or not the offices behind it are open. You are inside the building, under its roof and among its columns, before you have decided to enter it.'),
                    para('Above that public base, the offices and chamber are calm and frankly ordinary — good daylight, plain materials, nothing shouting. The generosity is spent where the public actually is.'),
                    h2('The making'),
                    para('The colonnade is precast concrete, its columns cast off site to a tolerance we could never have hit in a flood-prone excavation, then stitched to an in-situ deck. Getting the column rhythm right took the longest: too wide and the forecourt felt exposed, too tight and it read as a fence. We mocked up three full bays at scale on the quay before we committed.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'foundry-arts-centre',
        status: 'published',
        authorSlug: 'nadia-rehman',
        categories: ['Cultural'],
        tags: ['Adaptive reuse', 'Gallery'],
        body: {
            title: 'Foundry Arts Centre',
            excerpt:
                'A disused iron foundry turned arts centre — the old shed kept honest and legible, a new gallery inserted as a clearly separate, quiet room inside it.',
            featuredImage: { $asset: 'atlas-foundry' },
            body: {
                type: 'doc',
                content: [
                    para('Year 2024 · Role Project architect · Location Bilbao · Scope Adaptive reuse & interiors.'),
                    para('The Foundry was a nineteenth-century iron works that had sat empty for thirty years — a magnificent riveted-steel shed with a leaking roof and a floor that had reverted to weeds. The Bilbao Arts Trust wanted a home for exhibitions and residencies that felt found, not built, and could not afford to erase what was already there.'),
                    h2('The site'),
                    para('The shed’s value was entirely in its structure: the exposed roof trusses, the travelling crane rail, the scale of a space built to move molten iron. Everything else — later partitions, a mezzanine, decades of accreted services — was noise. The first six weeks on site were mostly subtraction, taking the building back to the frame that mattered.'),
                    h2('The idea'),
                    para('We resisted the obvious move of climate-controlling the whole volume, which would have meant sealing and lining the very structure worth keeping. Instead the gallery is a building-within-a-building: a calm, sealed, precisely conditioned room set down inside the shed like a piece of equipment, leaving the trusses and the crane rail in raw, un-heated air around it.'),
                    para('So the visitor reads two things at once and never confuses them — the honest industrial shell, and the quiet new room the art actually lives in. The old and the new touch as little as possible and are never dressed up to match.'),
                    h2('The making'),
                    para('The inserted gallery is a steel-framed box on its own foundations, structurally independent of the fragile old frame, which let us survey and stabilise the trusses without a deadline hanging over the conservation work. The junction where new meets old is a deliberate shadow gap — a finger’s width of daylight that says, plainly, these are two different buildings.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'meridian-workspace',
        status: 'published',
        authorSlug: 'nadia-rehman',
        categories: ['Workplace'],
        tags: ['Workplace', 'Joinery'],
        body: {
            title: 'Meridian Workspace',
            excerpt:
                'A workplace fit-out built on daylight and oak instead of open-plan sprawl — a floor of real rooms that give a small company room to think.',
            featuredImage: { $asset: 'atlas-meridian' },
            body: {
                type: 'doc',
                content: [
                    para('Year 2025 · Role Lead architect · Location Lisbon · Scope Workplace & fit-out.'),
                    para('Meridian is a forty-person research group that had outgrown a generic open-plan floor where nobody could hear themselves think. The brief was not more desks; it was a place that could hold quiet, concentrated work and still bring the whole group together without a scramble for the one bookable room.'),
                    h2('The site'),
                    para('A single deep floor with glazing on two sides and a dead, dark core — the classic office problem. The whole design turns on getting daylight into the middle: we pulled the enclosed rooms away from the windows and into the core, so the good light stays shared and the desks all sit within reach of a real window.'),
                    h2('The idea'),
                    para('Open-plan promises flexibility and mostly delivers noise. We gave Meridian a floor of actual rooms instead — a graded set, from a silent focus room to a big table that seats everyone — arranged so you can find the right amount of company for the task in hand without booking anything. The building does the acoustic work so people don’t have to negotiate it.'),
                    h2('The making'),
                    para('The rooms are defined by a single system of white-oak joinery — the same detail language for a door, a storage wall and a glazed partition — fabricated off site and installed in ten days over a holiday shutdown so the team never lost a working week. Because one detail repeats everywhere, the floor reads as calm and whole rather than fitted-out in pieces.'),
                ],
            },
        },
    },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: PortfolioSiteSpec = {
    slug: 'portfolio-studio',
    key: 'sparx-portfolio-studio',
    name: 'Studio / Architect Portfolio',
    summary:
        'A hire-me portfolio for an architect & spatial designer: a statement hero over a large-format project image, a structured grid of project tiles, a sober practice band, and project sheets that open with the facts — Year, Role, Location, Scope — then tell the site, the idea and the making. Range shown with precision. Dressed in a bone-and-concrete theme carried by one burnt-amber signal and a cool slate for the facts. Shipped as Nadia Rehman.',
    tagline: 'A facts-driven portfolio for an architect & spatial designer.',
    industry: 'Architect & spatial designer',
    requiresModules: ['builder', 'cms', 'email'],
    sortWeight: 85,
    brand: {
        businessName: 'Nadia Rehman',
        tagline: 'Buildings and spaces that know why they exist.',
    },
    // A plain brand-left header with a filled "Start a project" CTA, over the columns footer
    // whose bottom bar carries the live © name and the tenant's published legal links.
    chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
    seo: {
        home: {
            title: 'Nadia Rehman — architect & spatial designer',
            description:
                'Nadia Rehman is an architect and spatial designer in Lisbon working across homes, civic buildings, cultural spaces and workplaces — selected work, project sheets, and how to start a project.',
        },
        about: {
            title: 'About Nadia Rehman — architect & spatial designer',
            description:
                'A small Lisbon practice working from the masterplan to the door handle across residential, civic, cultural and workplace projects — the person, the approach, and the studio at a glance.',
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
