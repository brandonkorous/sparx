// sparx-portfolio-designer — the CASE-STUDY DESIGNER portfolio (codename Ledger).
//
// The "hire-me" portfolio for a product / UX / design-systems designer: judgment over
// decoration. A plain-spoken statement hero, selected work as full-width rows that each lead
// with their OUTCOME, a short "how I work" band, and case-study detail pages that walk the
// brief → the work → the result. Dressed in the bespoke `casework` theme (cool near-white
// paper carried by one electric signal-blue). Restraint is the whole point — the typography
// and the thinking do the work, not motion.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `portfolio-sites/harness.ts`; the case-study page's DATA plumbing lives in the shared
// `template-sites/article.ts` kit (a project is a `cms.blog_post` record — see the harness
// header for why). Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-portfolio-designer.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-portfolio-designer/**" \
//     "marketplace-catalog/_gen/gen-portfolio-designer.ts"
//
// LIGHT THEME, SEMANTIC TOKENS ONLY. `casework` is a paper page (`bg-base-100`), ink is
// near-black (`text-base-content`), the signal is electric blue (`text-primary` /
// `btn-primary`). No hardcoded colors — surfaces separate by a `bg-base-200` shift + a
// border, never a gradient or a shadow.
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
    "ledger-hero": "https://images.unsplash.com/photo-1504608245011-62d9758c1bb9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZGVzaWduZXIlMjB3b3Jrc3BhY2UlMjBsYXB0b3AlMjBub3RlYm9va3xlbnwwfDB8fHwxNzg2Mzk5NzM2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "ledger-atlas": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZGF0YSUyMGRhc2hib2FyZCUyMGFuYWx5dGljcyUyMHNjcmVlbnxlbnwwfDB8fHwxNzg2Mzk5NzQwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "ledger-north": "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bW9iaWxlJTIwYXBwJTIwaW50ZXJmYWNlJTIwcGhvbmV8ZW58MHwwfHx8MTc4NjM5OTc0M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "ledger-kiln": "https://images.unsplash.com/photo-1602576666092-bf6447a729fc?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dWklMjBkZXNpZ24lMjBzeXN0ZW0lMjBzY3JlZW58ZW58MHwwfHx8MTc4NjM5OTc0NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "ledger-fathom": "https://images.unsplash.com/photo-1581287053822-fd7bf4f4bfec?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c29mdHdhcmUlMjBvbmJvYXJkaW5nJTIwYXBwJTIwc2NyZWVufGVufDB8MHx8fDE3ODYzOTk5MDB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "ledger-portrait": "https://images.unsplash.com/photo-1506863530036-1efeddceb993?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cHJvZmVzc2lvbmFsJTIwcG9ydHJhaXQlMjBwZXJzb24lMjBzdHVkaW98ZW58MHwwfHx8MTc4NjM5OTc1MXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string =>
    PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
    id: string;
    url: string;
    alt: string;
}

const ASSETS: Asset[] = [
    { id: 'ledger-hero', url: src('ledger-hero'), alt: 'A designer’s workspace — a laptop, a notebook and a wall of interface sketches' },
    { id: 'ledger-atlas', url: src('ledger-atlas'), alt: 'A financial dashboard redesign shown across desktop and mobile' },
    { id: 'ledger-north', url: src('ledger-north'), alt: 'A healthcare booking flow, a sequence of clean mobile screens' },
    { id: 'ledger-kiln', url: src('ledger-kiln'), alt: 'A design-system component library laid out as a swatch grid' },
    { id: 'ledger-fathom', url: src('ledger-fathom'), alt: 'An onboarding checklist interface on a tablet' },
    { id: 'ledger-portrait', url: src('ledger-portrait'), alt: 'Portrait of Sasha Rourke, product designer' },
];

const assetUrl = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-portfolio-designer: unknown asset "${id}"`);
    return a.url;
};

// ── Home page bands ────────────────────────────────────────────────────────────────

/** The STATEMENT hero — no image, no flourish: an oversized grotesk claim, a one-line what-I-do,
 *  a row of past clients, and two actions. The type carries it; that restraint IS the pitch. */
function heroBand(): Node {
    return el('section', 'bg-base-100 @container px-6 pt-20 pb-16 @3xl:pt-28', {
        children: [
            el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-8', {
                children: [
                    el('div', 'flex flex-col gap-6', {
                        children: [
                            el(
                                'h1',
                                'max-w-4xl text-5xl font-bold leading-none tracking-tight text-base-content @2xl:text-7xl @3xl:text-8xl',
                                { text: 'Product designer who ships.' }
                            ),
                            el('p', 'max-w-2xl text-xl leading-relaxed text-base-content @2xl:text-2xl', {
                                text: 'I’m Sasha Rourke — I design product interfaces and the systems behind them, from the first sketch to the shipped release. Twelve years, mostly fintech and health, always end to end.',
                            }),
                        ],
                    }),
                    el('div', 'flex flex-wrap items-center gap-3', {
                        children: [
                            el('a', 'btn btn-primary btn-lg', { attrs: { href: '/work' }, text: 'See selected work' }),
                            el('a', 'btn btn-neutral btn-outline btn-lg', {
                                attrs: { href: '/about' },
                                text: 'About me',
                            }),
                        ],
                    }),
                    // A quiet "worked with" row — names as small caps in the readable secondary ink, not
                    // logos (no third-party marks). The label is metadata, not an eyebrow over a heading.
                    el('div', 'mt-4 flex flex-col gap-3 border-t border-base-300 pt-6', {
                        children: [
                            el('span', 'text-sm font-semibold uppercase tracking-wide text-secondary', {
                                text: 'Selected clients',
                            }),
                            el('div', 'flex flex-wrap gap-x-8 gap-y-2', {
                                children: [
                                    el('span', 'text-base font-semibold text-base-content', { text: 'Atlas Financial' }),
                                    el('span', 'text-base font-semibold text-base-content', { text: 'Northwind Health' }),
                                    el('span', 'text-base font-semibold text-base-content', { text: 'Kiln' }),
                                    el('span', 'text-base font-semibold text-base-content', { text: 'Fathom' }),
                                    el('span', 'text-base font-semibold text-base-content', { text: 'Meridian' }),
                                ],
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });
}

/** One SELECTED-WORK row — the format that makes this a hire-me portfolio: the OUTCOME leads.
 *  A large image beside a content column whose loudest element is a metric in the signal blue,
 *  then a one-line result and a "Read case study" link to the project's `/blog/:slug` detail. */
function caseRow(opts: {
    img: string;
    alt: string;
    meta: string;
    title: string;
    blurb: string;
    metric: string;
    metricLabel: string;
    href: string;
    flip?: boolean;
}): Node {
    const media = el('a', 'block overflow-hidden rounded-box border border-base-300', {
        attrs: { href: opts.href },
        children: [
            el('img', 'aspect-video w-full object-cover', {
                attrs: { src: assetUrl(opts.img), alt: opts.alt, loading: 'lazy' },
            }),
        ],
    });
    const body = el('div', 'flex flex-col justify-center gap-5', {
        children: [
            el('span', 'text-sm font-semibold uppercase tracking-wide text-secondary', { text: opts.meta }),
            el('h3', 'text-3xl font-bold leading-tight tracking-tight text-base-content @2xl:text-4xl', {
                text: opts.title,
            }),
            el('p', 'text-lg leading-relaxed text-base-content', { text: opts.blurb }),
            // The outcome, made the loudest thing in the row — the number in the signal blue.
            el('div', 'flex items-baseline gap-3', {
                children: [
                    el('span', 'text-5xl font-bold leading-none tracking-tight text-primary @2xl:text-6xl', {
                        text: opts.metric,
                    }),
                    el('span', 'text-base font-semibold text-base-content', { text: opts.metricLabel }),
                ],
            }),
            el('a', 'inline-flex w-fit items-center gap-2 text-base font-semibold text-primary', {
                attrs: { href: opts.href },
                children: [
                    el('span', undefined, { text: 'Read the case study' }),
                    el('span', undefined, { text: '→' }),
                ],
            }),
        ],
    });
    return el('div', 'grid gap-8 @3xl:grid-cols-2 @3xl:items-stretch', {
        children: opts.flip ? [body, media] : [media, body],
    });
}

/** The selected-work section — a heading over a stack of outcome-led case rows. */
function selectedWorkBand(): Node {
    return el('section', 'bg-base-100 @container px-6 py-16 @3xl:py-24', {
        children: [
            el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-14', {
                children: [
                    el('div', 'flex flex-col gap-3', {
                        children: [
                            el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
                                text: 'Selected work',
                            }),
                            el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                                text: 'Three recent projects, each with the problem it solved and the result it moved. The rest are on the work page.',
                            }),
                        ],
                    }),
                    caseRow({
                        img: 'ledger-atlas',
                        alt: 'A financial dashboard redesign shown across desktop and mobile',
                        meta: 'Product design · Design systems · 2026',
                        title: 'Rebuilding the Atlas trading dashboard',
                        blurb: 'A dense pro-trader dashboard rebuilt from the information architecture up, then codified into a component library the whole product now runs on.',
                        metric: '−38%',
                        metricLabel: 'support tickets in the first quarter',
                        href: '/blog/atlas-trading-dashboard',
                    }),
                    caseRow({
                        img: 'ledger-north',
                        alt: 'A healthcare booking flow, a sequence of clean mobile screens',
                        meta: 'UX · Service design · 2025',
                        title: 'A booking flow patients actually finish',
                        blurb: 'Northwind’s appointment booking was losing people at every step. We cut it to three, wrote it in plain language, and tested it with real patients.',
                        metric: '+61%',
                        metricLabel: 'booking completion rate',
                        href: '/blog/northwind-booking-flow',
                        flip: true,
                    }),
                    caseRow({
                        img: 'ledger-kiln',
                        alt: 'A design-system component library laid out as a swatch grid',
                        meta: 'Design systems · 2025',
                        title: 'One system, five product teams',
                        blurb: 'Kiln’s five squads were each rebuilding the same buttons. I built the shared system — tokens, components, and the docs that made teams actually adopt it.',
                        metric: '4×',
                        metricLabel: 'faster to ship a new screen',
                        href: '/blog/kiln-design-system',
                    }),
                ],
            }),
        ],
    });
}

/** The "how I work" band — three plain capability cards. No eyebrow; the heading carries it. */
function approachBand(): Node {
    const card = (title: string, body: string): Node =>
        el('div', 'flex flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-8', {
            children: [
                el('h3', 'text-xl font-semibold text-base-content', { text: title }),
                el('p', 'text-base leading-relaxed text-base-content', { text: body }),
            ],
        });
    return el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-24', {
        children: [
            el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-10', {
                children: [
                    el('h2', 'max-w-3xl text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
                        text: 'I design the product and the system it’s built on.',
                    }),
                    el('div', 'grid gap-6 @2xl:grid-cols-3', {
                        children: [
                            card(
                                'Product design',
                                'End-to-end interface design — flows, wireframes, high-fidelity screens, and the prototype that proves them before a line of code is written.',
                            ),
                            card(
                                'Design systems',
                                'Tokens, components and documentation that let a whole team move fast without the product drifting apart. Built to be adopted, not admired.',
                            ),
                            card(
                                'Research & testing',
                                'I test with real users early and often — usability sessions, quick prototypes, and honest readouts that change what we build next.',
                            ),
                        ],
                    }),
                ],
            }),
        ],
    });
}

/** The closing CTA — a solid signal-blue band inviting a first conversation. */
function contactCtaBand(): Node {
    return el('section', 'bg-primary @container px-6 py-20 text-center', {
        children: [
            el('div', 'mx-auto flex w-full max-w-2xl flex-col items-center gap-5', {
                children: [
                    el('h2', 'text-3xl font-bold tracking-tight text-primary-content @3xl:text-4xl', {
                        text: 'Have a project in mind?',
                    }),
                    el('p', 'text-lg leading-relaxed text-primary-content', {
                        text: 'I take on a few projects at a time and I’m choosy about fit. If yours sounds like a good one, tell me about it.',
                    }),
                    el('a', 'btn btn-lg mt-2 bg-base-100 text-base-content', {
                        attrs: { href: '/contact' },
                        text: 'Start a conversation',
                    }),
                ],
            }),
        ],
    });
}

const HOME: Node[] = [heroBand(), selectedWorkBand(), approachBand(), contactCtaBand()];

// ── Work index masthead (over the live, linkable project grid) ─────────────────────

const WORK: Node[] = [
    el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-20', {
        children: [
            el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-4', {
                children: [
                    el(
                        'h1',
                        'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-7xl',
                        { text: 'Selected work' }
                    ),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Case studies from the last few years — fintech, health, and the design systems underneath them. Each opens to the full story: the brief, the work, and what changed.',
                    }),
                ],
            }),
        ],
    }),
];

// ── The bespoke case-study page ────────────────────────────────────────────────────
// A designer's case study: the discipline rubric over the project title, a standfirst, the
// byline (me + the date), the hero shot, then the written body (problem → work → outcome) and
// a card about me at the foot. Every bound field resolves against the routed project via the
// article kit's `repeat('blog_post')` scope.

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
                    articleRubric('text-sm font-semibold uppercase tracking-wide text-secondary'),
                    articleTitle(
                        'h1',
                        'text-4xl font-bold leading-tight tracking-tight text-base-content @2xl:text-6xl',
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

// ── About + Contact (Sasha-voiced) ─────────────────────────────────────────────────

const ABOUT: Node[] = [
    el('section', 'bg-base-100 @container px-6 py-20', {
        children: [
            el('div', 'mx-auto grid w-full max-w-5xl gap-10 @3xl:grid-cols-3 @3xl:items-start', {
                children: [
                    el('div', 'flex flex-col gap-6 @3xl:col-span-2', {
                        children: [
                            el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', {
                                text: 'About Sasha',
                            }),
                            el('p', 'text-lg leading-relaxed text-base-content', {
                                text: 'I’m a product designer with twelve years of shipping real software — most of it in fintech and healthcare, where getting the details right actually matters to the person on the other end of the screen.',
                            }),
                            el('p', 'text-lg leading-relaxed text-base-content', {
                                text: 'I work end to end: the research that frames the problem, the flows and screens that solve it, and the design system that keeps a whole team consistent as they build. I care most about the boring parts done well — the empty states, the error messages, the second-time-through experience.',
                            }),
                            el('p', 'text-lg leading-relaxed text-base-content', {
                                text: 'Before going independent I led design at two venture-backed products and one very large bank. Now I take on a handful of projects a year, usually as the senior designer a team is missing.',
                            }),
                        ],
                    }),
                    el('div', 'flex flex-col gap-6', {
                        children: [
                            el('img', 'aspect-square w-full rounded-box border border-base-300 object-cover', {
                                attrs: {
                                    src: assetUrl('ledger-portrait'),
                                    alt: 'Portrait of Sasha Rourke, product designer',
                                    loading: 'lazy',
                                },
                            }),
                            el('div', 'flex flex-col gap-3 rounded-box border border-base-300 bg-base-200 p-6', {
                                children: [
                                    el('span', 'text-sm font-semibold uppercase tracking-wide text-secondary', {
                                        text: 'Tools',
                                    }),
                                    el('p', 'text-base leading-relaxed text-base-content', {
                                        text: 'Figma, prototyping, design tokens, and just enough front-end (React, CSS) to hand off work that survives the build.',
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
        heading: 'Let’s work together',
        intro: 'I’m available for select product-design and design-systems work. A good brief tells me the problem you’re solving, who for, and roughly when you need it — but a rough idea is a fine place to start too.',
        submitLabel: 'Email me',
        secondary: { label: 'See the work first', href: '/work' },
    }),
];

// ── The author (the byline persona) ─────────────────────────────────────────────────

const AUTHORS = [
    {
        slug: 'sasha-rourke',
        displayName: 'Sasha Rourke',
        bio: 'Sasha Rourke is an independent product designer working across fintech and healthcare, from first research to shipped design systems. Twelve years in, still obsessed with the empty states.',
        avatarAssetId: 'ledger-portrait',
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
        slug: 'atlas-trading-dashboard',
        status: 'published',
        authorSlug: 'sasha-rourke',
        categories: ['Product design'],
        tags: ['Fintech', 'Design systems'],
        body: {
            title: 'Rebuilding the Atlas trading dashboard',
            excerpt:
                'A dense pro-trader dashboard, rebuilt from the information architecture up — then codified into the component library the whole product now runs on.',
            featuredImage: { $asset: 'ledger-atlas' },
            body: {
                type: 'doc',
                content: [
                    para('Role: Lead product designer. Timeline: five months. Team: two engineers, one PM, and me. Atlas is a trading platform for professionals who live in the product all day — and their dashboard had grown, screen by screen, into something nobody could take in at a glance.'),
                    h2('The problem'),
                    para('Support tickets told the story: traders were missing price alerts, opening the wrong positions, and asking where features had gone. Nothing was broken, exactly — there was just too much on screen, arranged by which team shipped it rather than by what a trader needs to see first.'),
                    para('I started by mapping every element on the dashboard to a real question a trader asks — “where is my money”, “what changed”, “what do I do next” — and found that a third of the interface answered no question at all.'),
                    h2('What we did'),
                    para('We rebuilt the layout around those three questions, in that order: positions and P&L up top, a live change feed in the middle, and actions where the eye lands last. Density stayed high — pros want density — but it became legible density, with a clear type scale and a single accent doing the signalling.'),
                    para('Then we codified it. Every element became a token or a component in a shared library, documented with the rules for when to use it, so the next feature would extend the system instead of fighting it.'),
                    h2('The outcome'),
                    para('Support tickets about the dashboard fell 38% in the first quarter after launch. Just as important, the team shipped the next three features on top of the new system with no design debt — the library held. The dashboard is now the reference every other Atlas surface is being rebuilt against.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'northwind-booking-flow',
        status: 'published',
        authorSlug: 'sasha-rourke',
        categories: ['UX'],
        tags: ['Healthcare', 'Service design'],
        body: {
            title: 'A booking flow patients actually finish',
            excerpt:
                'Northwind’s appointment booking lost people at every step. We cut it to three, wrote it in plain language, and tested it with real patients.',
            featuredImage: { $asset: 'ledger-north' },
            body: {
                type: 'doc',
                content: [
                    para('Role: UX and service design. Timeline: three months. Northwind Health runs a network of clinics, and its online booking was the first thing most patients ever touched. It was also where most of them gave up.'),
                    h2('The problem'),
                    para('The old flow had nine steps and asked for insurance details before it showed a single available time. Analytics showed people dropping at every stage; the call centre picked up the slack, and the phones were always busy. The flow had been designed around the clinic’s data model, not the patient’s question, which is simply: when can I be seen?'),
                    h2('What we did'),
                    para('We rebuilt it around that question. Three steps: pick a reason, pick a time, confirm who you are. Everything the clinic needed but the patient didn’t care about moved to the end or got inferred. We rewrote every label in plain language — no “member ID”, no “provider”, just words a worried person reads correctly on the first pass.'),
                    para('Then we tested it, with eight real patients across two rounds, and fixed the three places they hesitated before it ever shipped.'),
                    h2('The outcome'),
                    para('Booking completion rose 61%, and call-centre volume for appointments dropped enough that the clinics reassigned two staff to follow-up care. The plain-language pass turned out to matter as much as the step count — the words were doing the work.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'kiln-design-system',
        status: 'published',
        authorSlug: 'sasha-rourke',
        categories: ['Design systems'],
        tags: ['Design systems', 'Team enablement'],
        body: {
            title: 'One system, five product teams',
            excerpt:
                'Kiln’s five squads were each rebuilding the same buttons. I built the shared system — and, more importantly, made teams want to adopt it.',
            featuredImage: { $asset: 'ledger-kiln' },
            body: {
                type: 'doc',
                content: [
                    para('Role: Design systems lead. Timeline: six months, then ongoing. Kiln had grown to five product squads, and every one of them had quietly built its own version of the same components. The product looked like five products.'),
                    h2('The problem'),
                    para('A design system had been attempted before and ignored — it existed as a Figma file nobody opened, because adopting it was more work than not adopting it. The technical problem was easy; the human one was the whole job.'),
                    h2('What we did'),
                    para('I built the system as tokens first — color, type, spacing, radius — so a team could get 80% of the look by changing nothing but their theme file. Then components on top, each shipped in both Figma and code, so a designer and an engineer were never working from different sources. And documentation that answered “which one do I use” in one screen, because that is the question people actually have.'),
                    para('The adoption lever was making the system the path of least resistance: new screens started from system components by default, and I sat with each squad for a sprint to migrate their first flow together.'),
                    h2('The outcome'),
                    para('Teams now ship a new screen about four times faster than before, and the product reads as one product again. The system has its own small backlog and two contributors from other squads — the surest sign it’s alive rather than imposed.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'fathom-onboarding',
        status: 'published',
        authorSlug: 'sasha-rourke',
        categories: ['Product design'],
        tags: ['Onboarding', 'Activation'],
        body: {
            title: 'Getting Fathom users to their first win faster',
            excerpt:
                'Fathom’s analytics product was powerful and impenetrable. We designed an onboarding that got new users to a real insight in under five minutes.',
            featuredImage: { $asset: 'ledger-fathom' },
            body: {
                type: 'doc',
                content: [
                    para('Role: Product designer. Timeline: two months. Fathom is a product-analytics tool, and its power was also its problem: a blank, capable canvas that new users stared at without knowing where to begin.'),
                    h2('The problem'),
                    para('Activation data was blunt but clear — people who built one useful report in their first session stuck around; people who didn’t, left. Most didn’t, because the distance from empty state to first insight was too far and completely unguided.'),
                    h2('What we did'),
                    para('We designed a short, skippable onboarding that used the user’s own connected data, not a demo dataset, to walk them to one real report about their own product. A checklist made progress visible, each step produced something they could keep, and the whole thing got out of the way the moment they wanted to explore on their own.'),
                    h2('The outcome'),
                    para('New users now reach a saved, useful report in a median of just under five minutes, and week-one activation rose by roughly a third. The onboarding is the tenant’s first taste of the product doing something for them — and it earns the exploration that follows.'),
                ],
            },
        },
    },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: PortfolioSiteSpec = {
    slug: 'portfolio-designer',
    key: 'sparx-portfolio-designer',
    name: 'Designer Portfolio',
    summary:
        'A hire-me portfolio for a product / UX / design-systems designer: a plain-spoken statement hero, selected work as outcome-led rows, a short “how I work” band, and case-study pages that walk the brief, the work and the result. Restraint over decoration — the typography and the thinking do the work. Dressed in a cool near-white theme carried by one electric signal-blue. Shipped as Sasha Rourke.',
    tagline: 'A case-study-led portfolio for a product & UX designer.',
    industry: 'Product & UX designer',
    requiresModules: ['builder', 'cms', 'email'],
    sortWeight: 90,
    brand: {
        businessName: 'Sasha Rourke',
        tagline: 'Product designer who ships.',
    },
    // A plain brand-left header with a filled "Get in touch" CTA, over the columns footer whose
    // bottom bar carries the live © name and the tenant's published legal links.
    chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
    seo: {
        home: {
            title: 'Sasha Rourke — product & UX designer',
            description:
                'Sasha Rourke is an independent product designer working across fintech and healthcare — selected work, case studies, and how to start a project.',
        },
        about: {
            title: 'About Sasha Rourke — product designer',
            description:
                'Twelve years shipping product in fintech and healthcare, end to end: research, interface design, and the design systems that keep a team consistent.',
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
