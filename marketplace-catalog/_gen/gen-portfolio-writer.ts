// sparx-portfolio-writer — the WRITER / essayist portfolio (codename Broadsheet).
//
// The "read-me" portfolio for a working writer: essays, reporting, a newsletter, criticism.
// THE WORDS ARE THE WORK, so the type is the hero — a TYPE-ONLY editorial masthead (no hero
// image), a warm-paper reading page set in SERIF ACROSS (a high-contrast display serif over a
// readable text serif), and selected writing shown as an INDEX of rows, not a wall of cards.
// One oxblood carries the byline rubrics, the links and the single primary action; everything
// else is ink on paper. Restraint is the whole point — the sentences do the work, not motion.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `portfolio-sites/harness.ts`; the reading page's DATA plumbing lives in the shared
// `template-sites/article.ts` kit (a piece is a `cms.blog_post` record — see the harness
// header for why). Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-portfolio-writer.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-portfolio-writer/**" \
//     "marketplace-catalog/_gen/gen-portfolio-writer.ts"
//
// LIGHT THEME, SEMANTIC TOKENS ONLY. `manuscript` is a warm-paper page (`bg-base-100`), ink is
// a soft near-black (`text-base-content`), and the signal is an oxblood red (`text-primary` /
// `btn-primary`), spent only on rubrics, links and the one CTA. No hardcoded colors — surfaces
// separate by a `bg-base-200` shift + a hairline `border-base-300`, never a gradient or shadow.
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
    articleAuthorAvatar,
    articleAuthorCard,
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
    "manuscript-desk": "https://images.unsplash.com/photo-1578589335615-9e804277a5af?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d3JpdGVyJTIwZGVzayUyMG5vdGVib29rJTIwY29mZmVlJTIwbW9ybmluZ3xlbnwwfDB8fHwxNzg2Mzk5ODExfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "manuscript-city": "https://images.unsplash.com/photo-1629770533831-7c5181ac29f9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmFpbiUyMGNpdHklMjBzdHJlZXQlMjBkdXNrJTIwbGlnaHRzfGVufDB8MHx8fDE3ODYzOTk4MTZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "manuscript-window": "https://images.unsplash.com/photo-1780399334727-19bfe82d27bb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmFpbiUyMHdpbmRvdyUyMGJvb2slMjBpbnRlcmlvciUyMHF1aWV0fGVufDB8MHx8fDE3ODYzOTk4MTl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "manuscript-letters": "https://images.unsplash.com/photo-1699662585297-8bcb021fd94c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bGV0dGVycHJlc3MlMjBtZXRhbCUyMHR5cGUlMjBjbG9zZSUyMHVwfGVufDB8MHx8fDE3ODYzOTk4MjJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "manuscript-shelf": "https://images.unsplash.com/photo-1719310469053-8c5c0c6803d3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym9va3NoZWxmJTIwd29ybiUyMGJvb2tzJTIwc3BpbmVzfGVufDB8MHx8fDE3ODYzOTk4MjV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "manuscript-portrait": "https://images.unsplash.com/photo-1600188769045-bc6026bfc8cd?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d3JpdGVyJTIwcG9ydHJhaXQlMjB3aW5kb3clMjBkYXlsaWdodHxlbnwwfDB8fHwxNzg2Mzk5ODI4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string =>
    PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
    id: string;
    url: string;
    alt: string;
}

const ASSETS: Asset[] = [
    { id: 'manuscript-desk', url: src('manuscript-desk'), alt: 'A writer’s desk in morning light — loose pages, a notebook, and a cooling cup of coffee' },
    { id: 'manuscript-city', url: src('manuscript-city'), alt: 'A rain-slicked city street at dusk, shopfront light pooling on the pavement' },
    { id: 'manuscript-window', url: src('manuscript-window'), alt: 'Rain running down a window over a quiet interior, an open book on the sill' },
    { id: 'manuscript-letters', url: src('manuscript-letters'), alt: 'A tray of metal letterpress type, close enough to read the mirrored letters' },
    { id: 'manuscript-shelf', url: src('manuscript-shelf'), alt: 'A wall of well-read books, spines worn soft at the corners' },
    { id: 'manuscript-portrait', url: src('manuscript-portrait'), alt: 'Portrait of Iris Bellamy, writer, at a window in even daylight' },
];

const assetUrl = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-portfolio-writer: unknown asset "${id}"`);
    return a.url;
};

// ── Home page bands ────────────────────────────────────────────────────────────────

/** The TYPE-ONLY masthead — no image, no flourish: the writer's name set large in the display
 *  serif, a one-line oxblood statement of what she writes, and a reading-measure standfirst. The
 *  words carry it; that is the whole pitch of a writer's page. */
function mastheadBand(): Node {
    return el('section', 'bg-base-100 @container px-6 pt-20 pb-16 @3xl:pt-28', {
        children: [
            el('div', 'mx-auto flex w-full max-w-4xl flex-col gap-8', {
                children: [
                    el('div', 'flex flex-col gap-5', {
                        children: [
                            el(
                                'h1',
                                'text-6xl font-medium leading-none tracking-tight text-base-content @2xl:text-8xl @3xl:text-9xl',
                                { text: 'Iris Bellamy' }
                            ),
                            el(
                                'p',
                                'text-xl font-medium leading-snug text-primary @2xl:text-2xl',
                                { text: 'Essays and reporting on work, cities, and attention.' }
                            ),
                        ],
                    }),
                    el('p', 'max-w-2xl text-xl leading-relaxed text-base-content @2xl:text-2xl', {
                        text: 'I write long and short — reported features, first-person essays, and a fortnightly newsletter — about how we spend our days: the work we do, the places we do it in, and the small daily fight to keep our attention our own. Fifteen years at it, most of them freelance, always following the question rather than the beat.',
                    }),
                ],
            }),
        ],
    });
}

/** One SELECTED-WRITING row — the format that makes this a reader's index, not a card wall: an
 *  oxblood category rubric, the piece title set in the display serif and linking to its reading
 *  page, a one-line dek, and the publication + date as a readable micro-label. Rows are divided
 *  by a single hairline `border-t`, so the page reads as a masthead index. */
function writingRow(opts: {
    rubric: string;
    title: string;
    dek: string;
    publication: string;
    date: string;
    href: string;
}): Node {
    const lede = el('div', 'flex flex-col gap-3 @2xl:col-span-2', {
        children: [
            el('span', 'text-sm font-semibold uppercase tracking-wide text-primary', { text: opts.rubric }),
            el('a', 'block text-3xl font-medium leading-tight tracking-tight text-base-content transition-colors hover:text-primary @2xl:text-4xl', {
                attrs: { href: opts.href },
                text: opts.title,
            }),
            el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', { text: opts.dek }),
        ],
    });
    const meta = el('div', 'flex flex-col gap-1 @2xl:items-end @2xl:text-right', {
        children: [
            el('span', 'text-base font-semibold text-base-content', { text: opts.publication }),
            el('span', 'text-sm text-secondary', { text: opts.date }),
        ],
    });
    return el('div', 'grid gap-4 border-t border-base-300 pt-8 @2xl:grid-cols-3 @2xl:items-baseline @2xl:gap-8', {
        children: [lede, meta],
    });
}

/** The selected-writing section — a quiet heading over the hairline-ruled index of pieces. */
function selectedWritingBand(): Node {
    return el('section', 'bg-base-100 @container px-6 py-16 @3xl:py-24', {
        children: [
            el('div', 'mx-auto flex w-full max-w-4xl flex-col gap-10', {
                children: [
                    el('h2', 'text-2xl font-medium tracking-tight text-base-content @3xl:text-3xl', {
                        text: 'Selected writing',
                    }),
                    el('div', 'flex flex-col gap-10', {
                        children: [
                            writingRow({
                                rubric: 'Essay',
                                title: 'The Long Way to the Desk',
                                dek: 'On the small, stubborn rituals we build around work — and what they quietly protect us from.',
                                publication: 'Meridian Quarterly',
                                date: 'March 2026',
                                href: '/blog/the-long-way-to-the-desk',
                            }),
                            writingRow({
                                rubric: 'Reporting',
                                title: 'What the Night Shift Knows',
                                dek: 'Three months among the people who keep a city running while it sleeps, and the hours the daytime never sees.',
                                publication: 'The Coastal Review',
                                date: 'January 2026',
                                href: '/blog/what-the-night-shift-knows',
                            }),
                            writingRow({
                                rubric: 'Newsletter',
                                title: 'Notes on Attention, No. 14',
                                dek: 'A fortnightly letter — this issue, on the difference between being interrupted and being distracted.',
                                publication: 'The Long Field',
                                date: 'Issue 14 · 2026',
                                href: '/blog/notes-on-attention-14',
                            }),
                            writingRow({
                                rubric: 'Criticism',
                                title: 'The Novel That Refuses to End',
                                dek: 'On long books, slow reading, and why the best endings are the ones that decline to resolve.',
                                publication: 'Ledger & Ink',
                                date: 'November 2025',
                                href: '/blog/the-novel-that-refuses-to-end',
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });
}

/** The closing band — a short bio line and a quiet contact line, on a hairline. No CTA button;
 *  the oxblood link is invitation enough for a page whose whole voice is restraint. */
function colophonBand(): Node {
    return el('section', 'bg-base-100 @container px-6 pb-24', {
        children: [
            el('div', 'mx-auto flex w-full max-w-4xl flex-col gap-4 border-t border-base-300 pt-10', {
                children: [
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Iris Bellamy is a writer based on the coast. Her work has appeared in Meridian Quarterly, The Coastal Review and Ledger & Ink, and she writes The Long Field, a fortnightly newsletter on work and attention.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        children: [
                            el('span', undefined, { text: 'For commissions, pitches and the newsletter — ' }),
                            el('a', 'font-semibold text-primary transition-colors hover:text-base-content', {
                                attrs: { href: '/contact' },
                                text: 'get in touch',
                            }),
                            el('span', undefined, { text: '.' }),
                        ],
                    }),
                ],
            }),
        ],
    });
}

const HOME: Node[] = [mastheadBand(), selectedWritingBand(), colophonBand()];

// ── Work index masthead (over the live, linkable piece grid) ───────────────────────

const WORK: Node[] = [
    el('section', 'bg-base-100 @container px-6 pt-20 pb-12 @3xl:pt-24', {
        children: [
            el('div', 'mx-auto flex w-full max-w-4xl flex-col gap-5 border-b border-base-300 pb-10', {
                children: [
                    el(
                        'h1',
                        'text-6xl font-medium leading-none tracking-tight text-base-content @3xl:text-8xl',
                        { text: 'Writing' }
                    ),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Essays, reporting, criticism and the newsletter — the last few years of it, most recent first. Each piece opens to the full read.',
                    }),
                ],
            }),
        ],
    }),
];

// ── The bespoke reading page ───────────────────────────────────────────────────────
// A writer's piece: the section rubric over the title, a standfirst, a plain byline (Iris + the
// date), the featured image, then the written body on a comfortable reading measure, and a card
// about the writer at the foot. Every bound field resolves against the routed piece via the
// article kit's `repeat('blog_post')` scope.

function projectMasthead(): Node {
    return el('section', 'bg-base-100 @container px-6 pt-16 pb-10', {
        children: [
            el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-5', {
                children: [
                    el('a', 'inline-flex w-fit items-center gap-2 text-base font-semibold text-primary transition-colors hover:text-base-content', {
                        attrs: { href: '/work' },
                        children: [
                            el('span', undefined, { text: '←' }),
                            el('span', undefined, { text: 'All writing' }),
                        ],
                    }),
                    articleRubric('text-sm font-semibold uppercase tracking-wide text-primary'),
                    articleTitle(
                        'h1',
                        'text-4xl font-medium leading-tight tracking-tight text-base-content @2xl:text-6xl',
                    ),
                    articleStandfirst('max-w-2xl text-xl leading-relaxed text-base-content @2xl:text-2xl'),
                    el('div', 'mt-2 flex items-center gap-3 border-t border-base-300 pt-5', {
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
                        'aspect-video w-full border border-base-300 bg-base-200 object-cover',
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
                            'flex flex-col gap-4 border-t border-base-300 pt-8 @2xl:flex-row @2xl:items-center',
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

// ── About + Contact (Iris-voiced) ───────────────────────────────────────────────────

/** One "selected bylines" row — a publication over the genre it ran, divided by a hairline. */
function bylineRow(publication: string, genre: string): Node {
    return el('div', 'flex items-baseline justify-between gap-6 border-t border-base-300 py-3', {
        children: [
            el('span', 'text-base font-semibold text-base-content', { text: publication }),
            el('span', 'text-sm text-secondary', { text: genre }),
        ],
    });
}

const ABOUT: Node[] = [
    el('section', 'bg-base-100 @container px-6 py-20', {
        children: [
            el('div', 'mx-auto grid w-full max-w-5xl gap-12 @3xl:grid-cols-3 @3xl:items-start', {
                children: [
                    el('div', 'flex flex-col gap-6 @3xl:col-span-2', {
                        children: [
                            el('h1', 'text-5xl font-medium tracking-tight text-base-content @2xl:text-7xl', {
                                text: 'About Iris',
                            }),
                            el('p', 'max-w-2xl text-xl leading-relaxed text-base-content @2xl:text-2xl', {
                                text: 'I’m a writer, mostly of essays and reported features, and I’ve spent fifteen years trying to describe ordinary working life clearly enough that it stops looking ordinary.',
                            }),
                            el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                                text: 'I started on the local desk of a coastal paper, covering council meetings and closing shops, and I never quite left that world behind — the reporting I care about most is still close to the ground, spent with people doing the work that keeps a place standing. The essays grew out of the reporting: the questions that were too slow, or too personal, for a news page.',
                            }),
                            el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                                text: 'These days I write to commission for a handful of magazines, review the occasional novel, and send The Long Field — a fortnightly newsletter about work, cities and the strange economics of attention — to a few thousand readers who put up with me. I write slowly, edit hard, and believe the second draft is where the writing actually happens.',
                            }),
                        ],
                    }),
                    el('div', 'flex flex-col gap-8', {
                        children: [
                            el('img', 'aspect-square w-full border border-base-300 object-cover', {
                                attrs: {
                                    src: assetUrl('manuscript-portrait'),
                                    alt: 'Portrait of Iris Bellamy, writer, at a window in even daylight',
                                    loading: 'lazy',
                                },
                            }),
                            el('div', 'flex flex-col gap-2', {
                                children: [
                                    el('h2', 'text-lg font-medium tracking-tight text-base-content', {
                                        text: 'Selected bylines',
                                    }),
                                    el('div', 'flex flex-col', {
                                        children: [
                                            bylineRow('Meridian Quarterly', 'essays'),
                                            bylineRow('The Coastal Review', 'reporting'),
                                            bylineRow('Ledger & Ink', 'criticism'),
                                            bylineRow('Field & Harbor', 'features'),
                                            bylineRow('The Long Field', 'newsletter, hers'),
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
        heading: 'Get in touch',
        intro: [
            'I’m open to commissions and I read every pitch. Essays, reported features, criticism — if there’s a story you think I’m the right person to tell, write and tell me why.',
            'A useful note tells me the idea, roughly how long it wants to be, and when you’d need it. A half-formed idea is a perfectly good place to begin — most of mine start that way.',
            'Or subscribe to The Long Field — a fortnightly letter on work and attention, and the quietest way to keep up with what I’m writing.',
        ],
        submitLabel: 'Email Iris',
        secondary: { label: 'Read the writing first', href: '/work' },
    }),
];

// ── The author (the byline persona) ─────────────────────────────────────────────────

const AUTHORS = [
    {
        slug: 'iris-bellamy',
        displayName: 'Iris Bellamy',
        bio: 'Iris Bellamy is a writer on the coast — essays and reported features on work, cities and attention, in Meridian Quarterly, The Coastal Review and Ledger & Ink. She writes The Long Field, a fortnightly newsletter. Slow drafts, hard edits.',
        avatarAssetId: 'manuscript-portrait',
    },
];

// ── Content (the pieces, as blog_post records) ──────────────────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({
    type: 'heading',
    attrs: { level: 2 },
    content: [{ type: 'text', text }],
});

const CONTENT = [
    {
        typeKey: 'blog_post',
        slug: 'the-long-way-to-the-desk',
        status: 'published',
        authorSlug: 'iris-bellamy',
        categories: ['Essay'],
        tags: ['Work', 'Writing life'],
        body: {
            title: 'The Long Way to the Desk',
            excerpt:
                'On the small, stubborn rituals we build around work — and what they quietly protect us from.',
            featuredImage: { $asset: 'manuscript-desk' },
            body: {
                type: 'doc',
                content: [
                    para('For a long time I believed the trouble with my working day was a problem of scheduling, the kind a better calendar might fix. I moved the hard hours earlier, then later. I tried the cold clarity of six in the morning and the warm fatigue of four in the afternoon. None of it took, and it took me longer than I care to admit to understand why: the difficulty was never when I sat down, but what I had to be willing to feel once I got there.'),
                    h2('The ritual before the work'),
                    para('Every writer I know keeps a private liturgy — the walk, the second coffee, the tidying of a desk that was already tidy. We are gently mocked for it, and we deserve to be, a little. But I have stopped believing the rituals are procrastination in a better coat. They are the slow work of lowering the volume of everything that is not the sentence, until the sentence is the loudest thing in the room. The walk is not avoidance; it is tuning.'),
                    para('What the ritual protects, I think, is the willingness to be bad for a while. You cannot get to a true paragraph without passing through several false ones, and the false ones are humiliating in a way that the empty page is not. An empty page is only potential. A bad paragraph is evidence. The ritual is how you make it safe to produce evidence.'),
                    h2('What the day is for'),
                    para('I have come to measure a working day not by how much I produced but by whether I told myself the truth in it. Some days the truth is that the piece is not working and the honest move is to cut the half I was proudest of. Those days feel like losses and are not. The word count went down and the writing went up, and no calendar in the world has a column for that.'),
                    para('So I keep the rituals, and I have stopped apologising for them. The long way to the desk turns out to be the only way I know that reliably arrives. What looks like delay from the outside is, from the inside, the sound of a room going quiet enough to work in.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'what-the-night-shift-knows',
        status: 'published',
        authorSlug: 'iris-bellamy',
        categories: ['Reporting'],
        tags: ['Cities', 'Labour'],
        body: {
            title: 'What the Night Shift Knows',
            excerpt:
                'Three months among the people who keep a city running while it sleeps, and the hours the daytime never sees.',
            featuredImage: { $asset: 'manuscript-city' },
            body: {
                type: 'doc',
                content: [
                    para('The city I thought I knew ends around eleven at night. After that a different one takes over, run by people the daytime rarely meets: the bakers proving tomorrow’s bread, the nurses on the long ward, the drivers moving the goods that will be on shelves before the first commuter is awake. For three months I kept their hours, and the thing that stayed with me was not how hard the work is — though it is — but how invisible it is designed to be.'),
                    h2('The economy of the small hours'),
                    para('A night shift is arranged so that you never see it working. The bins are emptied, the floors are cleaned, the systems are patched, all in the window between the last person leaving and the first arriving, so that the morning looks like it simply happened. The people I followed spoke about this with a kind of dry pride. Their job, as one cleaner put it to me at three in the morning, is to make it look like nobody has a job.'),
                    para('That invisibility has a price, and the people who pay it are the ones least able to. Night work pays a premium that rarely covers what it costs the body, and the shift patterns fall hardest on those with the fewest other options — new arrivals, students, parents fitting work around a second job or a child. The premium is real. So is the sleep debt, the missed dinners, the slow erosion of the ordinary daytime life the rest of us take as the baseline.'),
                    h2('What the daytime owes'),
                    para('I went looking for hardship and found competence. The night shift is not a lesser version of the day; it is a distinct expertise, a way of reading a quiet building or an empty road that the daytime never has to learn. The people who work it know things about the city — where it leaks, where it strains, who it forgets — that no daytime survey will ever surface, because the daytime is not awake to ask.'),
                    para('We could pay for that knowledge, and mostly we do not. The least the daytime owes the night is to stop pretending the morning arrives on its own. It arrives because someone stayed up to make it. This piece is a small attempt to keep them awake in the record, at least, a little longer than the shift itself.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'notes-on-attention-14',
        status: 'published',
        authorSlug: 'iris-bellamy',
        categories: ['Newsletter'],
        tags: ['Attention', 'The Long Field'],
        body: {
            title: 'Notes on Attention, No. 14',
            excerpt:
                'A fortnightly letter — this issue, on the difference between being interrupted and being distracted.',
            featuredImage: { $asset: 'manuscript-window' },
            body: {
                type: 'doc',
                content: [
                    para('Welcome back to The Long Field. It rained here all week, which is the best weather for a newsletter about attention, because rain is the rare interruption that does not ask anything of you. You can watch it or not; it will carry on. I have been thinking about that — the difference between an interruption and a distraction — because I suspect we have been blaming the wrong one.'),
                    h2('Interruption is external; distraction is a deal'),
                    para('An interruption comes from outside: the doorbell, the child, the colleague at your desk. It is rude, and it is honest — it declares itself and then it is over. A distraction is quieter and less innocent, because a distraction is something you agree to. The phone does not reach into your pocket. You reach for it, in the small gap where the work got hard, and you make a tiny private deal: a moment of relief now, in exchange for the thread you were holding.'),
                    para('Naming it as a deal changed how I felt about it, because a deal can be renegotiated and a victimhood cannot. I am not being stolen from. I am selling something cheaply, over and over, and the buyer is very good at making the price look like nothing.'),
                    h2('A small practice'),
                    para('So here is the practice I have been keeping, offered in the spirit of one reader to another rather than as advice. When I notice the reach — and the whole thing is learning to notice the reach — I try to name what I am fleeing before I flee it. Usually it is a sentence I do not know how to finish. Naming it does not make the sentence easier. But it moves the difficulty back into view, where it can be worked on, instead of letting it dissolve into a feed.'),
                    para('That is all for this issue. As ever, hit reply and tell me what you are paying attention to, or failing to — I read every one, and the best of them end up shaping where this letter goes next. Back in a fortnight. — Iris'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'the-novel-that-refuses-to-end',
        status: 'published',
        authorSlug: 'iris-bellamy',
        categories: ['Criticism'],
        tags: ['Books', 'Reading'],
        body: {
            title: 'The Novel That Refuses to End',
            excerpt:
                'On long books, slow reading, and why the best endings are the ones that decline to resolve.',
            featuredImage: { $asset: 'manuscript-shelf' },
            body: {
                type: 'doc',
                content: [
                    para('There is a particular pleasure, almost illicit now, in a novel that will not be hurried. I mean the long book — the eight-hundred-page kind that asks for a season of your life and gives no sign, for the first two hundred pages, that it intends to reward the loan. We are trained to distrust these books. They are inefficient. They do not respect our time. And that, I have come to think, is precisely the point of them.'),
                    h2('Length as an argument'),
                    para('A long novel is not a short novel that lost discipline. Its length is an argument about how meaning accumulates: slowly, by repetition and return, the way a person actually comes to understand a marriage or a city or themselves. A book that arrives at its insight in two hundred crisp pages is telling you that understanding is a matter of the right information. The long book insists it is a matter of time, and time cannot be summarised. You have to serve it.'),
                    para('This is why the great long novels are so often about ordinary duration — a year on an estate, a family across three generations, a single day stretched to the width of a life. The form and the subject agree. Nothing important, they say, happens quickly, and the book will not insult the slowness of real change by pretending otherwise.'),
                    h2('The ending that declines to resolve'),
                    para('And so the endings. The books I love most tend to close without closing — a last image rather than a last answer, a door left ajar. Readers sometimes feel cheated by this, and I understand the feeling, but I think it is the opposite of a cheat. A resolution is a small lie a novel can tell to send you home comfortable. The refusal to resolve is the book keeping faith with its own argument: that the thing it has been describing is still going on, out past the final page, in the same unfinished way your own life is.'),
                    para('Read slowly enough and you stop waiting for the ending at all. The book becomes a place you live for a while rather than a problem you are solving, and when it lets you go, unresolved, it leaves you where all the best reading leaves you — back in your own unfinished life, slightly better at bearing that it does not resolve either.'),
                ],
            },
        },
    },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: PortfolioSiteSpec = {
    slug: 'portfolio-writer',
    key: 'sparx-portfolio-writer',
    name: 'Writer Portfolio',
    summary:
        'A read-me portfolio for a working writer: a type-only editorial masthead, selected writing as a hairline-ruled index (not cards), reading pages that give an essay room, and a plain about + contact. The words are the work — warm-paper page, serif across, one oxblood on rubrics and links. Shipped as Iris Bellamy.',
    tagline: 'An editorial, type-led portfolio for an essayist & reporter.',
    industry: 'Writer & essayist',
    requiresModules: ['builder', 'cms', 'email'],
    sortWeight: 86,
    brand: {
        businessName: 'Iris Bellamy',
        tagline: 'Essays and reporting on work, cities, and attention.',
    },
    // A centred-links header (the brand over the nav, editorial masthead style) with NO CTA — a
    // writer's page invites by its links, not a button — over the columns footer whose bottom bar
    // carries the live © name and the tenant's published legal links.
    chrome: { navbar: 'centerLinks', footer: 'columns', showCta: false },
    seo: {
        home: {
            title: 'Iris Bellamy — writer',
            description:
                'Iris Bellamy is a writer on the coast — essays and reporting on work, cities and attention. Selected writing, a fortnightly newsletter, and how to commission her.',
        },
        about: {
            title: 'About Iris Bellamy — essayist & reporter',
            description:
                'Fifteen years of essays and reported features on ordinary working life — from a coastal news desk to the magazines, plus The Long Field newsletter.',
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
