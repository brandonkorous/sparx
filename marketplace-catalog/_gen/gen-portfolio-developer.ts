// sparx-portfolio-developer — the CREATIVE-DEVELOPER portfolio (codename Void).
//
// The "hire-me" portfolio for a creative developer / technologist — WebGL, interactive,
// tooling. The medium is the message: the site itself is a small proof of taste, dressed as a
// terminal. A mono console intro in the hero, the name big in a tight grotesk, selected builds
// as bordered cards that light up on hover, a "Now" band of what's currently running, and
// case-study "build breakdown" pages that walk what it is → the hard part → the stack → what
// shipped. Dressed in the bespoke `void` theme — a near-black terminal ground in BOTH modes,
// monospace body, acid-green primary + electric-cyan accent.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `portfolio-sites/harness.ts`; the case-study page's DATA plumbing lives in the shared
// `template-sites/article.ts` kit (a project is a `cms.blog_post` record — see the harness
// header for why). Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-portfolio-developer.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-portfolio-developer/**" \
//     "marketplace-catalog/_gen/gen-portfolio-developer.ts"
//
// DARK THEME, SEMANTIC TOKENS ONLY. `void` is a terminal page (`bg-base-100`, near-black),
// ink is off-white (`text-base-content`), the signal is acid-green (`text-primary` /
// `btn-primary`) with an electric-cyan accent (`text-accent`). Surfaces separate by a
// `bg-base-200` shift + a border, never a gradient or a glow. No hardcoded colors.
//
// WHY RELATIVE IMPORTS — see the harness header (marketplace-catalog has no node_modules).

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
    el,
    type Node,
} from '../../wizeworks/packages/silica-catalog/node_modules/@wizeworks/silicaui-html/dist/index.js';
import { safeParseBlueprint } from '../../wizeworks/packages/blueprints/src/validate';

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
    "void-hero": "https://images.unsplash.com/photo-1753998943413-8cba1b923c0e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29kZSUyMGVkaXRvciUyMGRhcmslMjBzY3JlZW4lMjB0ZXJtaW5hbHxlbnwwfDB8fHwxNzg2Mzk5NzczfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "void-drift": "https://images.unsplash.com/photo-1760978631959-87fa2724d6e9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z2VuZXJhdGl2ZSUyMGFydCUyMHBhcnRpY2xlcyUyMGRhcmslMjBhYnN0cmFjdHxlbnwwfDB8fHwxNzg2Mzk5Nzc3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "void-loom": "https://images.unsplash.com/photo-1518773553398-650c184e0bb3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGVybWluYWwlMjBjb2RlJTIwc2NyZWVuJTIwZGFyayUyMG1vbm9zcGFjZXxlbnwwfDB8fHwxNzg2Mzk5NzgwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "void-prism": "https://images.unsplash.com/photo-1542831371-29b0f74f9713?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29sb3JmdWwlMjBjb2RlJTIwc2NyZWVuJTIwc2hhZGVyfGVufDB8MHx8fDE3ODYzOTk3ODJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "void-signal": "https://images.unsplash.com/photo-1707386264728-0e9feb83da19?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YXVkaW8lMjB3YXZlZm9ybSUyMGFic3RyYWN0JTIwdmlzdWFsfGVufDB8MHx8fDE3ODYzOTk3ODV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "void-portrait": "https://images.unsplash.com/photo-1623479322729-28b25c16b011?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZGV2ZWxvcGVyJTIwcG9ydHJhaXQlMjBkYXJrfGVufDB8MHx8fDE3ODYzOTk3ODh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string =>
    PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
    id: string;
    url: string;
    alt: string;
}

const ASSETS: Asset[] = [
    { id: 'void-hero', url: src('void-hero'), alt: 'A dark code editor and a running terminal, green text on black' },
    { id: 'void-drift', url: src('void-drift'), alt: 'A WebGL particle field rendered as thousands of glowing points drifting in 3D space' },
    { id: 'void-loom', url: src('void-loom'), alt: 'A terminal user interface with panes, tables and a status bar rendered in monospace' },
    { id: 'void-prism', url: src('void-prism'), alt: 'A browser shader playground — a live fragment-shader preview beside a code panel' },
    { id: 'void-signal', url: src('void-signal'), alt: 'An audio-reactive generative visual — concentric waveforms reacting to sound' },
    { id: 'void-portrait', url: src('void-portrait'), alt: 'Portrait of Kade Nakamura, creative developer' },
];

const assetUrl = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-portfolio-developer: unknown asset "${id}"`);
    return a.url;
};

// ── Shared small parts ─────────────────────────────────────────────────────────────

/** A tech-stack CHIP — a bordered mono pill in the signal ink. `tone` is `text-primary`
 *  (acid-green) or `text-accent` (cyan); the chip carries the stack as texture. */
function chip(text: string, tone: 'text-primary' | 'text-accent' = 'text-primary'): Node {
    return el('span', `rounded-full border border-base-300 px-3 py-1 text-sm font-semibold ${tone}`, {
        text,
    });
}

/** A row of stack chips. */
function chipRow(items: Array<{ text: string; tone?: 'text-primary' | 'text-accent' }>): Node {
    return el('div', 'flex flex-wrap gap-2', {
        children: items.map((c) => chip(c.text, c.tone ?? 'text-primary')),
    });
}

// ── Home page bands ────────────────────────────────────────────────────────────────

/** The TERMINAL hero — a mono console block (a faux prompt, not executable), the name big in
 *  the grotesk display, a one-liner, and two actions. The console frame + the mono body ARE
 *  the pitch: the site is the first build. */
function heroBand(): Node {
    return el('section', 'bg-base-100 @container px-6 pt-20 pb-16 @3xl:pt-28', {
        children: [
            el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-8', {
                children: [
                    // The console: a bordered bg-base-200 block, a green prompt glyph, styled mono lines.
                    el('div', 'flex w-fit max-w-full flex-col gap-2 rounded-box border border-base-300 bg-base-200 px-5 py-4', {
                        children: [
                            el('div', 'flex items-center gap-3', {
                                children: [
                                    el('span', 'text-base font-semibold text-primary', { text: '❯' }),
                                    el('span', 'text-base text-base-content', { text: 'whoami' }),
                                ],
                            }),
                            el('div', 'flex items-center gap-3', {
                                children: [
                                    el('span', 'text-base font-semibold text-accent', { text: '~' }),
                                    el('span', 'text-base text-secondary', {
                                        text: 'kade — creative developer · webgl / interactive / tooling',
                                    }),
                                ],
                            }),
                        ],
                    }),
                    el('div', 'flex flex-col gap-6', {
                        children: [
                            el(
                                'h1',
                                'max-w-4xl text-5xl font-bold leading-none tracking-tight text-base-content @2xl:text-7xl @3xl:text-8xl',
                                { text: 'Kade Nakamura' }
                            ),
                            el('p', 'max-w-2xl text-xl leading-relaxed text-base-content @2xl:text-2xl', {
                                text: 'I build things that run in a browser — real-time WebGL, interactive interfaces, and the tools other developers use to make them. Ten years of shipping the demo AND the production build behind it.',
                            }),
                        ],
                    }),
                    el('div', 'flex flex-wrap items-center gap-3', {
                        children: [
                            el('a', 'btn btn-primary btn-lg', { attrs: { href: '/work' }, text: 'View builds' }),
                            el('a', 'btn btn-neutral btn-outline btn-lg', {
                                attrs: { href: '/about' },
                                text: 'About',
                            }),
                        ],
                    }),
                    // A quiet "runs on" row — the primary stack as chips, in the readable secondary ink.
                    // The label is metadata, not an eyebrow over a heading.
                    el('div', 'mt-4 flex flex-col gap-3 border-t border-base-300 pt-6', {
                        children: [
                            el('span', 'text-sm font-semibold uppercase tracking-wide text-secondary', {
                                text: 'Runs on',
                            }),
                            chipRow([
                                { text: 'TypeScript' },
                                { text: 'WebGL / GLSL', tone: 'text-accent' },
                                { text: 'Three.js' },
                                { text: 'Rust / WASM', tone: 'text-accent' },
                                { text: 'Node' },
                            ]),
                        ],
                    }),
                ],
            }),
        ],
    });
}

/** One SELECTED-BUILD card — a bordered console tile that lights its border on hover. Title,
 *  a row of stack chips, a one-line what-it-does, and a "Read the build" link to the project's
 *  `/blog/:slug` breakdown. The whole card is the link. */
function buildCard(opts: {
    meta: string;
    title: string;
    stack: Array<{ text: string; tone?: 'text-primary' | 'text-accent' }>;
    blurb: string;
    href: string;
}): Node {
    return el(
        'a',
        'flex flex-col gap-4 rounded-box border border-base-300 bg-base-200 p-6 transition hover:-translate-y-1 hover:border-primary',
        {
            attrs: { href: opts.href },
            children: [
                el('span', 'text-sm font-semibold uppercase tracking-wide text-secondary', {
                    text: opts.meta,
                }),
                el('h3', 'text-2xl font-bold leading-tight tracking-tight text-base-content', {
                    text: opts.title,
                }),
                chipRow(opts.stack),
                el('p', 'text-base leading-relaxed text-base-content', { text: opts.blurb }),
                el('span', 'mt-2 inline-flex items-center gap-2 text-base font-semibold text-primary', {
                    children: [
                        el('span', undefined, { text: 'Read the build' }),
                        el('span', undefined, { text: '→' }),
                    ],
                }),
            ],
        }
    );
}

/** Selected builds — a heading over a three-up grid of build cards. */
function selectedBuildsBand(): Node {
    return el('section', 'bg-base-100 @container px-6 py-16 @3xl:py-24', {
        children: [
            el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-12', {
                children: [
                    el('div', 'flex flex-col gap-3', {
                        children: [
                            el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
                                text: 'Selected builds',
                            }),
                            el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                                text: 'Three recent things I built and shipped. Each one opens to the full breakdown — what it is, the part that was actually hard, the stack, and what went live.',
                            }),
                        ],
                    }),
                    el('div', 'grid gap-6 @3xl:grid-cols-3', {
                        children: [
                            buildCard({
                                meta: 'WebGL',
                                title: 'Drift',
                                stack: [
                                    { text: 'Three.js' },
                                    { text: 'GLSL', tone: 'text-accent' },
                                    { text: 'GPGPU' },
                                ],
                                blurb: 'A GPU particle field that pushes a million points at 60fps by simulating them entirely on the graphics card.',
                                href: '/blog/drift-particle-field',
                            }),
                            buildCard({
                                meta: 'Open source',
                                title: 'Loom',
                                stack: [
                                    { text: 'Rust' },
                                    { text: 'TUI', tone: 'text-accent' },
                                    { text: 'CLI' },
                                ],
                                blurb: 'A terminal-UI toolkit for building fast, keyboard-driven console apps — panes, tables and a real layout engine.',
                                href: '/blog/loom-terminal-ui',
                            }),
                            buildCard({
                                meta: 'Tooling',
                                title: 'Prism',
                                stack: [
                                    { text: 'WebGL2', tone: 'text-accent' },
                                    { text: 'TypeScript' },
                                    { text: 'Monaco' },
                                ],
                                blurb: 'A browser shader playground with a live fragment-shader preview, hot reload, and shareable links.',
                                href: '/blog/prism-shader-playground',
                            }),
                        ],
                    }),
                    el('a', 'inline-flex w-fit items-center gap-2 text-base font-semibold text-primary', {
                        attrs: { href: '/work' },
                        children: [
                            el('span', undefined, { text: 'See every build' }),
                            el('span', undefined, { text: '→' }),
                        ],
                    }),
                ],
            }),
        ],
    });
}

/** The "Now" band — what's currently running: what I'm building, the tools I reach for, and
 *  the open-source I maintain. Three plain console tiles. No eyebrow; the heading carries it. */
function nowBand(): Node {
    const tile = (title: string, body: string, tone: 'text-primary' | 'text-accent'): Node =>
        el('div', 'flex flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-8', {
            children: [
                el('h3', `text-sm font-semibold uppercase tracking-wide ${tone}`, { text: title }),
                el('p', 'text-base leading-relaxed text-base-content', { text: body }),
            ],
        });
    return el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-24', {
        children: [
            el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-10', {
                children: [
                    el('div', 'flex flex-col gap-3', {
                        children: [
                            el('h2', 'max-w-3xl text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
                                text: 'Now',
                            }),
                            el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                                text: 'A snapshot of what I have open in the editor this month.',
                            }),
                        ],
                    }),
                    el('div', 'grid gap-6 @2xl:grid-cols-3', {
                        children: [
                            tile(
                                'Building',
                                'A WebGPU renderer for a generative-art studio — compute shaders doing the heavy lifting so a browser tab can drive a wall of screens.',
                                'text-primary'
                            ),
                            tile(
                                'Tooling',
                                'Reaching for TypeScript, Three.js and raw WebGL2 daily, with Rust and WASM whenever a hot path needs to leave JavaScript behind.',
                                'text-accent'
                            ),
                            tile(
                                'Open source',
                                'Maintaining Loom and a handful of smaller libraries — issues answered, PRs reviewed, and the occasional 2am refactor when a bug is too interesting to leave.',
                                'text-primary'
                            ),
                        ],
                    }),
                ],
            }),
        ],
    });
}

/** The closing CTA — a solid acid-green band inviting a first conversation. */
function contactCtaBand(): Node {
    return el('section', 'bg-primary @container px-6 py-20 text-center', {
        children: [
            el('div', 'mx-auto flex w-full max-w-2xl flex-col items-center gap-5', {
                children: [
                    el('h2', 'text-3xl font-bold tracking-tight text-primary-content @3xl:text-4xl', {
                        text: 'Got something that has to run in a browser?',
                    }),
                    el('p', 'text-lg leading-relaxed text-primary-content', {
                        text: 'I take on a few build-heavy projects at a time — the ones where the demo has to survive contact with production. If that sounds like yours, let’s talk.',
                    }),
                    el('a', 'btn btn-lg mt-2 bg-base-100 text-base-content', {
                        attrs: { href: '/contact' },
                        text: 'Start a build',
                    }),
                ],
            }),
        ],
    });
}

const HOME: Node[] = [heroBand(), selectedBuildsBand(), nowBand(), contactCtaBand()];

// ── Work index masthead (over the live, linkable project grid) ─────────────────────

const WORK: Node[] = [
    el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-20', {
        children: [
            el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-4', {
                children: [
                    el(
                        'h1',
                        'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-7xl',
                        { text: 'Builds' }
                    ),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Real-time graphics, interactive interfaces, and developer tooling. Each build opens to the full breakdown: what it is, the hard part, the stack, and what shipped.',
                    }),
                ],
            }),
        ],
    }),
];

// ── The bespoke case-study page (a build breakdown) ─────────────────────────────────
// A developer's build breakdown: the discipline rubric (WebGL / Open source / Tooling) over
// the build title, a standfirst, the byline (me + the date), the hero shot, then the written
// body (what it is → the hard part → the stack → what shipped) and a card about me at the
// foot. Every bound field resolves against the routed project via the article kit's
// `repeat('blog_post')` scope.

function projectMasthead(): Node {
    return el('section', 'bg-base-100 @container px-6 pt-16 pb-12', {
        children: [
            el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-5', {
                children: [
                    el('a', 'inline-flex w-fit items-center gap-2 text-base font-semibold text-primary', {
                        attrs: { href: '/work' },
                        children: [
                            el('span', undefined, { text: '←' }),
                            el('span', undefined, { text: 'All builds' }),
                        ],
                    }),
                    articleRubric('text-sm font-semibold uppercase tracking-wide text-accent'),
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

// ── About + Contact (Kade-voiced) ───────────────────────────────────────────────────

const ABOUT: Node[] = [
    el('section', 'bg-base-100 @container px-6 py-20', {
        children: [
            el('div', 'mx-auto grid w-full max-w-5xl gap-10 @3xl:grid-cols-3 @3xl:items-start', {
                children: [
                    el('div', 'flex flex-col gap-6 @3xl:col-span-2', {
                        children: [
                            el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', {
                                text: 'About Kade',
                            }),
                            el('p', 'text-lg leading-relaxed text-base-content', {
                                text: 'I’m a creative developer. That means I live in the seam between design and engineering — the demos that look impossible, the interfaces that feel alive, and the tools that make building them faster. Ten years in, mostly real-time graphics and the web platform.',
                            }),
                            el('p', 'text-lg leading-relaxed text-base-content', {
                                text: 'I care about the whole path, not just the pretty frame: the shader that renders it, the memory budget that keeps it at 60fps, and the build pipeline that ships it to a phone. A prototype that can’t survive production was never finished — it was a screenshot.',
                            }),
                            el('p', 'text-lg leading-relaxed text-base-content', {
                                text: 'Before going independent I built rendering tech at a games studio and interactive work at a creative agency. Now I take on a handful of build-heavy projects a year, and I keep a few open-source libraries alive between them.',
                            }),
                        ],
                    }),
                    el('div', 'flex flex-col gap-6', {
                        children: [
                            el('img', 'aspect-square w-full rounded-box border border-base-300 object-cover', {
                                attrs: {
                                    src: assetUrl('void-portrait'),
                                    alt: 'Portrait of Kade Nakamura, creative developer',
                                    loading: 'lazy',
                                },
                            }),
                            el('div', 'flex flex-col gap-4 rounded-box border border-base-300 bg-base-200 p-6', {
                                children: [
                                    el('span', 'text-sm font-semibold uppercase tracking-wide text-secondary', {
                                        text: 'Stack',
                                    }),
                                    chipRow([
                                        { text: 'TypeScript' },
                                        { text: 'WebGL / GLSL', tone: 'text-accent' },
                                        { text: 'Three.js' },
                                        { text: 'WebGPU', tone: 'text-accent' },
                                        { text: 'Rust' },
                                        { text: 'WASM', tone: 'text-accent' },
                                        { text: 'Node' },
                                        { text: 'GSAP', tone: 'text-accent' },
                                    ]),
                                    el('p', 'text-base leading-relaxed text-base-content', {
                                        text: 'And enough Blender, Figma and shader math to hand off work that renders the same in the build as it did in the pitch.',
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
        heading: 'Let’s build something',
        intro: 'I’m open to select WebGL, interactive and tooling work. A good first message tells me what you’re trying to make, roughly when, and where it has to run — but a half-formed idea and a deadline is a fine place to start too.',
        submitLabel: 'Email me',
        secondary: { label: 'See the builds first', href: '/work' },
    }),
];

// ── The author (the byline persona) ─────────────────────────────────────────────────

const AUTHORS = [
    {
        slug: 'kade-nakamura',
        displayName: 'Kade Nakamura',
        bio: 'Kade Nakamura is an independent creative developer working in real-time WebGL, interactive interfaces and developer tooling. Ten years in, still chasing the frame budget.',
        avatarAssetId: 'void-portrait',
    },
];

// ── Content (the projects, as blog_post build breakdowns) ───────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({
    type: 'heading',
    attrs: { level: 2 },
    content: [{ type: 'text', text }],
});

const CONTENT = [
    {
        typeKey: 'blog_post',
        slug: 'drift-particle-field',
        status: 'published',
        authorSlug: 'kade-nakamura',
        categories: ['WebGL'],
        tags: ['Three.js', 'GLSL', 'GPGPU'],
        body: {
            title: 'Drift — a million particles at 60fps',
            excerpt:
                'A GPU particle field that simulates a million points entirely on the graphics card, so the CPU never touches a single one after launch.',
            featuredImage: { $asset: 'void-drift' },
            body: {
                type: 'doc',
                content: [
                    para('Role: solo build. Timeline: three weeks, on and off. Drift is an interactive particle field — a million glowing points that drift, curl and respond to the cursor, running in a browser tab at a locked 60fps on a mid-range laptop.'),
                    h2('What it is'),
                    para('It started as a demo for a music-visualiser pitch and turned into a small engine. Points flow through an animated noise field; the cursor drags a well through them; color is driven by velocity. It’s the kind of thing that looks like a screensaver until you realise every point is a live simulation, not a video.'),
                    h2('The hard part'),
                    para('A million particles is nothing to draw and everything to update. The moment you loop over them on the CPU each frame, you’ve lost — JavaScript can’t touch a million objects in 16 milliseconds. So the particles can never live in JavaScript at all.'),
                    para('The trick is GPGPU: I store every particle’s position and velocity in floating-point textures, then a fragment shader advances the whole simulation in one pass on the GPU. The CPU’s only job per frame is to say "go". Getting the ping-pong buffers, the float-texture precision and the noise function right was most of the three weeks.'),
                    h2('The stack'),
                    para('Three.js for the WebGL plumbing, hand-written GLSL for the simulation and render passes, and a GPU compute step built on render-to-texture. No physics library — at this scale you write the integrator yourself, because a general one can’t make the assumptions that keep it fast.'),
                    h2('What shipped'),
                    para('Drift runs at a steady 60fps with a million particles on integrated graphics, and degrades gracefully to fewer on weaker devices by reading back a quick benchmark on load. It shipped as the hero of the client’s launch site, and the engine underneath became the base for two later interactive pieces.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'loom-terminal-ui',
        status: 'published',
        authorSlug: 'kade-nakamura',
        categories: ['Open source'],
        tags: ['Rust', 'TUI', 'CLI'],
        body: {
            title: 'Loom — a terminal-UI toolkit in Rust',
            excerpt:
                'An open-source toolkit for building fast, keyboard-driven console apps — a real layout engine, panes, tables and a status bar, all in monospace.',
            featuredImage: { $asset: 'void-loom' },
            body: {
                type: 'doc',
                content: [
                    para('Role: creator and maintainer. Timeline: six months to 1.0, ongoing since. Loom is an open-source library for building terminal user interfaces — the panes, tables and forms you see in tools that run entirely inside a console window.'),
                    h2('What it is'),
                    para('I kept building the same scaffolding for every CLI I wrote: split the screen, draw a bordered pane, put a scrollable table in it, handle the arrow keys. Loom is that scaffolding, extracted and made general — a widget set plus a layout engine that flows a UI into whatever size the terminal happens to be.'),
                    h2('The hard part'),
                    para('A terminal is a hostile canvas. You get a grid of character cells, no pixels, no sub-cell positioning, and a redraw model from the 1970s where the wrong escape sequence leaves visible garbage on screen. Making a flexbox-style layout engine feel natural on top of that grid — while only ever repainting the cells that actually changed — was the whole engineering problem.'),
                    para('The other hard part was Unicode width. A single emoji can be two cells wide, a combining accent is zero, and getting that wrong shears every column to the right of it. Loom carries a width table so authors never think about it.'),
                    h2('The stack'),
                    para('Pure Rust, no unsafe in the public path, with an immediate-mode API so app authors describe the UI every frame and Loom diffs it against the last frame to compute the minimal set of cell writes. Crossterm handles the raw terminal; everything above it is Loom.'),
                    h2('What shipped'),
                    para('Loom is on its 1.x line with a few thousand downloads a month, a documentation site built with Loom itself, and outside contributors who’ve added widgets I never would have. It’s the project that taught me maintaining open source is a design job as much as a code one — every API you ship, you ship forever.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'prism-shader-playground',
        status: 'published',
        authorSlug: 'kade-nakamura',
        categories: ['Tooling'],
        tags: ['WebGL2', 'TypeScript', 'Shaders'],
        body: {
            title: 'Prism — a shader playground in the browser',
            excerpt:
                'A live fragment-shader editor with hot reload, error mapping and shareable links — the tool I wanted while learning GLSL, so I built it.',
            featuredImage: { $asset: 'void-prism' },
            body: {
                type: 'doc',
                content: [
                    para('Role: solo build, open source. Timeline: two months to launch. Prism is a browser-based playground for writing GLSL fragment shaders — code on one side, a live preview on the other, updating as you type.'),
                    h2('What it is'),
                    para('Learning shaders is brutal because the feedback loop is broken: you write maths that describes a color per pixel, and a typo gives you either a black screen or a cryptic driver error with no line number. Prism closes that loop — every keystroke recompiles the shader and either shows the result or points at the exact line that broke.'),
                    h2('The hard part'),
                    para('GLSL compile errors are reported against the driver’s view of the source, not yours — with your uniforms, your boilerplate and your prelude all injected ahead of the code you actually wrote. Mapping a driver error at "line 214" back to "line 12 of what the user typed" meant tracking every line I prepended and rewriting the error offsets before showing them. Nobody notices when it’s right; everybody rage-quits when it’s wrong.'),
                    para('Hot reload without flicker was the other one: swap the compiled program between frames, keep the same textures and uniforms bound, and never drop to a black frame while the new shader links.'),
                    h2('The stack'),
                    para('TypeScript and raw WebGL2 — no framework, because the whole app is one canvas and one editor. Monaco for the code pane, a small GLSL grammar for highlighting, and URL-encoded state so any shader is a shareable link with nothing stored server-side.'),
                    h2('What shipped'),
                    para('Prism went out as a free, open tool and found its way into a couple of university graphics courses. The shareable-link feature turned it into a way people swap shaders in chat, which I never planned and now think is the best thing about it.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'signal-audio-reactive',
        status: 'published',
        authorSlug: 'kade-nakamura',
        categories: ['Interactive'],
        tags: ['Web Audio', 'Canvas', 'Generative'],
        body: {
            title: 'Signal — visuals that listen',
            excerpt:
                'An audio-reactive generative visual for a live show — sound comes in, geometry moves in time, and it never renders the same frame twice.',
            featuredImage: { $asset: 'void-signal' },
            body: {
                type: 'doc',
                content: [
                    para('Role: solo build, commissioned. Timeline: five weeks. Signal is an audio-reactive visual built for a musician’s live set — a generative system that takes the live audio feed and turns it into moving geometry projected behind the stage.'),
                    h2('What it is'),
                    para('It’s the visuals you half-notice at a good show: waveforms that bloom on a kick, fields that ripple with the bass, a whole scene that’s clearly listening to the music rather than looping a pre-rendered clip. Because it’s generative and driven by the actual audio, every performance looks different, which is exactly what a live act wants.'),
                    h2('The hard part'),
                    para('Audio analysis is deceptively hard to make feel musical. The raw FFT is jittery and noisy — map it straight to motion and you get a twitchy mess that reacts to every hiss. The work was in the smoothing: beat detection with hysteresis so a kick reads as one hit, envelope followers so energy decays like a real instrument, and separating bass, mid and treble into bands that drive different parts of the scene.'),
                    para('And it had to be bulletproof live. A dropped frame or a crash mid-set isn’t a bug report, it’s a ruined show — so it runs with a fixed memory budget and degrades rather than stalls if the machine gets busy.'),
                    h2('The stack'),
                    para('The Web Audio API for analysis, Canvas and WebGL for the render, and a small generative system of my own where a handful of parameters — energy, tempo, band balance — drive a much larger visual. TypeScript throughout, with a control panel the VJ drives from a second screen.'),
                    h2('What shipped'),
                    para('Signal ran a full tour without a single crash, driven live off the front-of-house audio feed. It’s since been adapted into an installation version that listens to a room instead of a mixing desk — same engine, different microphone.'),
                ],
            },
        },
    },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: PortfolioSiteSpec = {
    slug: 'portfolio-developer',
    key: 'sparx-portfolio-developer',
    name: 'Developer Portfolio',
    summary:
        'A hire-me portfolio for a creative developer / technologist: a mono terminal hero, selected builds as bordered cards that light up on hover, a “Now” band of what’s running, and case-study pages that walk what it is, the hard part, the stack and what shipped. Dressed in a near-black terminal theme with a monospace body, acid-green primary and electric-cyan accent. The site is its own proof of taste. Shipped as Kade Nakamura.',
    tagline: 'A build-led portfolio for a creative developer.',
    industry: 'Creative developer',
    requiresModules: ['builder', 'cms', 'email'],
    sortWeight: 88,
    brand: {
        businessName: 'Kade Nakamura',
        tagline: 'I build things that run in a browser.',
    },
    // A lean editorial dark bar (brand left, no CTA) over the columns footer whose bottom bar
    // carries the live © name and the tenant's published legal links.
    chrome: { navbar: 'brandLeft', footer: 'columns', showCta: false },
    seo: {
        home: {
            title: 'Kade Nakamura — creative developer',
            description:
                'Kade Nakamura builds real-time WebGL, interactive interfaces and developer tooling — selected builds, the breakdowns behind them, and how to start a project.',
        },
        about: {
            title: 'About Kade Nakamura — creative developer',
            description:
                'Ten years in real-time graphics and the web platform, end to end: the shader that renders it, the budget that keeps it fast, and the pipeline that ships it.',
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
