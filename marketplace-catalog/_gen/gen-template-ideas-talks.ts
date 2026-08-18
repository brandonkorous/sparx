// sparx-ideas-talks — the VIDEO-FORWARD content site template
// (docs/templates/content/ted). The talks-hub counterpart to the news feed: where that
// models a WORDPRESS-scale publisher, this models an IDEAS-AND-TALKS knowledge hub — a
// nonprofit whose atomic unit is a talk, not a post. A big idea-statement hero over a grid
// of talk cards, a live journal of ideas, a bespoke bylined talk writeup, and a light
// membership store, ported to sparx as The Commons — "Ideas worth the room".
//
// Dressed in the bespoke `podium` theme (warm-white ground, ONE bright coral accent, Outfit
// display over Work Sans body — the clean, optimistic look a talks hub wants), resolved
// AUTOMATICALLY from the slug through the shared harness.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts` (content-theme resolution + the `article` slot). The article
// DATA plumbing lives in the shared `template-sites/article.ts` kit.
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-template-ideas-talks.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-ideas-talks/**" \
//     "marketplace-catalog/_gen/**/*.ts"
//   pnpm --filter @wizeworks/api-rest marketplace:self-register
//
// A CONTENT template still ships the full 9-page superset (the module-independent rule:
// author complete, the installer writes the tenant's enabled slices) — so it carries a
// LIGHT commerce slice (a membership, an anthology, a notebook) that doubles as the
// content+commerce demo. The bespoke effort goes where the publisher lives: the talk page.
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
// Royalty-free Unsplash photographs — stage, speaker and audience frames. The thumbnails
// carry the color; the chrome stays neutral so they pop (podium's whole strategy).
const U = (id: string): string => `https://images.unsplash.com/photo-${id}?w=1400&q=80`;

const IMG = {
    // Talk / idea posters (each also a post's featuredImage via `$asset`)
    talkDoingLess: '1521737604893-d14cc237f11d',
    talkRiverTime: '1470071459604-3b5ec3a7fe05',
    talkHundredYears: '1503387762-592deb58ef4e',
    talkSecondChances: '1509228468518-180dd4864904',
    talkWalkableCity: '1449824913935-59a10b8d2000',
    talkListening: '1454165804606-c3d57bc86b40',
    // Speaker / curator portraits
    speakerOkonkwo: '1573496359142-b8d87734a5a2',
    speakerCastellano: '1500648767791-00dcc994a43e',
    speakerHalvorsen: '1580489944761-15a19d654956',
    // Store imagery
    membership: '1523580494863-6f3031224c94',
    anthology: '1544716278-ca5e3f4abd8c',
    notebook: '1531346878377-a5be20888e57',
} as const;

interface Asset {
    id: string;
    url: string;
    alt: string;
}

const ASSETS: Asset[] = [
    { id: 'talk-doing-less', url: U(IMG.talkDoingLess), alt: 'A speaker mid-talk on a bright stage' },
    { id: 'talk-river-time', url: U(IMG.talkRiverTime), alt: 'A slow river winding through a green valley' },
    { id: 'talk-hundred-years', url: U(IMG.talkHundredYears), alt: 'A curved concrete building against the sky' },
    { id: 'talk-second-chances', url: U(IMG.talkSecondChances), alt: 'Equations chalked across a dark board' },
    { id: 'talk-walkable-city', url: U(IMG.talkWalkableCity), alt: 'A quiet, tree-lined city street' },
    { id: 'talk-listening', url: U(IMG.talkListening), alt: 'Two people in close conversation over notes' },
    { id: 'speaker-okonkwo', url: U(IMG.speakerOkonkwo), alt: 'Portrait of Ada Okonkwo' },
    { id: 'speaker-castellano', url: U(IMG.speakerCastellano), alt: 'Portrait of Ren Castellano' },
    { id: 'speaker-halvorsen', url: U(IMG.speakerHalvorsen), alt: 'Portrait of Mira Halvorsen' },
    { id: 'membership', url: U(IMG.membership), alt: 'An audience seated in a warm-lit hall' },
    { id: 'anthology', url: U(IMG.anthology), alt: 'A hardback anthology resting on a desk' },
    { id: 'notebook', url: U(IMG.notebook), alt: 'An open notebook beside a pen' },
];

const assetUrl = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-ideas-talks: unknown asset "${id}"`);
    return a.url;
};

// ── Home page bands (the talks-hub front page) ────────────────────────────────────

/** The big idea-statement HERO — no photo, a single confident statement on a warm-white
 *  band, the page's one `<h1>`. The talks hub leads with a promise, not a headline feed. */
function heroBand(): Node {
    return el('section', 'bg-base-200 @container px-6 py-20 @3xl:py-28', {
        children: [
            el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-8', {
                children: [
                    el('span', 'text-sm font-semibold uppercase tracking-wide text-primary', {
                        text: 'The Commons',
                    }),
                    el(
                        'h1',
                        'max-w-4xl text-4xl font-bold leading-tight tracking-tight text-base-content @3xl:text-6xl',
                        {
                            text: 'The best ideas deserve a room, an audience, and the time to actually land.',
                        },
                    ),
                    el('p', 'max-w-2xl text-xl leading-relaxed text-base-content', {
                        text: 'The Commons is a nonprofit stage for public thinking — talks and essays from the people worth listening to, gathered in one place and kept free for everyone. Pull up a chair.',
                    }),
                    el('div', 'flex flex-col gap-4 @2xl:flex-row', {
                        children: [
                            el('a', 'btn btn-primary btn-lg', {
                                attrs: { href: '/journal' },
                                text: 'Watch the talks',
                            }),
                            el('a', 'btn btn-lg btn-neutral btn-outline', {
                                attrs: { href: '/shop' },
                                text: 'Become a member',
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });
}

/** ONE talk card — a 16:9 poster over a solid card body: topic rubric, title, speaker, and
 *  a watch link. Plain and simple; all text sits BELOW the image in the card, never on it. */
function talkCard(assetId: string, topic: string, title: string, speaker: string): Node {
    return el('a', 'group flex flex-col gap-4 rounded-box border border-base-300 bg-base-100 p-4', {
        attrs: { href: '/journal' },
        children: [
            el('img', 'aspect-video w-full rounded-box border border-base-300 bg-base-200 object-cover', {
                attrs: { src: assetUrl(assetId), alt: `Poster for “${title}”`, loading: 'lazy' },
            }),
            el('span', 'text-sm font-semibold uppercase tracking-wide text-primary', { text: topic }),
            // h3: these cards sit UNDER the section's h2 ("Talks worth watching"), so they are
            // subordinate to it — h2→h3 is the correct step, never a skip (blueprint-sweep).
            el('h3', 'text-xl font-semibold leading-snug text-base-content', { text: title }),
            el('p', 'text-base text-base-content', { text: `${speaker}` }),
            el('span', 'text-base font-semibold text-primary', { text: 'Watch the talk →' }),
        ],
    });
}

/** The talk-card GRID — the homepage's centre of gravity, the "watch" river. */
function talkGrid(): Node {
    return el('section', 'bg-base-100 @container px-6 py-16', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-10', {
                children: [
                    el('div', 'flex flex-col gap-3', {
                        children: [
                            el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
                                text: 'Talks worth watching',
                            }),
                            el('p', 'max-w-2xl text-lg text-base-content', {
                                text: 'Curated from the stage — an idea, a person, and the time to make the case.',
                            }),
                        ],
                    }),
                    el('div', 'grid gap-8 @2xl:grid-cols-2 @4xl:grid-cols-3', {
                        children: [
                            talkCard('talk-doing-less', 'Society', 'The quiet power of doing less', 'Ada Okonkwo'),
                            talkCard('talk-river-time', 'Nature', 'What a river taught me about time', 'Ren Castellano'),
                            talkCard('talk-hundred-years', 'Design', 'Designing for the next hundred years', 'Mira Halvorsen'),
                            talkCard('talk-second-chances', 'Science', 'The math of second chances', 'Ada Okonkwo'),
                            talkCard('talk-walkable-city', 'Society', 'Why your city should be walkable', 'Ren Castellano'),
                            talkCard('talk-listening', 'Society', 'The forgotten art of listening', 'Mira Halvorsen'),
                        ],
                    }),
                ],
            }),
        ],
    });
}

/** The topics / themes browse — a tile block. A talks hub is a library organised by idea,
 *  so it browses by THEME as much as by recency. Each tile links to the journal index. */
function topicsBrowse(): Node {
    const tile = (name: string, blurb: string): Node =>
        el('a', 'group flex flex-col gap-2 rounded-box border border-base-300 bg-base-100 p-6', {
            attrs: { href: '/journal' },
            children: [
                el('h3', 'text-xl font-semibold text-base-content', { text: name }),
                el('p', 'text-base leading-relaxed text-base-content', { text: blurb }),
                el('span', 'text-base font-semibold text-primary', { text: 'Explore →' }),
            ],
        });
    return el('section', 'bg-base-200 @container px-6 py-16', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-10', {
                children: [
                    el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
                        text: 'Browse by idea',
                    }),
                    el('div', 'grid gap-6 @2xl:grid-cols-2 @4xl:grid-cols-4', {
                        children: [
                            tile('Society', 'How we live together, and how we might do it better.'),
                            tile('Nature', 'The living world, and our place inside it.'),
                            tile('Design', 'Making things that last, on purpose.'),
                            tile('Science', 'What we know, how we know it, and what comes next.'),
                        ],
                    }),
                ],
            }),
        ],
    });
}

/** A plain section heading band, for the label over the bound live feed. */
function headingBand(heading: string, lead: string): Node {
    return el('section', 'bg-base-100 @container px-6 pt-16 pb-2', {
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

/** Upcoming at The Commons — the gathering side of the mission. Dated, each with a place. */
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
                        el('a', 'text-base font-semibold text-primary', {
                            attrs: { href: '/journal' },
                            text: 'Reserve a seat →',
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
                        text: 'Upcoming at The Commons',
                    }),
                    el('ul', 'flex flex-col', {
                        children: [
                            event(
                                '24',
                                'Sep',
                                'The Commons 2026: an evening of talks',
                                'Six speakers, one stage, one long night of ideas — our flagship gathering, open to members and the curious alike.',
                                'Chicago · 6pm CT',
                            ),
                            event(
                                '11',
                                'Oct',
                                'Salon: what we owe the future',
                                'A small, in-the-round conversation with three of our speakers on the ideas that outlast us.',
                                'Members only · online',
                            ),
                            event(
                                '02',
                                'Nov',
                                'Workshop: how to give the talk of your life',
                                'A working afternoon for anyone with an idea and the nerve to stand up and share it.',
                                'Portland · 1pm PT',
                            ),
                        ],
                    }),
                ],
            }),
        ],
    });
}

/** The mission band — the nonprofit's ask, in-voice, leading into the support store. */
function missionBand(): Node {
    return el('section', 'bg-base-200 @container px-6 py-16', {
        children: [
            el('div', 'mx-auto flex w-full max-w-3xl flex-col items-start gap-6', {
                children: [
                    el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
                        text: 'Ideas are worth sharing — help us keep them free',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'Every talk on The Commons is free to watch, and it stays that way because members pay for the room, the recording and the years of archive behind it. Join them, or take a little of the stage home with you.',
                    }),
                ],
            }),
        ],
    });
}

const HOME: Node[] = [
    heroBand(),
    talkGrid(),
    topicsBrowse(),
    headingBand('From the journal', 'Essays and notes from the desk, newest first.'),
    blogPostGrid(),
    eventsBand(),
    missionBand(),
    // The content→commerce bridge: the nonprofit's own support store, as a live carousel.
    productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'Support the Commons' }),
];

// ── The bespoke talk / idea page (the content template's signature surface) ────────
// A bylined talk writeup: the topic rubric over the title, a real byline (speaker + date),
// the poster image, the written transcript body, and a speaker card at the foot. Every
// bound field resolves against the routed post (the `article.ts` kit's `repeat('blog_post')`
// scope); the byline lights up from the storefront's projection — a post with no author
// simply renders no byline, never a blank line.

/** The talk MASTHEAD — authored UNSCOPED; `articlePage` wraps it in `repeat('blog_post')`. */
function articleMasthead(): Node {
    return el('section', 'bg-base-200 @container px-6 pt-12 pb-14 @2xl:pt-16', {
        children: [
            el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-5', {
                children: [
                    el('a', 'inline-flex w-fit items-center gap-2 text-base font-semibold text-primary', {
                        attrs: { href: '/journal' },
                        children: [el('span', undefined, { text: '←' }), el('span', undefined, { text: 'All talks' })],
                    }),
                    // The topic rubric — the editorial eyebrow, bound to the post's category.
                    articleRubric('text-sm font-semibold uppercase tracking-wide text-primary'),
                    articleTitle(
                        'h1',
                        'text-4xl font-bold leading-tight tracking-tight text-base-content @2xl:text-5xl',
                    ),
                    articleStandfirst('max-w-2xl text-xl leading-relaxed text-base-content'),
                    // The byline row — speaker portrait, name, and date.
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

/** The poster image band, at the article measure. */
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

/** The speaker card at the foot — portrait, name, bio. Gated on the bio, so it appears only
 *  when there is genuinely something to say about who gave the talk. */
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
                        text: 'The Commons Journal',
                    }),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Talks and essays from the stage — the ideas, the people behind them, and the notes we could not fit into an evening.',
                    }),
                ],
            }),
        ],
    }),
];

// ── About + Contact (The Commons–voiced) ──────────────────────────────────────────

const ABOUT: Node[] = [
    el('section', 'bg-base-100 @container px-6 py-20', {
        children: [
            el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-6', {
                children: [
                    el('h1', 'text-4xl font-bold tracking-tight text-base-content @2xl:text-5xl', {
                        text: 'About The Commons',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'The Commons is a nonprofit dedicated to a simple idea: that a good idea, given a stage and an honest hour, can change how someone sees the world. We find people worth listening to, give them the room to make their case, and keep the recording free for anyone who wants to watch.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'We take no money from anyone who would rather we not say something. Our talks and essays are paid for by members and supporters, which is the only arrangement that lets a stage stay genuinely open — to the unfashionable idea, the quiet expert, and the argument that needs more than a headline to land.',
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
        heading: 'Bring us an idea',
        intro: 'Have a talk in you, a speaker to nominate, or a question about membership? We read everything, and we answer the ones we can. Tell us what you are thinking about.',
        submitLabel: 'Email The Commons',
    }),
];

// ── Light commerce (support the Commons — membership, an anthology, a notebook) ────

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
        handle: 'commons-membership',
        title: 'The Commons Membership — annual',
        description:
            'The membership that keeps the stage free. Members fund the recordings and the archive, get the members-only salons, and hear about new talks first. The single most useful thing you can do to keep ideas in the open.',
        status: 'active',
        productType: 'Membership',
        vendor: 'The Commons',
        tags: ['membership', 'subscription', 'support'],
        categoryHandles: ['membership'],
        collectionHandles: ['featured'],
        seoTitle: 'The Commons Membership — annual support',
        seoDescription: 'Annual membership that keeps every talk free: the archive, the salons, and early access.',
        variants: [{ sku: 'CMN-MEM-ANNUAL', priceCents: money(90), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'membership', isPrimary: true, alt: 'An audience seated in a warm-lit hall' }],
    },
    {
        handle: 'ideas-worth-the-room',
        title: 'Ideas Worth the Room — the anthology',
        description:
            'Twenty of the talks that defined our first years, transcribed and set in print with the speakers’ own notes in the margins. A hardback you can read in an afternoon and argue with for a year.',
        status: 'active',
        productType: 'Book',
        vendor: 'The Commons',
        tags: ['book', 'anthology'],
        categoryHandles: ['books'],
        collectionHandles: ['featured'],
        seoTitle: 'Ideas Worth the Room — the anthology | The Commons',
        seoDescription: 'A hardback anthology of twenty defining talks, transcribed with the speakers’ own notes.',
        variants: [{ sku: 'CMN-BOOK-ANTH', priceCents: money(32), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'anthology', isPrimary: true, alt: 'The Ideas Worth the Room anthology' }],
    },
    {
        handle: 'commons-notebook',
        title: 'The Commons Notebook',
        description:
            'A cloth-bound notebook for the ideas you have in the dark on the walk home. A hundred and sixty numbered pages, a ribbon, and the smallest possible masthead on the cover.',
        status: 'active',
        productType: 'Book',
        vendor: 'The Commons',
        tags: ['notebook', 'stationery'],
        categoryHandles: ['books'],
        collectionHandles: ['featured'],
        seoTitle: 'The Commons Notebook — cloth-bound, 160 pages',
        seoDescription: 'A cloth-bound notebook with 160 numbered pages, a ribbon, and a small masthead.',
        variants: [{ sku: 'CMN-NOTEBOOK', priceCents: money(18), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'notebook', isPrimary: true, alt: 'The Commons cloth-bound notebook' }],
    },
];

const COMMERCE = {
    categories: [
        { handle: 'membership', name: 'Membership', description: 'Keep the stage free.', featured: true },
        { handle: 'books', name: 'Books & goods', description: 'Take a little of the stage home.', featured: true },
    ],
    collections: [
        {
            handle: 'featured',
            name: 'Support the Commons',
            description: 'The three things that keep the talks free and the lights on.',
            type: 'manual',
            featured: true,
            productHandles: ['commons-membership', 'ideas-worth-the-room', 'commons-notebook'],
        },
    ],
    products: PRODUCTS,
};

// ── The speakers / curators (byline personas) ─────────────────────────────────────
// Real people the posts reference by `authorSlug`. The installer seeds these as CMS
// `Author` rows scoped to the site, and the storefront byline projection resolves them —
// so the bespoke talk page shows a real name, portrait and bio, not an empty byline.

const AUTHORS = [
    {
        slug: 'ada-okonkwo',
        displayName: 'Ada Okonkwo',
        bio: 'Ada Okonkwo is a behavioural scientist who studies how people make decisions when there is more information than attention. She has spent fifteen years asking why doing less is so much harder than doing more.',
        avatarAssetId: 'speaker-okonkwo',
    },
    {
        slug: 'ren-castellano',
        displayName: 'Ren Castellano',
        bio: 'Ren Castellano is a naturalist and writer who works at the edges of cities, where the built world meets the living one. He is happiest explaining a river, a street or a season to anyone who will slow down long enough to hear it.',
        avatarAssetId: 'speaker-castellano',
    },
    {
        slug: 'mira-halvorsen',
        displayName: 'Mira Halvorsen',
        bio: 'Mira Halvorsen is a designer who builds things meant to outlast their makers — buildings, tools and institutions. She teaches that the first question of any design is who gets to use it in a hundred years.',
        avatarAssetId: 'speaker-halvorsen',
    },
];

// ── Content (the talks + ideas) ───────────────────────────────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });

const CONTENT = [
    {
        typeKey: 'blog_post',
        slug: 'quiet-power-of-doing-less',
        status: 'published',
        authorSlug: 'ada-okonkwo',
        categories: ['Society'],
        tags: ['Attention', 'Decisions'],
        body: {
            title: 'The quiet power of doing less',
            excerpt:
                'We treat a full calendar as proof of a full life. In this talk, Ada Okonkwo makes the case that most of what we call productivity is just motion — and that the hardest, most valuable skill is choosing what not to do.',
            featuredImage: { $asset: 'talk-doing-less' },
            body: {
                type: 'doc',
                content: [
                    para('Ask someone how they are and they will tell you how busy they are, as if the two were the same answer. We have built a culture that reads a packed day as evidence of a well-lived one — and it is quietly making us worse at the things that actually matter.'),
                    h2('Motion is not progress'),
                    para('Most of what fills a day is motion: the reply that could have waited, the meeting that could have been a sentence, the task we do because it is easy and visible rather than because it is important. Motion feels like progress because it is tiring, and we have learned to trust tiredness as a signal. It is not one.'),
                    h2('The skill is subtraction'),
                    para('The people who do genuinely important work are not the ones who do the most things. They are the ones who have gotten ruthless about which few things deserve them, and unapologetic about letting the rest go undone. Subtraction is a skill, and like any skill it feels wrong before it feels natural.'),
                    para('So here is the exercise I leave every audience with: look at tomorrow, and cross off the one thing you are dreading that no one would actually miss. Notice what you do with the hour it gives back. That hour is the whole talk.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'what-a-river-taught-me-about-time',
        status: 'published',
        authorSlug: 'ren-castellano',
        categories: ['Nature'],
        tags: ['Rivers', 'Patience'],
        body: {
            title: 'What a river taught me about time',
            excerpt:
                'Ren Castellano spent a year walking the length of one river, from spring to sea. What he found was less a lesson about water than about time — how slowly the important things move, and how much we miss by hurrying.',
            featuredImage: { $asset: 'talk-river-time' },
            body: {
                type: 'doc',
                content: [
                    para('A river looks like it is in a hurry, and it is not. The water moving past your feet has been on its way for weeks, and the valley it cut took longer than any of us can picture. I spent a year walking one river from its spring to the sea, and it slowly rearranged how I think about time.'),
                    h2('The slow work is the real work'),
                    para('Everything a river does that matters — the canyon, the delta, the bend that moves a mile in a century — it does slowly, at a pace no single day would ever reveal. We are built to notice the flood and ignore the erosion, and so we mistake the dramatic for the important. The river is almost never dramatic. It is almost always working.'),
                    h2('You cannot rush a season'),
                    para('There is no version of the walk where I get to the sea faster by wanting it more. The river ignores urgency completely, and there is something enormously freeing in spending time with a thing that cannot be hurried. It gives you permission to let your own slow work be slow.'),
                    para('When people ask what the river taught me, they want a tidy sentence. Here is the closest one I have: the things that will still matter in a hundred years are moving at exactly the speed they should be. Our impatience is the only thing that is early.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'designing-for-the-next-hundred-years',
        status: 'published',
        authorSlug: 'mira-halvorsen',
        categories: ['Design'],
        tags: ['Longevity', 'Craft'],
        body: {
            title: 'Designing for the next hundred years',
            excerpt:
                'Most of what we build is designed to be replaced. Mira Halvorsen asks what changes when you design instead for the person who will use the thing in a century — and why that question makes better objects, buildings and institutions today.',
            featuredImage: { $asset: 'talk-hundred-years' },
            body: {
                type: 'doc',
                content: [
                    para('We design almost everything to be replaced. The phone is built for three years, the building for thirty, the software for whenever the next version ships. Planned replacement is not a scandal — it is just the default — but it quietly shapes everything we make into something a little disposable.'),
                    h2('The hundred-year user'),
                    para('I ask my students to design for a person who will use the thing in a hundred years — someone they will never meet, in a world they cannot predict. It sounds like an impossible constraint. In practice it is clarifying. You stop optimising for the launch and start asking what will still make sense, still be repairable, still be legible, long after the trend that produced it is forgotten.'),
                    h2('Longevity is a kindness'),
                    para('A thing built to last is a kindness to a stranger. It says: someone before you thought about you. The best old buildings, tools and institutions all carry that quality — they were made by people who assumed the future would arrive and tried to leave it something worth having.'),
                    para('You do not need a hundred-year budget to design this way. You need the hundred-year question, asked early, out loud, before the first decision hardens. Ask it, and watch how much of the disposable falls away on its own.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'the-math-of-second-chances',
        status: 'published',
        authorSlug: 'ada-okonkwo',
        categories: ['Science'],
        tags: ['Probability', 'Fairness'],
        body: {
            title: 'The math of second chances',
            excerpt:
                'A single failure tells you almost nothing. Ada Okonkwo walks through the simple probability that explains why our instinct to judge people on one bad outcome is not just unkind — it is statistically wrong.',
            featuredImage: { $asset: 'talk-second-chances' },
            body: {
                type: 'doc',
                content: [
                    para('We are quick to draw a line through a single point. Someone fails once and we treat it as data about who they are, when the mathematics says a single outcome is one of the least informative things you can observe.'),
                    h2('One point is not a line'),
                    para('Any outcome is a mix of skill, effort and luck, and from a single result you genuinely cannot separate them. The same coin that just came up tails is not a worse coin than the one that came up heads. Judging a person on one attempt is drawing a line through one point — and a line through one point can go anywhere you already wanted it to.'),
                    h2('The case for another try'),
                    para('This is not a soft argument, it is a statistical one: the second attempt is where the signal lives. Give people another try and their true ability starts to show through the noise. Systems that offer second chances are not being generous so much as being accurate — they are collecting the data that a first impression threw away.'),
                    para('So the next time you are tempted to close the book on someone after one bad chapter, remember that you are working with a sample size of one. The honest thing to do with a sample of one is to keep reading.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'why-your-city-should-be-walkable',
        status: 'published',
        authorSlug: 'ren-castellano',
        categories: ['Society'],
        tags: ['Cities', 'Streets'],
        body: {
            title: 'Why your city should be walkable',
            excerpt:
                'A walkable street is not a nostalgia project. Ren Castellano lays out how the simple act of designing a city around people on foot changes its health, its economy, and the odds that strangers ever meet.',
            featuredImage: { $asset: 'talk-walkable-city' },
            body: {
                type: 'doc',
                content: [
                    para('The most radical thing a city can do is make it pleasant to walk. It sounds quaint next to grand plans and big budgets, and it quietly outperforms almost all of them.'),
                    h2('A street is a public room'),
                    para('When a street is built for people on foot, it stops being a channel for moving cars and becomes a room the whole neighbourhood shares. People linger, shops that need footfall survive, and strangers cross paths often enough to become familiar. None of that happens at forty miles an hour behind glass.'),
                    h2('The health is a side effect'),
                    para('The health benefits of a walkable city are enormous, and the interesting part is that nobody has to choose them. You do not decide to exercise; you decide to buy bread, and the city was arranged so that the walk came free with the errand. The best public health policy is often just good street design wearing a disguise.'),
                    para('You can measure a city by asking one question: would you let an eight-year-old walk to get an ice cream alone? Where the answer is yes, almost everything else is working. Where it is no, we have built the whole place around the wrong thing.'),
                ],
            },
        },
    },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
    slug: 'ideas-talks',
    key: 'sparx-ideas-talks',
    name: 'Ideas & Talks',
    summary:
        'A video-forward home for an ideas-and-talks nonprofit — a big idea-statement hero over a grid of talk cards, a themes browse, a live journal of essays, and a bespoke bylined talk page, in a clean warm-white one-coral theme. Modelled on the talks-hub archetype; shipped as The Commons. Ships a light membership store (an annual membership, an anthology, a notebook) to demonstrate content + commerce together.',
    tagline: 'A talks-hub template for a nonprofit that shares ideas and asks for support.',
    vertical: 'content',
    industry: 'Ideas, talks & public thinking',
    requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
    sortWeight: 100,
    brand: {
        businessName: 'The Commons',
        tagline: 'Ideas worth the room.',
    },
    // A brand-left header with a filled CTA (Become a member), and the newsletter footer whose
    // bottom bar carries the live © business name.
    chrome: { navbar: 'brandLeft', footer: 'newsletter', showCta: true },
    seo: {
        home: {
            title: 'The Commons — ideas and talks, free for everyone',
            description:
                'The Commons is a nonprofit stage for public thinking — talks and essays from people worth listening to, gathered in one place and kept free for everyone.',
        },
        about: {
            title: 'About The Commons — a nonprofit stage for ideas',
            description:
                'Who The Commons is and how it is paid for — member-funded talks and essays that keep an open stage free of anyone who would rather we stay quiet.',
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
