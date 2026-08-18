// sparx-culture-bold — the CONTENT set's LOUD entry (docs/templates/content/rolling-stone).
// Where news-feed models a utilitarian tech newsroom, this models a BOLD music & pop-culture
// magazine — a full-bleed feature lead over a dense feed, a signature ranked "most read"
// countdown, and a light merch store — the Rolling Stone / Variety archetype translated to
// sparx as Static, "Loud, on purpose."
//
// Dressed in the bespoke `amplitude` theme: the content set's first DARK default ground — a
// near-black page (`bg-base-100`), bright near-white ink (`text-base-content`), and ONE
// voltage crimson-magenta accent (`text-primary`) carrying rubrics, ranked-list numbers and
// the primary action. The look is DARK, but every color is a SEMANTIC token — the dark
// ground is `bg-base-100`, the light ink `text-base-content`, the hot accent `text-primary` —
// so a tenant that recolors the theme recolors the whole site and nothing is hardcoded.
// Surfaces separate by base-tone shifts (`bg-base-200`) + hairline borders, never gradients.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts` (content-theme resolution + the `article` slot). The article
// DATA plumbing lives in the shared `template-sites/article.ts` kit. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-template-culture-bold.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-culture-bold/**" \
//     "marketplace-catalog/_gen/**/*.ts"
//   pnpm --filter @wizeworks/api-rest marketplace:self-register
//
// A CONTENT template still ships the full 9-page superset (the module-independent rule:
// author complete, the installer writes the tenant's enabled slices) — so it carries a
// LIGHT commerce slice (vinyl + merch) that doubles as the content+commerce demo. The
// bespoke effort goes where a publisher lives: the article.
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
// Royalty-free Unsplash photographs — original performance & culture imagery, never any
// Rolling Stone / Variety photography (design study §6, deliberate departures).
const U = (id: string): string => `https://images.unsplash.com/photo-${id}?w=1400&q=80`;

const IMG = {
    // Feature + story imagery
    feature: '1470229722913-7c0e2dbbafd3', // a crowd lit red at a live show
    storyBasement: '1533174072545-7a4b6ad7a6c3', // a packed small-room crowd
    storyMusical: '1489599849927-2ee91cede3ba', // a cinema auditorium in the dark
    storyDemo: '1571330735066-03aaa9429d89', // hands on a mixing desk
    storyReissue: '1483412033650-1015ddeb83d1', // a stack of vinyl records
    storyList: '1510915361894-db8b60106cb1', // an electric guitar against black
    // Author portraits
    authorVega: '1494790108377-be9c29b29330',
    authorMarsh: '1500648767791-00dcc994a43e',
    authorOkonkwo: '1573497019940-1c28c88b4f3e',
    // Store imagery
    vinyl: '1539375665275-f9de415ef9ac',
    tee: '1521572163474-6864f9cf17ab',
    poster: '1493225457124-a3eb161ffa5f',
    tote: '1591561954557-26941169b49e',
} as const;

interface Asset {
    id: string;
    url: string;
    alt: string;
}

const ASSETS: Asset[] = [
    { id: 'feature-lead', url: U(IMG.feature), alt: 'A festival crowd lit hot red under the stage lights' },
    { id: 'story-basement', url: U(IMG.storyBasement), alt: 'A packed small-venue crowd close to the stage' },
    { id: 'story-musical', url: U(IMG.storyMusical), alt: 'An empty cinema auditorium lit in the dark' },
    { id: 'story-demo', url: U(IMG.storyDemo), alt: 'Hands riding faders on a studio mixing desk' },
    { id: 'story-reissue', url: U(IMG.storyReissue), alt: 'A stack of vinyl records fanned across a table' },
    { id: 'story-list', url: U(IMG.storyList), alt: 'An electric guitar leaning against a black wall' },
    { id: 'author-vega', url: U(IMG.authorVega), alt: 'Portrait of Jules Vega' },
    { id: 'author-marsh', url: U(IMG.authorMarsh), alt: 'Portrait of Theo Marsh' },
    { id: 'author-okonkwo', url: U(IMG.authorOkonkwo), alt: 'Portrait of Nia Okonkwo' },
    { id: 'vinyl-lp', url: U(IMG.vinyl), alt: 'A vinyl LP half out of its sleeve' },
    { id: 'tee', url: U(IMG.tee), alt: 'A folded black cotton t-shirt' },
    { id: 'poster', url: U(IMG.poster), alt: 'A printed gig poster on a wall' },
    { id: 'tote', url: U(IMG.tote), alt: 'A heavyweight canvas tote bag' },
];

const assetUrl = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-culture-bold: unknown asset "${id}"`);
    return a.url;
};

// ── Home page bands (the loud front page) ─────────────────────────────────────────

/** A story LINK — the secondary items down the feature rail. A hot uppercase rubric over a
 *  condensed headline: the editorial device the platform bans on its OWN surfaces but a
 *  tenant's published site is free to use (design freedom), authored here at the bundle
 *  level, never through the house-ruled catalog. */
function storyLink(rubric: string, headline: string, meta: string): Node {
    return el('a', 'group flex flex-col gap-2 border-t border-base-300 py-5', {
        attrs: { href: '/journal' },
        children: [
            el('span', 'text-sm font-semibold uppercase tracking-wide text-primary', { text: rubric }),
            // h2, not h3: these rail stories are peers of the feature's h1, not subordinate to it —
            // an h1→h3 jump is a skipped level a screen-reader outline reports (blueprint-sweep).
            el('h2', 'text-lg font-bold uppercase leading-tight tracking-tight text-base-content', {
                text: headline,
            }),
            el('p', 'text-sm text-base-content', { text: meta }),
        ],
    });
}

/** The full-bleed FEATURE band — the loud, curated lead. A big image with the headline in a
 *  SOLID `bg-base-100` panel pulled up over the photo's foot (never text directly on the
 *  image), and the day's next stories down a rail beside it. The concert-poster opening. */
function featureBand(): Node {
    return el('section', 'bg-base-100 @container px-6 py-14', {
        children: [
            el('div', 'mx-auto grid w-full max-w-6xl gap-10 @4xl:grid-cols-3', {
                children: [
                    // The feature itself — two-thirds of the width on a wide container.
                    el('a', 'group flex flex-col @4xl:col-span-2', {
                        attrs: { href: '/journal' },
                        children: [
                            el('img', 'aspect-video w-full rounded-box border border-base-300 bg-base-200 object-cover', {
                                attrs: { src: assetUrl('feature-lead'), alt: 'A festival crowd lit hot red under the stage lights', loading: 'lazy' },
                            }),
                            // The solid headline panel — pulled UP over the photo's foot with a negative
                            // margin, so the type sits in a real box on the dark ground, never on the image.
                            el(
                                'div',
                                'relative z-10 mx-4 -mt-16 flex flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-6 @2xl:mx-8 @2xl:-mt-20 @2xl:p-8',
                                {
                                    children: [
                                        el('span', 'text-sm font-semibold uppercase tracking-wide text-primary', {
                                            text: 'The cover story',
                                        }),
                                        el(
                                            'h1',
                                            'text-3xl font-bold uppercase leading-none tracking-tight text-base-content @2xl:text-5xl @3xl:text-6xl',
                                            { text: 'The year the underground got loud again' },
                                        ),
                                        el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                                            text: 'Guitar bands were supposed to be finished. Instead they packed out every 200-cap room in the country. We spent a summer on the floor to find out what actually changed.',
                                        }),
                                        el('p', 'text-sm text-base-content', { text: 'By Jules Vega · 6 August' }),
                                    ],
                                },
                            ),
                        ],
                    }),
                    // The rail of the day's next stories.
                    el('div', 'flex flex-col', {
                        children: [
                            storyLink(
                                'Screen',
                                'The prestige musical finally learned how to shoot a song',
                                'By Theo Marsh · 5 August',
                            ),
                            storyLink(
                                'Culture',
                                'How a leaked demo became the sound of the summer',
                                'By Nia Okonkwo · 5 August',
                            ),
                            storyLink(
                                'Music',
                                'Inside the reissue machine turning old tapes into new hits',
                                'By Jules Vega · 4 August',
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
                    el('h2', 'text-3xl font-bold uppercase tracking-tight text-base-content @3xl:text-4xl', {
                        text: heading,
                    }),
                    el('p', 'max-w-2xl text-lg text-base-content', { text: lead }),
                ],
            }),
        ],
    });
}

/** Most read — the archetype's signature RANKED countdown. A real `<ol>`, the big hot rank
 *  number the whole information it carries. Raised onto `bg-base-200` so it reads as its own
 *  band on the dark ground without a shadow. */
function mostRead(): Node {
    const row = (rank: string, rubric: string, headline: string): Node =>
        el('li', 'border-t border-base-300', {
            children: [
                el('a', 'group flex items-baseline gap-5 py-4', {
                    attrs: { href: '/journal' },
                    children: [
                        el('span', 'text-4xl font-bold leading-none text-primary @2xl:text-5xl', { text: rank }),
                        el('div', 'flex flex-col gap-1', {
                            children: [
                                el('span', 'text-sm font-semibold uppercase tracking-wide text-primary', {
                                    text: rubric,
                                }),
                                el('span', 'text-lg font-bold uppercase leading-tight tracking-tight text-base-content', {
                                    text: headline,
                                }),
                            ],
                        }),
                    ],
                }),
            ],
        });
    return el('section', 'bg-base-200 @container px-6 py-14', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-6', {
                children: [
                    el('h2', 'text-3xl font-bold uppercase tracking-tight text-base-content @3xl:text-4xl', {
                        text: 'Most read',
                    }),
                    el('ol', 'flex flex-col', {
                        children: [
                            row('1', 'Music', 'The year the underground got loud again'),
                            row('2', 'Culture', 'How a leaked demo became the sound of the summer'),
                            row('3', 'Lists', 'The 50 greatest debut albums, ranked'),
                            row('4', 'Screen', 'The prestige musical finally learned how to shoot a song'),
                            row('5', 'Music', 'Inside the reissue machine turning old tapes into new hits'),
                        ],
                    }),
                ],
            }),
        ],
    });
}

const HOME: Node[] = [
    featureBand(),
    headingBand('The latest', 'New music writing, screen takes and culture from the Static desk — loud, on purpose.'),
    blogPostGrid(),
    mostRead(),
    // The content→commerce bridge: the magazine's own store, as a live carousel.
    productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'The Static Store' }),
];

// ── The bespoke article page (the content template's signature surface) ───────────
// A bold culture story: the section rubric over an oversized condensed headline, a real
// byline (author + date), the full-bleed lead, the written body, and an author card at the
// foot. Every bound field resolves against the routed post (the `article.ts` kit's
// `repeat('blog_post')` scope); the byline lights up from the storefront's projection — a
// post with no author simply renders no byline, never a blank line.

/** The article MASTHEAD — authored UNSCOPED; `articlePage` wraps it in `repeat('blog_post')`. */
function articleMasthead(): Node {
    return el('section', 'bg-base-200 @container px-6 pt-12 pb-14 @2xl:pt-16', {
        children: [
            el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-5', {
                children: [
                    el('a', 'inline-flex w-fit items-center gap-2 text-base font-semibold text-primary', {
                        attrs: { href: '/journal' },
                        children: [el('span', undefined, { text: '←' }), el('span', undefined, { text: 'All stories' })],
                    }),
                    // The section rubric — the editorial eyebrow, bound to the post's category.
                    articleRubric('text-sm font-semibold uppercase tracking-wide text-primary'),
                    articleTitle(
                        'h1',
                        'text-4xl font-bold uppercase leading-none tracking-tight text-base-content @2xl:text-6xl',
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

/** The full-bleed lead image band, at the article measure. */
function articleImageBand(): Node {
    return el('section', 'bg-base-100 @container px-6 py-10', {
        children: [
            el('div', 'mx-auto w-full max-w-3xl', {
                children: [
                    articleFeaturedImage('aspect-video w-full rounded-box border border-base-300 bg-base-200 object-cover'),
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
                    el('h1', 'text-5xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-7xl', {
                        text: 'Static',
                    }),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Music, screen and culture — reported loud, updated all day. Everything the desk is playing, watching and arguing about, newest first.',
                    }),
                ],
            }),
        ],
    }),
];

// ── About + Contact (Static-voiced) ───────────────────────────────────────────────

const ABOUT: Node[] = [
    el('section', 'bg-base-100 @container px-6 py-20', {
        children: [
            el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-6', {
                children: [
                    el('h1', 'text-5xl font-bold uppercase tracking-tight text-base-content @2xl:text-6xl', {
                        text: 'About Static',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'Static is a music and pop-culture magazine for people who still turn it up. We cover the records, the shows, the films and the arguments that actually move the needle — not the ones a press release told us to care about.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'We started in a basement venue with a laptop and a merch table, and we have kept the same rule ever since: go to the room, talk to the people making the thing, and write it down while it is still loud. We are opinionated on purpose. If everyone already agrees, it is not a story.',
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
        heading: 'Reach the desk',
        intro: 'Got a tip, a demo, a show we should be at, or a take you think we got wrong? We read everything, we go to the gigs, and we answer the good ones. Send it over.',
        submitLabel: 'Email the desk',
    }),
];

// ── Light commerce (the Static Store — vinyl + merch) ─────────────────────────────

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
        handle: 'static-vol-1-vinyl',
        title: 'Static Vol. 1 — Vinyl LP',
        description:
            'Our first compilation, pressed on 180-gram black vinyl: twelve tracks from the bands the desk spent the year chasing across basement rooms and festival tents. Gatefold sleeve, liner notes, and a download code inside.',
        status: 'active',
        productType: 'Vinyl',
        vendor: 'Static',
        tags: ['vinyl', 'lp', 'compilation'],
        categoryHandles: ['vinyl'],
        collectionHandles: ['featured'],
        seoTitle: 'Static Vol. 1 — Vinyl LP',
        seoDescription: 'The Static Vol. 1 compilation on 180-gram vinyl, twelve tracks with liner notes.',
        variants: [{ sku: 'STC-VNL-VOL1', priceCents: money(32), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'vinyl-lp', isPrimary: true, alt: 'Static Vol. 1 vinyl LP half out of its sleeve' }],
    },
    {
        handle: 'static-logo-tee',
        title: 'Static Logo Tee',
        description:
            'The masthead, printed big on the back of a heavyweight black tee. Screen-printed, pre-shrunk, and built to survive the pit and the wash. Runs true to size.',
        status: 'active',
        productType: 'Apparel',
        vendor: 'Static',
        tags: ['merch', 'tee', 'apparel'],
        categoryHandles: ['merch'],
        collectionHandles: ['featured'],
        seoTitle: 'Static Logo Tee — heavyweight black t-shirt',
        seoDescription: 'A heavyweight black tee with the Static masthead screen-printed on the back.',
        variants: [{ sku: 'STC-TEE-LOGO', priceCents: money(28), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'tee', isPrimary: true, alt: 'The Static logo tee, folded' }],
    },
    {
        handle: 'static-tour-poster',
        title: 'Static Tour Poster',
        description:
            'An 18×24 screen print in hot crimson on uncoated black stock — the poster from our Vol. 1 launch run. Numbered edition, shipped flat in a rigid tube.',
        status: 'active',
        productType: 'Print',
        vendor: 'Static',
        tags: ['merch', 'poster', 'print'],
        categoryHandles: ['merch'],
        collectionHandles: ['featured'],
        seoTitle: 'Static Tour Poster — 18×24 screen print',
        seoDescription: 'A numbered 18×24 screen-printed Static tour poster on black stock.',
        variants: [{ sku: 'STC-PST-TOUR', priceCents: money(22), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'poster', isPrimary: true, alt: 'The Static tour poster on a wall' }],
    },
    {
        handle: 'static-tote',
        title: 'Static Tote',
        description:
            'A heavyweight canvas tote with the masthead printed small on the side. Carries a stack of records, a notebook, and roughly a festival weekend of essentials.',
        status: 'active',
        productType: 'Merch',
        vendor: 'Static',
        tags: ['merch', 'tote'],
        categoryHandles: ['merch'],
        collectionHandles: [],
        seoTitle: 'Static Tote — heavyweight canvas tote',
        seoDescription: 'A heavyweight canvas tote with the Static masthead, sized for a stack of records.',
        variants: [{ sku: 'STC-TOTE', priceCents: money(24), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'tote', isPrimary: true, alt: 'The Static canvas tote' }],
    },
];

const COMMERCE = {
    categories: [
        { handle: 'vinyl', name: 'Vinyl', description: 'Records for the shelf.', featured: true },
        { handle: 'merch', name: 'Merch', description: 'Wear it loud, carry it louder.', featured: true },
    ],
    collections: [
        {
            handle: 'featured',
            name: 'Featured',
            description: 'What the desk is pushing this week.',
            type: 'manual',
            featured: true,
            productHandles: ['static-vol-1-vinyl', 'static-logo-tee', 'static-tour-poster'],
        },
    ],
    products: PRODUCTS,
};

// ── The masthead (byline personas) ────────────────────────────────────────────────
// Real authors the posts reference by `authorSlug`. The installer seeds these as CMS
// `Author` rows scoped to the site, and the storefront byline projection resolves them —
// so the bespoke article page shows a real name, portrait and bio, not an empty byline.

const AUTHORS = [
    {
        slug: 'jules-vega',
        displayName: 'Jules Vega',
        bio: 'Jules Vega covers music for Static — the bands, the rooms and the scenes, mostly from the floor. Fifteen years of gig tickets and a permanent ring in one ear to show for it.',
        avatarAssetId: 'author-vega',
    },
    {
        slug: 'theo-marsh',
        displayName: 'Theo Marsh',
        bio: 'Theo Marsh writes about screen and sound for Static — how films and TV use music, and how music becomes a picture. Formerly a film programmer, still a soundtrack obsessive.',
        avatarAssetId: 'author-marsh',
    },
    {
        slug: 'nia-okonkwo',
        displayName: 'Nia Okonkwo',
        bio: 'Nia Okonkwo reports on culture for Static — the internet, the discourse and the way a song becomes a moment. She has a low tolerance for manufactured virality and a high one for a good argument.',
        avatarAssetId: 'author-okonkwo',
    },
];

// ── Content (the Static reporting) ────────────────────────────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });

const CONTENT = [
    {
        typeKey: 'blog_post',
        slug: 'underground-got-loud-again',
        status: 'published',
        authorSlug: 'jules-vega',
        categories: ['Music'],
        tags: ['Live', 'Scenes'],
        body: {
            title: 'The year the underground got loud again',
            excerpt:
                'Guitar bands were supposed to be finished. Instead they packed out every 200-cap room in the country. We spent a summer on the floor to find out what actually changed.',
            featuredImage: { $asset: 'feature-lead' },
            body: {
                type: 'doc',
                content: [
                    para('For the better part of a decade the story about guitar music was that it was over — displaced, streamed into irrelevance, a heritage act at best. Then, quietly and then all at once, the small rooms started selling out again. Not stadiums. The 200-cap basements, the back rooms of pubs, the all-ages spaces that keep dying and keep coming back.'),
                    h2('The room is the format'),
                    para('What these bands worked out is that the show is the product, and the recording is the flyer for it. You cannot stream the feeling of a floor going up at once, so they built everything around the thing that only happens in the room. The songs are shorter, louder and made to be shouted back. The merch table is the label. The whole economy runs on a night you had to be there for.'),
                    h2('Loud is a decision'),
                    para('None of this is nostalgia, whatever the takes say. The bands filling these rooms grew up online and use every tool the internet gives them — they just point all of it at getting bodies into a space. The volume is the point. In a culture optimised to be consumed quietly, on a screen, at half speed, a band that insists you show up and get loud is making an argument, not just a noise.'),
                    para('We went to eleven of these shows across the summer. Every one of them sold out. Every one of them ended with a merch queue longer than the bar. Something is happening down there, and the industry is, as usual, the last to hear it.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'prestige-musical-shoots-a-song',
        status: 'published',
        authorSlug: 'theo-marsh',
        categories: ['Screen'],
        tags: ['Film', 'Soundtracks'],
        body: {
            title: 'The prestige musical finally learned how to shoot a song',
            excerpt:
                'For years the big-budget musical filmed its numbers like dialogue scenes with extra choreography. A new wave of directors is treating the song as the camera’s job, not the actor’s.',
            featuredImage: { $asset: 'story-musical' },
            body: {
                type: 'doc',
                content: [
                    para('The knock on the modern movie musical was always the cutting. A number would start, the energy would build, and then the edit would chop it into a hundred tiny pieces, terrified of holding a shot long enough to let a body actually move. You could feel the fear of boredom in every cut, and it drained the one thing a musical has that nothing else does.'),
                    h2('Let the take breathe'),
                    para('The films getting it right now share a single instinct: hold the shot. Give the performer the whole phrase. Let the camera move with the music instead of cutting against it. It sounds obvious, and it is the hardest thing to sell to a nervous studio, because it means committing to a take that either works or very visibly does not. When it works, the screen does something a stage never can — it puts you inside the number.'),
                    h2('The song is the story'),
                    para('The better new directors treat a song as plot, not pause. The number is where the character decides something, and the staging carries that decision — a slow push in as the resolve lands, a wide shot the moment they commit. The music stops being a break from the story and becomes the most efficient way to tell it.'),
                    para('It is a small craft revolution and an expensive one, and it is producing the first musicals in years that people leave humming instead of politely applauding. Turns out the format was never tired. It was just being shot by people who were scared of it.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'leaked-demo-sound-of-summer',
        status: 'published',
        authorSlug: 'nia-okonkwo',
        categories: ['Culture'],
        tags: ['Internet', 'Discourse'],
        body: {
            title: 'How a leaked demo became the sound of the summer',
            excerpt:
                'It was never released, never finished, and never officially acknowledged. It also soundtracked three months of everyone’s life. A story about how a song escapes its maker.',
            featuredImage: { $asset: 'story-demo' },
            body: {
                type: 'doc',
                content: [
                    para('The track that defined this summer does not exist, technically. There is no single, no streaming link that stays up for more than a day, no video. There is a two-minute phone recording of a rough mix that got out of a session, and there is what the internet did with it, which was everything.'),
                    h2('The song stops belonging to you'),
                    para('The old anxiety about a leak was money — a lost release, a blown rollout. The new anxiety is authorship. The moment the demo got out, thousands of people finished it: sped it up, slowed it down, put it under clips, wrote verses for it, decided what it was about. By the time the artist could respond, the song was no longer theirs to define. It had become a shared object, and the original was just one version among tens of thousands.'),
                    h2('Virality is not the same as a hit'),
                    para('It is tempting to call this a triumph of the algorithm, but that gets it backwards. The platforms did not choose this song; they noticed people had already chosen it, and turned up the tap. The distinction matters. A manufactured trend feels like being sold something. This felt like a rumour spreading — messy, participatory, impossible to buy. That is exactly why it worked, and exactly why it cannot be repeated on demand.'),
                    para('The artist has said almost nothing, which is probably the only sane move. Some songs you release. This one released itself, and the best you can do is get out of its way.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'reissue-machine-old-tapes-new-hits',
        status: 'published',
        authorSlug: 'jules-vega',
        categories: ['Music'],
        tags: ['Reissues', 'Archives'],
        body: {
            title: 'Inside the reissue machine turning old tapes into new hits',
            excerpt:
                'A generation of listeners is discovering records older than they are and treating them as brand new. Behind the scenes, a small industry is racing to feed the appetite.',
            featuredImage: { $asset: 'story-reissue' },
            body: {
                type: 'doc',
                content: [
                    para('A song recorded before most of its current audience was born spent this year at the top of the charts. It is not the first, and it will not be the last. The catalogue — the deep, dusty back half of recorded music — has become the most reliable growth market in the business, and there is now a whole trade dedicated to mining it.'),
                    h2('The archive is a warehouse'),
                    para('Reissue labels operate like archaeologists with lawyers. They track down the masters, clear the rights, restore the tape, and time the release for the moment a placement or a clip sends a forgotten track back into the conversation. When it works, a record that earned nothing for thirty years becomes a catalogue asset worth pursuing all over again.'),
                    h2('New ears, no context'),
                    para('What makes this era different is that the listeners do not experience these songs as old. Stripped of the context that once dated them, a track from decades ago arrives with no baggage — just the sound. Younger audiences are not being nostalgic; they genuinely encountered it for the first time last week, next to a song released last week, and judged them on the same terms.'),
                    para('There is something bracing in that. The canon is not a museum the young are being marched through. It is a pile of records they are digging through themselves, and keeping whatever still hits. The tape does not care how old it is. Neither, it turns out, do they.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: '50-greatest-debut-albums-ranked',
        status: 'published',
        authorSlug: 'nia-okonkwo',
        categories: ['Lists'],
        tags: ['Ranked', 'Albums'],
        body: {
            title: 'The 50 greatest debut albums, ranked',
            excerpt:
                'The first record is the only one an artist makes before anyone is watching. We argued for a month about what makes a debut great, then ranked fifty of them.',
            featuredImage: { $asset: 'story-list' },
            body: {
                type: 'doc',
                content: [
                    para('A debut album is a strange, singular thing: the only record an artist ever makes with no expectations, no audience, and nothing to lose. Everything after it is a response to being heard. The first one is made in private, and that shows — in the nerve, the mess, and the occasional flash of a fully-formed voice arriving from nowhere.'),
                    h2('How we ranked them'),
                    para('We were not looking for the most influential records or the best careers. We were looking for the best first statements — albums that walked in the door already knowing exactly who they were, or albums so alive with the sound of a band figuring it out in real time that the uncertainty became the point. Longevity counted. So did nerve. A safe, competent debut lost every argument in the room to a flawed, fearless one.'),
                    h2('What the great ones share'),
                    para('The debuts near the top of this list have almost nothing in common on the surface — different decades, genres, budgets, ambitions. What they share is a refusal to hedge. None of them sound like an audition for a bigger record later. Each one sounds like the whole point, made by people who did not yet know they were allowed to hold anything back. That is the quality no second album can fake, and it is why the first one so often stays the best.'),
                    para('The full ranking runs below, counted down from fifty. We expect you to disagree with roughly half of it. That is the job — a list is not a verdict, it is the start of the argument. Tell us what we got wrong.'),
                ],
            },
        },
    },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
    slug: 'culture-bold',
    key: 'sparx-culture-bold',
    name: 'Culture Bold',
    summary:
        'A loud music & pop-culture magazine — a full-bleed feature lead over a dense feed, a signature ranked “most read” countdown, and a bespoke bylined article page, on a near-black ground with one hot crimson-magenta accent and heavy condensed display type. Modelled on the bold-culture-magazine archetype; shipped as Static. Ships a light store (vinyl + merch) to demonstrate content + commerce together.',
    tagline: 'A loud dark-mode magazine template for a publication that reports and sells.',
    vertical: 'content',
    industry: 'Music & pop culture',
    requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
    sortWeight: 100,
    brand: {
        businessName: 'Static',
        tagline: 'Loud, on purpose.',
    },
    // A brand-left header with a filled CTA (Subscribe), and the newsletter footer whose
    // bottom bar carries the live © business name.
    chrome: { navbar: 'brandLeft', footer: 'newsletter', showCta: true },
    seo: {
        home: {
            title: 'Static — music & pop culture, loud on purpose',
            description:
                'Static is a music and pop-culture magazine covering the records, shows, films and arguments that actually move — reported loud, from the floor.',
        },
        about: {
            title: 'About Static — a music & pop-culture magazine',
            description:
                'Who Static is and how it works — an opinionated music and culture magazine that goes to the room, talks to the makers, and writes it down while it is still loud.',
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
