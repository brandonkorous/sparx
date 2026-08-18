// sparx-retail-wine-modern — a RETAIL/COMMERCE site template: a bright, modern wine-club &
// bottle shop.
//
// The fun, light, approachable counterpart to the dark low-lit cellar (gen-retail-wine-shop's
// Sediment). A complete, working shop the moment it installs — a real catalogue of approachable
// bottles (a house red, a bold dinner red, a crisp white, a rosé, a pét-nat, a non-alc fizz, a
// flexible wine club, a dinner-party mixed six and a housewarming gift set), categories +
// collections, a bespoke bottle-shop PDP, and the full 9-page commerce site (merchandised home →
// shop → collections → cart → search → journal → about → contact), dressed in an INLINE bespoke
// theme (a bright pale-blush cream ground, a punchy berry primary, a coral accent and a modern
// display face). Shipped as Coupe.
//
// SELF-CONTAINED BY DESIGN. Like every retail-family generator it carries its OWN theme inline
// and passes it on the spec (`theme`), so the whole family can be authored in parallel without
// two generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-wine-modern.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-wine-modern/**" \
//     "marketplace-catalog/_gen/gen-retail-wine-modern.ts"
//
// SEMANTIC TOKENS ONLY, NAMED UTILITIES ONLY (arbitrary/off-step classes emit nothing once
// stamped — the sweep flags them). Container steps @sm/@md/@2xl/@3xl/@5xl only.
//
// WHY RELATIVE IMPORTS — see the harness header (marketplace-catalog has no node_modules).

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
    el,
    type Node,
} from '../../wizeworks/packages/silica-catalog/node_modules/@wizeworks/silicaui-html/dist/index.js';
import { productsBlock } from '../../wizeworks/packages/silica-catalog/src/commerce';
import { defineTheme, face, STATUS_ON_DARK, STATUS_ON_LIGHT } from '../../wizeworks/packages/silica-catalog/src/themes';
import { safeParseBlueprint } from '../../wizeworks/packages/blueprints/src/validate';

import { contactSection } from './shared/contact-section';
import { emitBundle, type TemplateSiteSpec } from './template-sites/harness';
import { writeTemplatePreview } from './template-sites/preview';
import {
    addToCartForm,
    pdpDescription,
    pdpImage,
    pdpPolicyLinks,
    pdpPriceRow,
    pdpStockBadge,
    pdpTitle,
    productPage,
} from './template-sites/pdp';

// ── The bespoke theme (inline) ─────────────────────────────────────────────────────
// A bright, fun bottle shop: a pale-blush cream page, a deep berry-plum ink, a punchy
// raspberry primary lit by a coral accent and a deep-plum support. Modern display face
// (Syne) over a clean geometric sans (Outfit). This is the LIGHT, approachable opposite of
// the cellar theme — where that one is a low-lit room, this one is a sunny table.
//
// Every role used as TEXT on the light ground stays ≤ ~50% L so it reads: `secondary` (the
// PDP brand label + struck compare price) and `accent` (the editorial links) are both dark.
// The punch rides the button FILLS (a bright primary carrying auto content) and the bright
// blush ground, not the text. Complete light + dark, AA on every role (the sweep's contrast
// check is the gate).
const THEME = defineTheme({
    name: 'coupe-bright',
    type: { body: face('Outfit', 'sans-serif'), head: face('Syne', 'sans-serif') },
    shape: { selector: '1rem', field: '0.5rem', box: '1.25rem', depth: '0' },
    light: {
        surfaces: ['oklch(98% 0.014 14)', 'oklch(96% 0.026 12)', 'oklch(91% 0.038 8)', 'oklch(26% 0.05 12)'],
        roles: {
            primary: 'oklch(56% 0.2 8)',
            secondary: 'oklch(42% 0.09 350)',
            accent: 'oklch(50% 0.18 32)',
            neutral: 'oklch(30% 0.04 12)',
            ...STATUS_ON_LIGHT,
        },
    },
    dark: {
        surfaces: ['oklch(18% 0.03 350)', 'oklch(15% 0.03 350)', 'oklch(12% 0.028 350)', 'oklch(95% 0.016 20)'],
        roles: {
            primary: 'oklch(72% 0.19 8)',
            secondary: 'oklch(82% 0.06 350)',
            accent: 'oklch(74% 0.16 32)',
            neutral: 'oklch(32% 0.03 350)',
            ...STATUS_ON_DARK,
        },
    },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
    "coupe-hero": "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZnJpZW5kcyUyMHJhaXNpbmclMjBnbGFzc2VzJTIwd2luZSUyMGFyb3VuZCUyMGJyaWdodCUyMHN1bmxpdHxlbnwwfDB8fHwxNzg2NDA3NzEzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "coupe-tile-red": "https://images.unsplash.com/photo-1638186095578-7e58f9f16d0d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z2xhc3MlMjBicmlnaHQlMjByZWQlMjB3aW5lJTIwY2F0Y2hpbmclMjBsaWdodHxlbnwwfDB8fHwxNzg2NDA3NzE1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "coupe-tile-white": "https://images.unsplash.com/photo-1716251212768-609b9140f3ec?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2hpbGxlZCUyMGJvdHRsZSUyMHdoaXRlJTIwZ2xhc3MlMjByb3MlMjB0YWJsZXxlbnwwfDB8fHwxNzg2NDA3NzE5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "coupe-tile-bubbles": "https://images.unsplash.com/photo-1691404016321-b210547c6d7a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3BhcmtsaW5nJTIwd2luZSUyMGJlaW5nJTIwcG91cmVkJTIwaW50byUyMGNvdXBlJTIwZ2xhc3N8ZW58MHwwfHx8MTc4NjQwNzcyMnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "coupe-tile-cases": "https://images.unsplash.com/photo-1562601579-599dec564e06?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8b3BlbiUyMGNhc2UlMjBtaXhlZCUyMHdpbmUlMjBib3R0bGVzJTIwcmVhZHklMjBnb3xlbnwwfDB8fHwxNzg2NDA3NzI1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "coupe-band-club": "https://images.unsplash.com/photo-1607880368278-9da0ac7171df?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2luZS1jbHViJTIwYm94JTIwbGVmdCUyMGJyaWdodCUyMGRvb3JzdGVwJTIwc3VufGVufDB8MHx8fDE3ODY0MDc3Mjh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-house-red": "https://images.unsplash.com/photo-1622461428981-a79d6a12c404?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym90dGxlJTIwd2Vla25pZ2h0JTIwaG91c2UlMjByZWR8ZW58MHwwfHx8MTc4NjQwNzczMXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-crisp-white": "https://images.unsplash.com/photo-1664714628878-9d2aa898b9e3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29sZCUyMGJvdHRsZSUyMHBvb2xzaWRlJTIwY3Jpc3AlMjB3aGl0ZXxlbnwwfDB8fHwxNzg2NDA3NzM4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-rose": "https://images.unsplash.com/photo-1635184039134-8746f858a1b5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym90dGxlJTIwcGFsZSUyMHN1bmRheSUyMHJvc3xlbnwwfDB8fHwxNzg2NDA3NzQxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-petnat": "https://images.unsplash.com/photo-1557044353-8c6b417c8163?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y3Jvd24tY2FwcGVkJTIwYm90dGxlJTIwY29uZmV0dGklMjBwJTIwdC1uYXR8ZW58MHwwfHx8MTc4NjQwNzc0NHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-nonalc": "https://images.unsplash.com/photo-1660734604912-1f85f33afadf?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym90dGxlJTIwb2ZmLWR1dHklMjBub24tYWxjb2hvbGljJTIwZml6eiUyMGljZXxlbnwwfDB8fHwxNzg2NDA3NzQ4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-club": "https://images.unsplash.com/photo-1700165644892-3dd6b67b25bc?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bW9udGhseSUyMHdpbmUtY2x1YiUyMGJveCUyMHBhY2tlZCUyMGJvdHRsZXN8ZW58MHwwfHx8MTc4NjQwNzc1Mnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-six": "https://images.unsplash.com/photo-1515169067868-5387ec356754?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZGlubmVyJTIwcGFydHklMjBtaXhlZCUyMHNpeCUyMHN0YW5kaW5nJTIwdG9nZXRoZXIlMjBjYXNlfGVufDB8MHx8fDE3ODY0MDc3NTV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-gift": "https://images.unsplash.com/photo-1668127039852-0e7c8b3a1601?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d3JhcHBlZCUyMGhvdXNld2FybWluZyUyMHdpbmUlMjBnaWZ0JTIwc2V0JTIwcmliYm9ufGVufDB8MHx8fDE3ODY0MDc3NTd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "post-choose": "https://images.unsplash.com/photo-1693761862018-4f723360ede3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2hlbGYlMjBib3R0bGVzJTIwc29tZW9uZSUyMHJlYWNoaW5nJTIwb25lfGVufDB8MHx8fDE3ODY0MDc3NjB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "post-pairings": "https://images.unsplash.com/photo-1519671282429-b44660ead0a7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZGlubmVyJTIwdGFibGUlMjBzZXQlMjB3aW5lJTIwcGxhdGVzJTIwZnJpZW5kc3xlbnwwfDB8fHwxNzg2NDA3NzY0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "post-natural": "https://images.unsplash.com/photo-1759239853638-758fab8444c1?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8c3VuJTIwdGhyb3VnaCUyMGdyYXBlJTIwdmluZXMlMjBzbWFsbCUyMHZpbmV5YXJkfGVufDB8MHx8fDE3ODY0MDc3Njd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
    id: string;
    url: string;
    alt: string;
}

const ASSETS: Asset[] = [
    { id: 'coupe-hero', url: src('coupe-hero'), alt: 'Friends raising glasses of wine around a bright, sunlit table' },
    { id: 'coupe-tile-red', url: src('coupe-tile-red'), alt: 'A glass of bright red wine catching the light' },
    { id: 'coupe-tile-white', url: src('coupe-tile-white'), alt: 'A chilled bottle of white and a glass of rosé on a table' },
    { id: 'coupe-tile-bubbles', url: src('coupe-tile-bubbles'), alt: 'Sparkling wine being poured into a coupe glass' },
    { id: 'coupe-tile-cases', url: src('coupe-tile-cases'), alt: 'An open case of mixed wine bottles ready to go' },
    { id: 'coupe-band-club', url: src('coupe-band-club'), alt: 'A wine-club box left on a bright doorstep in the sun' },
    { id: 'prod-house-red', url: src('prod-house-red'), alt: 'A bottle of the Weeknight House Red' },
    { id: 'prod-bold-red', url: src('prod-bold-red'), alt: 'A bottle of the Big Swing Bold Red' },
    { id: 'prod-crisp-white', url: src('prod-crisp-white'), alt: 'A cold bottle of the Poolside Crisp White' },
    { id: 'prod-rose', url: src('prod-rose'), alt: 'A bottle of pale Sunday Rosé' },
    { id: 'prod-petnat', url: src('prod-petnat'), alt: 'A crown-capped bottle of Confetti Pét-Nat' },
    { id: 'prod-nonalc', url: src('prod-nonalc'), alt: 'A bottle of the Off-Duty non-alcoholic fizz on ice' },
    { id: 'prod-club', url: src('prod-club'), alt: 'A monthly wine-club box packed with bottles' },
    { id: 'prod-six', url: src('prod-six'), alt: 'A Dinner Party mixed six standing together in a case' },
    { id: 'prod-gift', url: src('prod-gift'), alt: 'A wrapped housewarming wine gift set with a ribbon' },
    { id: 'post-choose', url: src('post-choose'), alt: 'A shelf of bottles with someone reaching for one' },
    { id: 'post-pairings', url: src('post-pairings'), alt: 'A dinner table set with wine, plates and friends' },
    { id: 'post-natural', url: src('post-natural'), alt: 'Sun through grape vines at a small vineyard' },
];

const assetUrl = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-retail-wine-modern: unknown asset "${id}"`);
    return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one bright photograph, a modern headline and a lead in a solid
 *  readable panel anchored bottom-left, a filled shop CTA + a text link. Never ink on the
 *  photo. */
function hero(): Node {
    return el('section', 'relative @container overflow-hidden bg-base-200', {
        children: [
            el('img', 'absolute inset-0 h-full w-full object-cover', {
                attrs: { src: assetUrl('coupe-hero'), alt: 'Friends raising glasses of wine around a bright table', loading: 'lazy' },
            }),
            el(
                'div',
                'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
                {
                    children: [
                        el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
                            children: [
                                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                                    text: 'Good wine, zero snobbery.',
                                }),
                                el('p', 'text-lg leading-relaxed text-base-content', {
                                    text: 'Coupe is a wine shop for people who just want a great bottle without the lecture. We taste everything, keep the winners, and tell you what to pour and when — in plain words. Chilled, ready and at your door.',
                                }),
                                el('div', 'flex flex-wrap items-center gap-4', {
                                    children: [
                                        el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop bottles' }),
                                        el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                                            attrs: { href: '/shop/wine-club' },
                                            text: 'Join the wine club',
                                        }),
                                    ],
                                }),
                            ],
                        }),
                    ],
                }
            ),
        ],
    });
}

/** One category tile — a photo with a label beneath, the whole tile a link. */
function categoryTile(o: { assetId: string; label: string; href: string; alt: string }): Node {
    return el('a', 'group flex flex-col gap-3', {
        attrs: { href: o.href },
        children: [
            el('img', 'aspect-square w-full rounded-box bg-base-200 object-cover transition group-hover:opacity-90', {
                attrs: { src: assetUrl(o.assetId), alt: o.alt, loading: 'lazy' },
            }),
            el('span', 'text-center text-base font-semibold text-base-content', { text: o.label }),
        ],
    });
}

function categoryTiles(): Node {
    return el('section', 'bg-base-100 @container px-6 py-16', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-8', {
                children: [
                    el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
                        text: 'Pick your vibe',
                    }),
                    el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
                        children: [
                            categoryTile({ assetId: 'coupe-tile-red', label: 'Reds', href: '/shop', alt: 'A glass of bright red wine' }),
                            categoryTile({ assetId: 'coupe-tile-white', label: 'Whites & Rosé', href: '/shop', alt: 'A chilled white and a glass of rosé' }),
                            categoryTile({ assetId: 'coupe-tile-bubbles', label: 'Bubbles', href: '/shop', alt: 'Sparkling wine poured into a coupe' }),
                            categoryTile({ assetId: 'coupe-tile-cases', label: 'Mixed cases', href: '/shop', alt: 'An open case of mixed wine bottles' }),
                        ],
                    }),
                ],
            }),
        ],
    });
}

/** The wine-club color band — a solid, punchy berry strip (the one place a full brand fill
 *  earns its keep on this bright site), heading + lead in primary-content ink, a solid CTA.
 *  This is the merchandising centrepiece the DNA leans on: a subscription, sold with joy. */
function clubBand(): Node {
    return el('section', 'bg-primary @container px-6 py-20 @3xl:py-24', {
        children: [
            el('div', 'mx-auto flex w-full max-w-4xl flex-col items-center gap-6 text-center', {
                children: [
                    el('h2', 'text-4xl font-bold leading-none tracking-tight text-primary-content @3xl:text-5xl', {
                        text: 'The wine club that does the choosing',
                    }),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-primary-content', {
                        text: 'Three or six bottles, hand-picked by us, at your door every month. We match the picks to the season and your taste, tuck in tasting notes and a pairing or two, and you can skip, swap or cancel any time. It is the easy way to always have something good open.',
                    }),
                    el('a', 'btn btn-neutral btn-lg', { attrs: { href: '/shop/wine-club' }, text: 'Start the club' }),
                ],
            }),
        ],
    });
}

/** A full-bleed editorial band — a photo carrying a heading, a lead and a link, panel
 *  bottom-left. */
function editorialBand(o: { heading: string; lead: string; assetId: string; cta: string; href: string; alt: string }): Node {
    return el('section', 'relative @container overflow-hidden bg-base-200', {
        children: [
            el('img', 'absolute inset-0 h-full w-full object-cover', {
                attrs: { src: assetUrl(o.assetId), alt: o.alt, loading: 'lazy' },
            }),
            el(
                'div',
                'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
                {
                    children: [
                        el('div', 'flex max-w-xl flex-col gap-4 rounded-box bg-base-100 p-8 @3xl:p-10', {
                            children: [
                                el('h2', 'text-4xl font-bold leading-none tracking-tight text-base-content @3xl:text-5xl', {
                                    text: o.heading,
                                }),
                                el('p', 'text-lg leading-relaxed text-base-content', { text: o.lead }),
                                el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                                    attrs: { href: o.href },
                                    text: o.cta,
                                }),
                            ],
                        }),
                    ],
                }
            ),
        ],
    });
}

/** A three-up promises strip — the plain-words reassurance that carries the "no snobbery"
 *  voice. Cards on the soft blush surface; headings scale, no eyebrows. */
function promisesStrip(): Node {
    const promise = (heading: string, body: string): Node =>
        el('div', 'flex flex-col gap-2 rounded-box bg-base-100 p-6', {
            children: [
                el('h3', 'text-xl font-bold tracking-tight text-base-content', { text: heading }),
                el('p', 'text-base leading-relaxed text-base-content', { text: body }),
            ],
        });
    return el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-20', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-8', {
                children: [
                    el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
                        text: 'Buying wine, made easy',
                    }),
                    el('div', 'grid grid-cols-1 gap-4 @3xl:grid-cols-3 @3xl:gap-6', {
                        children: [
                            promise('No wrong answers', 'Tell us the food, the budget or the mood and we will point you at the right bottle. There is no test here and no bad choice — just good wine you will actually enjoy.'),
                            promise('Chilled and ready', 'Everything ships packed to travel safely, and we will tell you exactly how cold to serve it. Open, pour, done — no decanting rituals required.'),
                            promise('At your door', 'Order online for local delivery or pickup, or let the wine club do the remembering for you. Free delivery over $75, every time.'),
                        ],
                    }),
                ],
            }),
        ],
    });
}

const HOME: Node[] = [
    hero(),
    categoryTiles(),
    productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'New this month' }),
    clubBand(),
    productsBlock({ source: 'commerce.category.bubbles', layout: 'carousel', heading: 'Bring the bubbles' }),
    editorialBand({
        heading: 'By the case, done right',
        lead: 'Buying by the case should be the fun kind of commitment. Our mixed six is a ready-made dinner-party line-up at a better price than one at a time, and the gift set is the present that never misses. We refresh the picks every month.',
        assetId: 'coupe-tile-cases',
        cta: 'See the mixed cases',
        href: '/products/dinner-party-six',
        alt: 'An open case of mixed wine bottles ready to go',
    }),
    promisesStrip(),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the bottle image. Right: the buy column (shop label, title, price, low-stock,
 *  description, add-to-cart, a bright "how to serve it" note, and policy links). */
function pdpBuyRegion(): Node {
    return el('section', 'bg-base-100 @container px-6 py-12 @3xl:py-20', {
        children: [
            el('div', 'mx-auto grid w-full max-w-6xl gap-10 @3xl:grid-cols-2 @3xl:gap-16', {
                children: [
                    pdpImage('aspect-square w-full rounded-box bg-base-200 object-cover'),
                    el('div', 'flex flex-col gap-6 @3xl:py-4', {
                        children: [
                            el('div', 'flex flex-col gap-4', {
                                children: [
                                    el('p', 'text-sm font-semibold uppercase tracking-widest text-secondary', {
                                        text: 'Coupe · Wine Shop',
                                    }),
                                    pdpTitle('h1', 'text-4xl font-bold leading-none tracking-tight text-base-content @3xl:text-5xl'),
                                    pdpPriceRow({
                                        priceClass: 'text-2xl font-semibold text-base-content',
                                        compareClass: 'text-lg text-secondary line-through',
                                        rowClass: 'flex items-baseline gap-4',
                                    }),
                                    pdpStockBadge({
                                        className:
                                            'inline-flex w-fit items-center gap-2 rounded-field border border-base-300 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-base-content',
                                        label: 'Almost gone',
                                    }),
                                ],
                            }),
                            pdpDescription('text-lg leading-relaxed text-base-content'),
                            addToCartForm(),
                            el('div', 'flex flex-col gap-2 rounded-box bg-base-200 p-5', {
                                children: [
                                    el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'How to serve it' }),
                                    el('p', 'text-base leading-relaxed text-base-content', {
                                        text: 'Ships chilled-friendly and ready to open — no decanting, no fuss. Reds are happiest with a light chill, whites and bubbles want a proper cold, and everything on this shelf is made to pour the day it arrives.',
                                    }),
                                ],
                            }),
                            pdpPolicyLinks({
                                className:
                                    'flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-base-300 pt-5 text-sm font-semibold uppercase tracking-widest text-base-content',
                                linkClass: 'underline underline-offset-4',
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });
}

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Goes well with' });

// ── Shop / Collections / Cart / Search / Journal framing ─────────────────────────────

function pageMasthead(heading: string, lead: string): Node {
    return el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
                children: [
                    el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                        text: heading,
                    }),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', { text: lead }),
                ],
            }),
        ],
    });
}

const SHOP: Node[] = [
    pageMasthead(
        'Shop the shelf',
        'Every bottle we are pouring right now — reds, whites, rosé, bubbles, a monthly wine club and a couple of ready-made cases. Filter by color or sort however you like; all of it is tasted, approved and ready to drink.'
    ),
];
const COLLECTIONS: Node[] = [
    pageMasthead(
        'Collections',
        'The bottles grouped the way people actually shop — what just landed, the crowd-pleasers, the ones to chill and pour, the party starters and the value picks under twenty.'
    ),
];
const SEARCH: Node[] = [
    pageMasthead('Search Coupe', 'After a grape, a color, a price or a bottle for a specific dinner? Search the whole shop and the journal below.'),
];
const CART: Node[] = [
    el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
                children: [
                    el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your cart' }),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Free local delivery over $75, and every order is packed to travel safely. Not sure a bottle is right? Tell us what you like and we will help you swap it — buying wine should be fun, never a gamble.',
                    }),
                ],
            }),
        ],
    }),
];
const JOURNAL: Node[] = [
    el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-20', {
        children: [
            el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-4', {
                children: [
                    el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The Coupe journal' }),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Plain-words notes from the shop — how to pick a bottle when you know nothing, what to pour at dinner, and what natural wine actually is. No jargon, no eye-rolls, just useful.',
                    }),
                ],
            }),
        ],
    }),
];

// ── About + Contact ─────────────────────────────────────────────────────────────────

const ABOUT: Node[] = [
    el('section', 'bg-base-100 @container px-6 py-20', {
        children: [
            el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-6', {
                children: [
                    el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Coupe' }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'Coupe started with a simple frustration: buying wine felt like a test you could fail. Too many shops made you feel like you should already know the answer, when all you wanted was a good bottle for a Tuesday. So we built the opposite of that.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'We taste everything before it earns a spot on the shelf, and we only keep the bottles we would happily pour a friend. Then we describe them in plain words — what they taste like, how cold to serve them, and what to eat alongside — so you can pick with confidence, not a guessing game.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'Great wine at fair prices, a wine club that does the remembering, and a real person happy to help you find your next favourite. No gatekeeping, no jargon, no bottle you need a diagram to enjoy.',
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
        heading: 'Say hi',
        intro: 'After a bottle for a dinner, a case for a party, or a hand picking a gift? Tell us what you are after and a real person from the shop will get right back to you — recommendations always welcome.',
        submitLabel: 'Email the shop',
    }),
];

// ── Commerce (the catalogue) ─────────────────────────────────────────────────────────

const money = (dollars: number): number => Math.round(dollars * 100);

interface Variant {
    sku: string;
    priceCents: number;
    isDefault?: boolean;
    inventoryPolicy: 'continue';
    optionValues?: Record<string, string>;
}
interface OptionDecl {
    name: string;
    displayType: 'swatch' | 'dropdown';
    values: { value: string }[];
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
    options?: OptionDecl[];
    variants: Variant[];
    images: { assetId: string; isPrimary: true; alt: string }[];
}

/** A single-format bottle — one 750ml variant, no options. The natural default for the
 *  shelf; the club, the case and the gift set (which genuinely vary) declare their own. */
const bottle = (opts: {
    handle: string;
    title: string;
    description: string;
    price: number;
    sku: string;
    productType: string;
    categories: string[];
    collections: string[];
    tags: string[];
    asset: string;
    alt: string;
    seoTitle: string;
    seoDescription: string;
}): Product => ({
    handle: opts.handle,
    title: opts.title,
    description: opts.description,
    status: 'active',
    productType: opts.productType,
    vendor: 'Coupe',
    tags: opts.tags,
    categoryHandles: opts.categories,
    collectionHandles: opts.collections,
    seoTitle: opts.seoTitle,
    seoDescription: opts.seoDescription,
    variants: [{ sku: opts.sku, priceCents: money(opts.price), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: opts.asset, isPrimary: true, alt: opts.alt }],
});

const PRODUCTS: Product[] = [
    bottle({
        handle: 'weeknight-house-red',
        title: 'Weeknight House Red',
        description:
            'The bottle we reach for most and the one we recommend first. A soft, juicy 750ml red — ripe black cherry, plum and a little cocoa, low on tannin and easy to love. Great on its own, better with pizza, and honestly farmed at a price that makes it a habit.',
        price: 16,
        sku: 'COUPE-RED-HOUSE-01',
        productType: 'Red wine',
        categories: ['reds'],
        collections: ['crowd-pleasers', 'under-20'],
        tags: ['red', 'easy-drinking', 'everyday', 'value'],
        asset: 'prod-house-red',
        alt: 'A bottle of the Weeknight House Red',
        seoTitle: 'Weeknight House Red — easy everyday red wine | Coupe',
        seoDescription: 'A soft, juicy everyday red — black cherry, plum and cocoa, low tannin and easy to love. 750ml.',
    }),
    bottle({
        handle: 'big-swing-bold-red',
        title: 'Big Swing Bold Red',
        description:
            'The red for when dinner deserves an occasion. A full-bodied 750ml with dark berry, black pepper and a savoury, structured finish that stands up to steak, mushrooms and long conversations. Give it ten minutes open and it really sings.',
        price: 23,
        sku: 'COUPE-RED-BOLD-01',
        productType: 'Red wine',
        categories: ['reds'],
        collections: ['new-this-month', 'crowd-pleasers'],
        tags: ['red', 'full-bodied', 'dinner'],
        asset: 'prod-bold-red',
        alt: 'A bottle of the Big Swing Bold Red',
        seoTitle: 'Big Swing Bold Red — full-bodied red wine | Coupe',
        seoDescription: 'A full-bodied dinner red — dark berry, black pepper and a savoury, structured finish. 750ml.',
    }),
    bottle({
        handle: 'poolside-crisp-white',
        title: 'Poolside Crisp White',
        description:
            'Sunshine in a 750ml bottle. Bright, dry and thirst-quenching, with green apple, citrus and a clean snap that begs for a proper chill. The white you open on the first warm day and keep opening all summer — and it loves a plate of anything from the sea.',
        price: 17,
        sku: 'COUPE-WHITE-01',
        productType: 'White wine',
        categories: ['whites-rose'],
        collections: ['new-this-month', 'chill-and-pour', 'under-20'],
        tags: ['white', 'crisp', 'dry', 'chillable'],
        asset: 'prod-crisp-white',
        alt: 'A cold bottle of the Poolside Crisp White',
        seoTitle: 'Poolside Crisp White — bright, dry white wine | Coupe',
        seoDescription: 'A bright, dry, thirst-quenching white — green apple, citrus and a clean snap. Serve it cold. 750ml.',
    }),
    bottle({
        handle: 'sunday-rose',
        title: 'Sunday Rosé',
        description:
            'A dry, pale 750ml rosé with none of the sweetness the color gets blamed for. Wild strawberry, pink grapefruit and a fresh, savoury finish — the house pour from the first warm afternoon to the last. Brunch approved, picnic essential.',
        price: 18,
        sku: 'COUPE-ROSE-01',
        productType: 'Rosé wine',
        categories: ['whites-rose'],
        collections: ['new-this-month', 'chill-and-pour', 'crowd-pleasers'],
        tags: ['rose', 'dry', 'chillable'],
        asset: 'prod-rose',
        alt: 'A bottle of pale Sunday Rosé',
        seoTitle: 'Sunday Rosé — dry pale rosé wine | Coupe',
        seoDescription: 'A dry, pale rosé — wild strawberry, pink grapefruit and a fresh, savoury finish. 750ml.',
    }),
    bottle({
        handle: 'confetti-petnat',
        title: 'Confetti Pét-Nat',
        description:
            'The fun one. A cloudy, crown-capped 750ml sparkler finished the old way — bone-dry, gently fizzy and impossible not to smile at. Green apple, lemon and a little bready funk. The bottle that turns a regular Tuesday into a small celebration.',
        price: 24,
        sku: 'COUPE-BUB-PETNAT-01',
        productType: 'Sparkling wine',
        categories: ['bubbles'],
        collections: ['new-this-month', 'chill-and-pour', 'party-starters'],
        tags: ['pet-nat', 'sparkling', 'dry', 'chillable', 'fun'],
        asset: 'prod-petnat',
        alt: 'A crown-capped bottle of Confetti Pét-Nat',
        seoTitle: 'Confetti Pét-Nat — dry sparkling wine | Coupe',
        seoDescription: 'A bone-dry, gently fizzy pét-nat — green apple, lemon and a little bready funk. 750ml.',
    }),
    bottle({
        handle: 'off-duty-non-alc-fizz',
        title: 'Off-Duty Non-Alc Fizz',
        description:
            'A grown-up alcohol-free 750ml sparkling for the nights you are not drinking but still want something in the good glass. Properly dry and gently fizzy, with white peach, elderflower and a citrus snap — none of the cloying sweetness most non-alc falls into.',
        price: 15,
        sku: 'COUPE-NONALC-01',
        productType: 'Non-alcoholic',
        categories: ['bubbles'],
        collections: ['new-this-month', 'party-starters', 'under-20'],
        tags: ['non-alc', 'sparkling', 'dry', 'alcohol-free'],
        asset: 'prod-nonalc',
        alt: 'A bottle of the Off-Duty non-alcoholic fizz on ice',
        seoTitle: 'Off-Duty Non-Alc Fizz — alcohol-free sparkling | Coupe',
        seoDescription: 'A grown-up alcohol-free sparkling — dry, gently fizzy, white peach and elderflower. 750ml.',
    }),
    {
        handle: 'wine-club',
        title: 'Coupe Wine Club',
        description:
            'Let us do the choosing. Every month we hand-pick a set of bottles to match the season and your taste, tuck in tasting notes and a pairing or two, and send them chilled-friendly to your door. Three bottles or six, and you can skip, swap or cancel any time — no lock-in, ever. The easiest way to always have something good open.',
        status: 'active',
        productType: 'Subscription',
        vendor: 'Coupe',
        tags: ['wine-club', 'subscription', 'gift'],
        categoryHandles: ['club'],
        collectionHandles: ['new-this-month', 'crowd-pleasers', 'gifting'],
        seoTitle: 'Coupe Wine Club — hand-picked wine, monthly | Coupe',
        seoDescription: 'A flexible monthly wine club — three or six hand-picked bottles with tasting notes. Skip, swap or cancel any time.',
        options: [{ name: 'Plan', displayType: 'dropdown', values: [{ value: 'Three bottles' }, { value: 'Six bottles' }] }],
        variants: [
            { sku: 'COUPE-CLUB-3', priceCents: money(45), isDefault: true, inventoryPolicy: 'continue', optionValues: { Plan: 'Three bottles' } },
            { sku: 'COUPE-CLUB-6', priceCents: money(80), inventoryPolicy: 'continue', optionValues: { Plan: 'Six bottles' } },
        ],
        images: [{ assetId: 'prod-club', isPrimary: true, alt: 'A monthly wine-club box packed with bottles' }],
    },
    {
        handle: 'dinner-party-six',
        title: 'Dinner Party Mixed Six',
        description:
            'A ready-made line-up for a table full of friends — six bottles, our pick, at a better price than buying them one by one. Choose a mix of colors to cover every course, all reds for a hearty night, or whites and bubbles for something lighter. We swap the picks every month.',
        status: 'active',
        productType: 'Mixed case',
        vendor: 'Coupe',
        tags: ['mixed-case', 'value', 'gift', 'party'],
        categoryHandles: ['cases'],
        collectionHandles: ['crowd-pleasers', 'party-starters', 'gifting'],
        seoTitle: 'Dinner Party Mixed Six — curated wine case | Coupe',
        seoDescription: 'A curated six-bottle case at a better price — mixed colors, all reds, or whites and bubbles.',
        options: [
            { name: 'Selection', displayType: 'dropdown', values: [{ value: 'Mixed colors' }, { value: 'All reds' }, { value: 'Whites & bubbles' }] },
        ],
        variants: [
            { sku: 'COUPE-SIX-MIX', priceCents: money(95), isDefault: true, inventoryPolicy: 'continue', optionValues: { Selection: 'Mixed colors' } },
            { sku: 'COUPE-SIX-RED', priceCents: money(95), inventoryPolicy: 'continue', optionValues: { Selection: 'All reds' } },
            { sku: 'COUPE-SIX-WHT', priceCents: money(95), inventoryPolicy: 'continue', optionValues: { Selection: 'Whites & bubbles' } },
        ],
        images: [{ assetId: 'prod-six', isPrimary: true, alt: 'A Dinner Party mixed six standing together in a case' }],
    },
    {
        handle: 'housewarming-gift-set',
        title: 'The Housewarming Gift Set',
        description:
            'The present that never misses. A bright bottle of bubbles and a crowd-pleasing red, wrapped and ready with a hand-written note and a card of tasting notes. Pick a message at checkout and we will send it straight to them — the easy win for a new home, a thank-you or a just-because.',
        status: 'active',
        productType: 'Gift set',
        vendor: 'Coupe',
        tags: ['gift', 'gift-set', 'bubbles', 'red'],
        categoryHandles: ['cases'],
        collectionHandles: ['gifting', 'party-starters'],
        seoTitle: 'The Housewarming Gift Set — wine gift | Coupe',
        seoDescription: 'A wrapped wine gift set — a bottle of bubbles and a crowd-pleasing red, with a hand-written note.',
        options: [{ name: 'Message', displayType: 'dropdown', values: [{ value: 'Congratulations' }, { value: 'Thank you' }, { value: 'Just because' }] }],
        variants: [
            { sku: 'COUPE-GIFT-CONGRATS', priceCents: money(52), isDefault: true, inventoryPolicy: 'continue', optionValues: { Message: 'Congratulations' } },
            { sku: 'COUPE-GIFT-THANKS', priceCents: money(52), inventoryPolicy: 'continue', optionValues: { Message: 'Thank you' } },
            { sku: 'COUPE-GIFT-BECAUSE', priceCents: money(52), inventoryPolicy: 'continue', optionValues: { Message: 'Just because' } },
        ],
        images: [{ assetId: 'prod-gift', isPrimary: true, alt: 'A wrapped housewarming wine gift set with a ribbon' }],
    },
];

const COMMERCE = {
    categories: [
        { handle: 'reds', name: 'Reds', description: 'Easy, juicy and full-bodied reds.', featured: true },
        { handle: 'whites-rose', name: 'Whites & Rosé', description: 'Crisp whites and dry, pale rosé.', featured: true },
        { handle: 'bubbles', name: 'Bubbles', description: 'Pét-nat, sparkling and non-alc fizz.', featured: true },
        { handle: 'cases', name: 'Mixed cases', description: 'Ready-made cases and gift sets.', featured: true },
        { handle: 'club', name: 'Wine club', description: 'Hand-picked bottles, every month.', featured: true },
    ],
    collections: [
        {
            handle: 'new-this-month',
            name: 'New this month',
            description: 'The latest bottles on the shelf.',
            type: 'manual',
            featured: true,
            productHandles: ['big-swing-bold-red', 'poolside-crisp-white', 'sunday-rose', 'confetti-petnat', 'off-duty-non-alc-fizz', 'wine-club'],
        },
        {
            handle: 'crowd-pleasers',
            name: 'Crowd pleasers',
            description: 'The bottles that never miss.',
            type: 'manual',
            featured: true,
            productHandles: ['weeknight-house-red', 'big-swing-bold-red', 'sunday-rose', 'wine-club', 'dinner-party-six'],
        },
        {
            handle: 'chill-and-pour',
            name: 'Chill & pour',
            description: 'Everything that loves a proper cold.',
            type: 'manual',
            featured: true,
            productHandles: ['poolside-crisp-white', 'sunday-rose', 'confetti-petnat'],
        },
        {
            handle: 'party-starters',
            name: 'Party starters',
            description: 'Bubbles and bottles for a full table.',
            type: 'manual',
            featured: false,
            productHandles: ['confetti-petnat', 'off-duty-non-alc-fizz', 'dinner-party-six', 'housewarming-gift-set'],
        },
        {
            handle: 'under-20',
            name: 'Under $20',
            description: 'Great bottles that go easy on the wallet.',
            type: 'manual',
            featured: false,
            productHandles: ['weeknight-house-red', 'poolside-crisp-white', 'sunday-rose', 'off-duty-non-alc-fizz'],
        },
        {
            handle: 'gifting',
            name: 'Worth gifting',
            description: 'Sets, cases and the club — for the generous.',
            type: 'manual',
            featured: false,
            productHandles: ['wine-club', 'dinner-party-six', 'housewarming-gift-set'],
        },
    ],
    products: PRODUCTS,
};

// ── Content (the journal) ────────────────────────────────────────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });

const CONTENT = [
    {
        typeKey: 'blog_post',
        slug: 'how-to-pick-a-bottle',
        status: 'published',
        body: {
            title: 'How to pick a bottle when you know nothing about wine',
            excerpt: 'You do not need to learn a hundred grapes or a wine map. Three easy questions get you to a bottle you will love — here they are.',
            featuredImage: { $asset: 'post-choose' },
            body: {
                type: 'doc',
                content: [
                    para('Standing in front of a wall of wine with no idea where to start is a universal feeling, and it is not your fault — most shops are set up to reward people who already know the answer. You do not need to. You need three quick questions, and you can answer all of them without a single wine word.'),
                    h2('What are you eating?'),
                    para('The single most useful thing to know is what will be on the plate, because good pairing is mostly matching weight to weight. A light dish wants a light wine; a hearty one wants something with more to it. Pizza and a juicy red, salad and a crisp white, anything spicy and a touch of bubbles — you already have instincts here, so trust them, and ask us if you are stuck.'),
                    h2('What did you like last time?'),
                    para('You do not need to remember a producer or a region — just a vibe. "Something light and fresh," "a big cosy red," "the fizzy one," "not too sweet." That is genuinely enough for us to point you at three bottles you will get on with. Wine is a memory game more than a knowledge one, and every bottle you try makes the next choice easier.'),
                    h2('What do you want to spend?'),
                    para('There is a great bottle at every price, and spending more does not automatically mean better — it usually means rarer. Tell us the budget without a shred of embarrassment; our job is to find the best thing in it. Under twenty buys you plenty of joy, and knowing your number makes the whole thing faster and more fun.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'what-to-pour-at-a-dinner-party',
        status: 'published',
        body: {
            title: 'What to pour at a dinner party',
            excerpt: 'Hosting and not sure what to open? A simple plan that covers any table, plus how much to actually buy so nobody runs dry.',
            featuredImage: { $asset: 'post-pairings' },
            body: {
                type: 'doc',
                content: [
                    para('The good news about pouring wine for a group is that you do not have to get it perfect — you have to get it generous and easygoing. Here is the plan we give friends when they are hosting and slightly panicking about the wine.'),
                    h2('Open with bubbles'),
                    para('Nothing gets a room going like a pop and a pour. A bright sparkling or a fun pét-nat the moment people arrive does two jobs at once: it feels celebratory, and it buys you time in the kitchen. It also flatters almost any nibble on the table — salty, fried and fizzy is a combination that never lets you down.'),
                    h2('One white, one red, and let people choose'),
                    para('You do not need a different wine for every course. A crisp white and a crowd-pleasing red on the table covers nearly everyone, and letting guests pour their own keeps the whole thing relaxed. If you want a single trick to look like you planned it, match the fuller wine to the main event — a bold red with the roast, a lighter white with the starters.'),
                    h2('How much to buy'),
                    para('The rule of thumb is roughly half a bottle per person, and a little more if it is a long, lingering night. A mixed six is usually the sweet spot for a dinner of four to six, with a bottle spare so nobody watches the last glass being poured. Buy the spare — leftover wine is not a problem, it is next Tuesday.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'natural-wine-explained',
        status: 'published',
        body: {
            title: 'Natural wine, explained without the eye-roll',
            excerpt: 'Cloudy, funky, fashionable — and a bit mystifying. Here is what natural wine actually is, in plain words, and how to know if you will like it.',
            featuredImage: { $asset: 'post-natural' },
            body: {
                type: 'doc',
                content: [
                    para('You have seen the cloudy bottles and the crown caps, and maybe heard someone get intense about it. Natural wine has picked up a reputation for being complicated and a little smug, which is a shame, because the idea behind it is genuinely simple and worth knowing.'),
                    h2('What it actually means'),
                    para('At its heart, natural wine is wine made with as little added to it as possible — grapes farmed organically, fermented with the wild yeast that arrives on their skins rather than a lab packet, and bottled with little or no added sulphur. No added color, no added acid, no filtering the life out of it. It is not a legal term, so it lives on a spectrum, but that is the direction of travel.'),
                    h2('Why it tastes a bit different'),
                    para('All that restraint means the wine tastes more of the specific place and year it came from, and sometimes a little wilder than you are used to. A natural white might be cloudy; a natural red might have a savoury, tangy edge; a pét-nat might throw a bit of sediment. None of that is a fault — it is the wine being alive, and it is the whole appeal once it clicks.'),
                    h2('How to know if it is for you'),
                    para('The only way to find out is to open one, ideally with a light chill and low expectations of ceremony. If you like fresh, zippy, slightly unusual drinks, you will probably love it; if you want something polished and predictable, we will happily point you elsewhere. There is no right answer here — just the bottle you enjoy, which is the only test that has ever mattered.'),
                ],
            },
        },
    },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
    slug: 'retail-wine-modern',
    key: 'sparx-retail-wine-modern',
    name: 'Modern Wine Shop',
    theme: THEME,
    summary:
        'A complete, working shop for a bright, modern wine club and bottle shop: a real catalogue of approachable bottles — a house red, a bold dinner red, a crisp white, a rosé, a pét-nat, a non-alc fizz, a flexible wine club, a mixed six and a gift set — with categories, collections, a bespoke bottle-shop PDP and a fully merchandised home page. Bright pale-blush theme — a punchy berry primary, a coral accent and a modern display face. Shipped as Coupe.',
    tagline: 'A bright, fun storefront for a modern wine club and bottle shop.',
    vertical: 'retail',
    industry: 'Wine shop',
    requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
    sortWeight: 85,
    brand: {
        businessName: 'Coupe',
        tagline: 'Good wine, zero snobbery.',
    },
    chrome: { navbar: 'centerLogo', footer: 'newsletter', showCta: true },
    seo: {
        home: {
            title: 'Coupe — good wine, zero snobbery',
            description:
                'Coupe is a bright, modern wine shop and monthly wine club — reds, whites, rosé, bubbles and ready-made cases, all tasted, approved and delivered chilled to your door. No jargon, no gatekeeping.',
        },
        about: {
            title: 'About Coupe — a wine shop without the lecture',
            description:
                'How Coupe picks and describes its wine — everything tasted, only the winners kept, plain-words notes, and a wine club that does the remembering. Good wine at fair prices.',
        },
    },
    home: HOME,
    shop: SHOP,
    collections: COLLECTIONS,
    cart: CART,
    search: SEARCH,
    journal: JOURNAL,
    pdp: PDP,
    about: ABOUT,
    contact: CONTACT,
    commerce: COMMERCE,
    content: CONTENT,
    assets: ASSETS,
};

// ── Main ─────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    const { dir, theme } = await emitBundle(SPEC);
    console.log(`· wrote bundle → ${dir}`);

    const mod = (await import(pathToFileURL(join(dir, 'blueprint.ts')).href)) as { default: unknown };
    const result = safeParseBlueprint(mod.default);
    if (result.success) {
        console.log('· safeParseBlueprint → VALID');
    } else {
        console.error('· safeParseBlueprint → INVALID');
        for (const issue of result.issues) console.error(`    ${issue.path}: ${issue.message}`);
        process.exitCode = 1;
        return;
    }

    const { path: previewPath } = await writeTemplatePreview(SPEC, theme);
    console.log(`· preview → ${previewPath}`);
}

main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
});
