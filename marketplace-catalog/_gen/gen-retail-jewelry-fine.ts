// sparx-retail-jewelry-fine — a RETAIL/COMMERCE site template: a fine & demi-fine jeweler.
//
// A complete, working shop the moment it installs — a real catalogue of solid-gold and
// sterling pieces (a signet, stacking rings, a pendant, hoops, a tennis bracelet, a
// birthstone necklace, a cuff, and an engagement-style solitaire), categories +
// collections, a bespoke jewelry PDP and a full merchandised home page. Dressed in an
// INLINE bespoke theme — a bone/ivory paper ground, near-black warm ink, a refined
// antique-gold accent, under a high-contrast serif display. Shipped as Aurelia.
//
// SELF-CONTAINED BY DESIGN. Like the rest of the retail family, this generator carries
// its OWN theme inline and passes it on the spec (`theme`), so the whole family can be
// authored in parallel without any two generators contending on a shared `*-themes.ts`
// registry. The shared `template-sites/harness.ts` uses `spec.theme` verbatim.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-jewelry-fine.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-jewelry-fine/**" \
//     "marketplace-catalog/_gen/gen-retail-jewelry-fine.ts"
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
// A jeweler's paper: a warm bone/ivory ground, near-black ink, a near-black primary that
// reads as luxe restraint (the confident action is the one printed in near-black), and a
// refined ANTIQUE-GOLD accent kept legible enough to carry links (≤50% L on the ivory
// ground). A high-contrast Cormorant serif display over Outfit. Complete light + dark; the
// dark mode is a jewel box — deep warm charcoal with the gold turned bright — and the
// blueprint sweep's contrast check is the gate.
const THEME = defineTheme({
    name: 'aurelia-fine',
    type: { body: face('Outfit', 'sans-serif'), head: face('Cormorant Garamond', 'serif') },
    shape: { selector: '0.375rem', field: '0.25rem', box: '0.375rem', depth: '0' },
    light: {
        surfaces: ['oklch(97% 0.008 85)', 'oklch(94% 0.012 82)', 'oklch(89% 0.016 80)', 'oklch(20% 0.012 60)'],
        roles: {
            primary: 'oklch(24% 0.02 60)',
            secondary: 'oklch(44% 0.03 65)',
            accent: 'oklch(50% 0.1 80)',
            neutral: 'oklch(26% 0.015 60)',
            ...STATUS_ON_LIGHT,
        },
    },
    dark: {
        surfaces: ['oklch(20% 0.014 60)', 'oklch(17% 0.014 60)', 'oklch(14% 0.014 60)', 'oklch(95% 0.008 85)'],
        roles: {
            primary: 'oklch(91% 0.02 85)',
            secondary: 'oklch(76% 0.03 65)',
            accent: 'oklch(82% 0.11 82)',
            neutral: 'oklch(32% 0.015 60)',
            ...STATUS_ON_DARK,
        },
    },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
    "aurelia-tile-rings": "https://images.unsplash.com/photo-1592752411609-3c28358bb10a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RhY2slMjB0aGluJTIwZ29sZCUyMHJpbmdzJTIwZmluZ2VydGlwfGVufDB8MHx8fDE3ODY0MDM3NzF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "aurelia-tile-necklaces": "https://images.unsplash.com/photo-1758995115543-983c55f98a33?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZmluZSUyMGdvbGQlMjBwZW5kYW50fGVufDB8MHx8fDE3ODY0MDM5Njd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "aurelia-tile-earrings": "https://images.unsplash.com/photo-1628872354761-c289e269092f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8Z29sZCUyMGhvb3AlMjBlYXJyaW5nc3xlbnwwfDB8fHwxNzg2NDAzOTcwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "aurelia-tile-bracelets": "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z29sZCUyMGN1ZmYlMjB0ZW5uaXMlMjBicmFjZWxldCUyMGFycmFuZ2VkJTIwbGluZW58ZW58MHwwfHx8MTc4NjQwMzc3OXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "aurelia-band-craft": "https://images.unsplash.com/photo-1623365545467-d0f2c7ecd677?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8amV3ZWxlciUyMHNldHRpbmclMjBzdG9uZSUyMGJlbmNoJTIwdW5kZXIlMjBsb3VwZXxlbnwwfDB8fHwxNzg2NDAzNzgyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "aurelia-band-gift": "https://images.unsplash.com/photo-1674620213535-9b2a2553ef40?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGllY2UlMjBqZXdlbHJ5JTIwbmVzdGVkJTIwY3JlYW0lMjBnaWZ0JTIwYm94JTIwcmliYm9ufGVufDB8MHx8fDE3ODY0MDM3ODV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "aurelia-prod-signet": "https://images.unsplash.com/photo-1705326455036-0fab8ecba04d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cG9saXNoZWQlMjBnb2xkJTIwc2lnbmV0JTIwcmluZ3xlbnwwfDB8fHwxNzg2NDAzNzg4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "aurelia-prod-stacking": "https://images.unsplash.com/photo-1543294001-f7cd5d7fb516?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2V0JTIwdGhyZWUlMjBmaW5lJTIwc3RhY2tpbmclMjByaW5nc3xlbnwwfDB8fHwxNzg2NDAzNzkwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "aurelia-prod-pendant": "https://images.unsplash.com/photo-1662434923031-b9bf1b6c10e2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c21hbGwlMjBnb2xkJTIwcGVuZGFudCUyMGZpbmUlMjBjaGFpbnxlbnwwfDB8fHwxNzg2NDAzNzkzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "aurelia-prod-hoops": "https://images.unsplash.com/photo-1492714485642-dd6df6baafa2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFpciUyMGV2ZXJ5ZGF5JTIwZ29sZCUyMGhvb3AlMjBlYXJyaW5nc3xlbnwwfDB8fHwxNzg2NDAzNzk3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "aurelia-prod-tennis": "https://images.unsplash.com/photo-1570891836868-673ee4818f81?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8bGluZSUyMHNldCUyMHdoaXRlJTIwc3RvbmVzJTIwYWNyb3NzJTIwdGVubmlzJTIwYnJhY2VsZXR8ZW58MHwwfHx8MTc4NjQwMzgwMHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "aurelia-prod-birthstone": "https://images.unsplash.com/photo-1610661022658-5068c4d8f286?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2luZ2xlJTIwYmlydGhzdG9uZSUyMHBlbmRhbnQlMjBmaW5lJTIwY2hhaW58ZW58MHwwfHx8MTc4NjQwMzgwM3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "aurelia-prod-cuff": "https://images.unsplash.com/photo-1655707063473-3ee2e5b5eeb8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c21vb3RoJTIwb3BlbiUyMGdvbGQlMjBjdWZmJTIwYnJhY2VsZXR8ZW58MHwwfHx8MTc4NjQwMzgwNnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "aurelia-prod-solitaire": "https://images.unsplash.com/photo-1677948655785-898116437d92?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c29saXRhaXJlJTIwcmluZyUyMHNpbmdsZSUyMGJyaWxsaWFudCUyMHN0b25lfGVufDB8MHx8fDE3ODY0MDM4MDl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "aurelia-post-metals": "https://images.unsplash.com/photo-1624365169873-d42588f4e866?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z29sZCUyMHNpbHZlciUyMHBpZWNlcyUyMGxhaWQlMjBzaWRlJTIwYnklMjBzaWRlfGVufDB8MHx8fDE3ODY0MDM4MTJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "aurelia-post-care": "https://images.unsplash.com/photo-1769461766792-3993f0ab1b02?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c29mdCUyMGNsb3RoJTIwcG9saXNoaW5nJTIwZ29sZCUyMHJpbmd8ZW58MHwwfHx8MTc4NjQwMzgxNnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "aurelia-post-sizing": "https://images.unsplash.com/photo-1571504940504-7c91d1286bea?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmluZyUyMHNpemVyJTIwbWVhc3VyaW5nfGVufDB8MHx8fDE3ODY0MDM5NzN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
    id: string;
    url: string;
    alt: string;
}

const ASSETS: Asset[] = [
    { id: 'aurelia-hero', url: src('aurelia-hero'), alt: 'A solid-gold signet ring resting on cream linen in soft daylight' },
    { id: 'aurelia-tile-rings', url: src('aurelia-tile-rings'), alt: 'A stack of thin gold rings on a fingertip' },
    { id: 'aurelia-tile-necklaces', url: src('aurelia-tile-necklaces'), alt: 'A fine gold pendant necklace lying on pale stone' },
    { id: 'aurelia-tile-earrings', url: src('aurelia-tile-earrings'), alt: 'A pair of gold hoop earrings against a neutral ground' },
    { id: 'aurelia-tile-bracelets', url: src('aurelia-tile-bracelets'), alt: 'A gold cuff and a tennis bracelet arranged on linen' },
    { id: 'aurelia-band-craft', url: src('aurelia-band-craft'), alt: 'A jeweler setting a stone at the bench under a loupe' },
    { id: 'aurelia-band-gift', url: src('aurelia-band-gift'), alt: 'A piece of jewelry nested in a cream gift box with a ribbon' },
    { id: 'aurelia-prod-signet', url: src('aurelia-prod-signet'), alt: 'A polished gold signet ring' },
    { id: 'aurelia-prod-stacking', url: src('aurelia-prod-stacking'), alt: 'A set of three fine stacking rings' },
    { id: 'aurelia-prod-pendant', url: src('aurelia-prod-pendant'), alt: 'A small gold pendant on a fine chain' },
    { id: 'aurelia-prod-hoops', url: src('aurelia-prod-hoops'), alt: 'A pair of everyday gold hoop earrings' },
    { id: 'aurelia-prod-tennis', url: src('aurelia-prod-tennis'), alt: 'A line of set white stones across a tennis bracelet' },
    { id: 'aurelia-prod-birthstone', url: src('aurelia-prod-birthstone'), alt: 'A single birthstone pendant on a fine chain' },
    { id: 'aurelia-prod-cuff', url: src('aurelia-prod-cuff'), alt: 'A smooth open gold cuff bracelet' },
    { id: 'aurelia-prod-solitaire', url: src('aurelia-prod-solitaire'), alt: 'A solitaire ring with a single brilliant stone' },
    { id: 'aurelia-post-metals', url: src('aurelia-post-metals'), alt: 'Gold and silver pieces laid side by side on linen' },
    { id: 'aurelia-post-care', url: src('aurelia-post-care'), alt: 'A soft cloth polishing a gold ring' },
    { id: 'aurelia-post-sizing', url: src('aurelia-post-sizing'), alt: 'A ring sizer and a measuring tape on a bench' },
];

const assetUrl = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-retail-jewelry-fine: unknown asset "${id}"`);
    return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one macro photograph, a serif headline and a lead in a solid
 *  readable panel anchored bottom-left, a filled shop CTA + a text link. Never ink on the
 *  photo. */
function hero(): Node {
    return el('section', 'relative @container overflow-hidden bg-base-200', {
        children: [
            el('img', 'absolute inset-0 h-full w-full object-cover', {
                attrs: { src: assetUrl('aurelia-hero'), alt: 'A solid-gold signet ring on cream linen', loading: 'lazy' },
            }),
            el(
                'div',
                'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
                {
                    children: [
                        el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
                            children: [
                                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                                    text: 'Fine jewelry, made to be worn every day.',
                                }),
                                el('p', 'text-lg leading-relaxed text-base-content', {
                                    text: 'Aurelia is a small jewelry house working in solid 14k gold and sterling silver — pieces designed to be layered, kept, and passed on. No plating, no fillers, no fast-fashion metal that greens your skin by summer.',
                                }),
                                el('div', 'flex flex-wrap items-center gap-4', {
                                    children: [
                                        el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop the collection' }),
                                        el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                                            attrs: { href: '/collections' },
                                            text: 'Explore collections',
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
                        text: 'Shop by piece',
                    }),
                    el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
                        children: [
                            categoryTile({ assetId: 'aurelia-tile-rings', label: 'Rings', href: '/shop', alt: 'A stack of thin gold rings' }),
                            categoryTile({ assetId: 'aurelia-tile-necklaces', label: 'Necklaces', href: '/shop', alt: 'A fine gold pendant necklace' }),
                            categoryTile({ assetId: 'aurelia-tile-earrings', label: 'Earrings', href: '/shop', alt: 'A pair of gold hoop earrings' }),
                            categoryTile({ assetId: 'aurelia-tile-bracelets', label: 'Bracelets', href: '/shop', alt: 'A gold cuff and a tennis bracelet' }),
                        ],
                    }),
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

const HOME: Node[] = [
    hero(),
    categoryTiles(),
    productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'New this season' }),
    editorialBand({
        heading: 'Solid metal, made to last',
        lead: 'Every Aurelia piece is solid 14k gold or sterling silver, cast and finished by hand in a small workshop. Stones are set, not glued; clasps are soldered, not crimped. We build things to be worn for decades, not a season.',
        assetId: 'aurelia-band-craft',
        cta: 'How it’s made',
        href: '/blog/gold-vs-silver',
        alt: 'A jeweler setting a stone at the bench',
    }),
    productsBlock({ source: 'commerce.category.rings', layout: 'carousel', heading: 'The ring edit' }),
    editorialBand({
        heading: 'Wrapped, ready to give',
        lead: 'Every order arrives in a linen-lined box with a card you can write yourself — no printed price in sight. Free engraving on rings and pendants, and a lifetime of complimentary cleaning and re-polishing, always.',
        assetId: 'aurelia-band-gift',
        cta: 'Shop gifts',
        href: '/collections',
        alt: 'A piece of jewelry in a cream gift box',
    }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (house label, title, price, low-stock,
 *  description, add-to-cart, a static "made & guaranteed" note, and policy links). */
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
                                        text: 'Aurelia',
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
                                        label: 'Only a few left',
                                    }),
                                ],
                            }),
                            pdpDescription('text-lg leading-relaxed text-base-content'),
                            addToCartForm(),
                            el('div', 'flex flex-col gap-2 rounded-box border border-base-300 bg-base-200 p-5', {
                                children: [
                                    el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'Made & guaranteed' }),
                                    el('p', 'text-base leading-relaxed text-base-content', {
                                        text: 'Solid metal, hand-finished and hallmarked. Free engraving on rings and pendants, a linen gift box with every order, and a lifetime of complimentary cleaning and re-polishing. Not right? Return it unworn within 30 days.',
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

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Wears well with' });

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
        'The collection',
        'Every piece we make, in solid 14k gold and sterling silver — rings, necklaces, earrings and bracelets. Filter by metal or category, or sort however you like; all of it is hallmarked, hand-finished, and made to be worn every day.'
    ),
];
const COLLECTIONS: Node[] = [
    pageMasthead(
        'Collections',
        'The pieces grouped the way people actually shop — this season’s new arrivals, the everyday gold you’ll reach for daily, the signature statement pieces, and rings made to mark a moment.'
    ),
];
const SEARCH: Node[] = [
    pageMasthead('Search Aurelia', 'Looking for a metal, a stone, or a size? Search the whole collection and the journal below.'),
];
const CART: Node[] = [
    el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
                children: [
                    el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your bag' }),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Free insured shipping over $100, a linen gift box with every order, and 30-day returns on anything unworn. Every piece is solid metal and hallmarked — a keepsake, not a fast-fashion buy.',
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
                    el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The Aurelia journal' }),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Notes from the bench — how to choose between gold and silver, how to care for solid metal, and how to find your ring size at home. Plain, honest, no jargon.',
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
                    el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Aurelia' }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'Aurelia began at a single bench, with one jeweler tired of watching plated high-street pieces tarnish and snap within a year. The idea was simple, and it hasn’t changed: work only in solid metal, keep the designs quiet enough to wear forever, and price them so a good piece isn’t once-in-a-lifetime.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'Everything is made in small runs in our own workshop — cast, filed, set and polished by hand, then hallmarked. We buy recycled gold and silver, source stones we can trace, and repair anything we’ve made for as long as you own it.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'No plating that wears through, no mystery alloys, no piece that isn’t what the stamp inside says it is. Just solid jewelry, made with care, meant to be kept.',
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
        heading: 'Say hello',
        intro: 'A question about a piece, a custom commission, sizing, or a repair? Tell us what you’re after and a real jeweler — not a bot — will write you back.',
        submitLabel: 'Email the workshop',
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

// Metal is the spine of a fine-jewelry catalogue — a swatch of solid gold vs sterling
// silver, priced apart because the metal genuinely is (gold is the reference price; silver
// is a fraction of it). Ring sizes are a dropdown. A birthstone is a dropdown of months.
const RING_SIZES = ['5', '6', '7', '8', '9'];
const BIRTHSTONES = ['January — Garnet', 'April — White Topaz', 'July — Ruby', 'October — Opal', 'December — Blue Topaz'];

const metalOption: OptionDecl = {
    name: 'Metal',
    displayType: 'swatch',
    values: [{ value: '14k Gold' }, { value: 'Sterling Silver' }],
};
const sizeOption = (values: string[]): OptionDecl => ({
    name: 'Size',
    displayType: 'dropdown',
    values: values.map((value) => ({ value })),
});
const birthstoneOption: OptionDecl = {
    name: 'Birthstone',
    displayType: 'dropdown',
    values: BIRTHSTONES.map((value) => ({ value })),
};

const metalCode = (metal: string): string => (metal === '14k Gold' ? 'G' : 'S');
// Silver at ~55% of the gold price — a realistic spread that lets the storefront's swatch
// resolve two genuinely different prices, not a cosmetic option.
const silverPrice = (goldPrice: number): number => Math.round(goldPrice * 0.55);
const sizeCode = (s: string): string => s.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase();

/** A piece offered in both metals only (no size) — the necklaces, earrings and bracelets.
 *  Two variants, gold default, each priced for its metal. */
const piece = (opts: {
    handle: string;
    title: string;
    description: string;
    goldPrice: number;
    sku: string;
    productType: string;
    category: string;
    collections: string[];
    tags: string[];
    asset: string;
    seoTitle: string;
    seoDescription: string;
}): Product => ({
    handle: opts.handle,
    title: opts.title,
    description: opts.description,
    status: 'active',
    productType: opts.productType,
    vendor: 'Aurelia',
    tags: opts.tags,
    categoryHandles: [opts.category],
    collectionHandles: opts.collections,
    seoTitle: opts.seoTitle,
    seoDescription: opts.seoDescription,
    options: [metalOption],
    variants: [
        { sku: `${opts.sku}-G`, priceCents: money(opts.goldPrice), isDefault: true, inventoryPolicy: 'continue', optionValues: { Metal: '14k Gold' } },
        { sku: `${opts.sku}-S`, priceCents: money(silverPrice(opts.goldPrice)), inventoryPolicy: 'continue', optionValues: { Metal: 'Sterling Silver' } },
    ],
    images: [{ assetId: opts.asset, isPrimary: true, alt: opts.title }],
});

/** A ring — the Metal × Size grid, so the storefront's swatch + dropdown both resolve. */
const ring = (opts: {
    handle: string;
    title: string;
    description: string;
    goldPrice: number;
    sku: string;
    collections: string[];
    tags: string[];
    asset: string;
    seoTitle: string;
    seoDescription: string;
    sizes?: string[];
}): Product => {
    const sizes = opts.sizes ?? RING_SIZES;
    const variants: Variant[] = [];
    let first = true;
    for (const metal of ['14k Gold', 'Sterling Silver']) {
        const price = metal === '14k Gold' ? opts.goldPrice : silverPrice(opts.goldPrice);
        for (const size of sizes) {
            variants.push({
                sku: `${opts.sku}-${metalCode(metal)}-${sizeCode(size)}`,
                priceCents: money(price),
                ...(first ? { isDefault: true as const } : {}),
                inventoryPolicy: 'continue',
                optionValues: { Metal: metal, Size: size },
            });
            first = false;
        }
    }
    return {
        handle: opts.handle,
        title: opts.title,
        description: opts.description,
        status: 'active',
        productType: 'Ring',
        vendor: 'Aurelia',
        tags: opts.tags,
        categoryHandles: ['rings'],
        collectionHandles: opts.collections,
        seoTitle: opts.seoTitle,
        seoDescription: opts.seoDescription,
        options: [metalOption, sizeOption(sizes)],
        variants,
        images: [{ assetId: opts.asset, isPrimary: true, alt: opts.title }],
    };
};

const PRODUCTS: Product[] = [
    ring({
        handle: 'oval-signet-ring',
        title: 'Oval Signet Ring',
        description:
            'A classic oval-face signet with a softly domed top, polished to a mirror or brushed matte on request — the ring you engrave with an initial, a date, or nothing at all. Substantial without being heavy, and just as good stacked as worn alone.',
        goldPrice: 285,
        sku: 'AUR-SIGNET',
        collections: ['new-arrivals', 'best-sellers', 'everyday-gold'],
        tags: ['ring', 'signet', 'engravable'],
        asset: 'aurelia-prod-signet',
        seoTitle: 'Oval Signet Ring — solid 14k gold or silver | Aurelia',
        seoDescription: 'A classic engravable oval signet ring in solid 14k gold or sterling silver. Polished or brushed.',
    }),
    ring({
        handle: 'stacking-ring-trio',
        title: 'Stacking Ring Trio',
        description:
            'Three fine bands — a plain round, a hammered facet and a tiny bezel-set stone — designed to be worn together or split across fingers. Buy the set to start a stack, then keep adding; they’re made to sit flush against each other without catching.',
        goldPrice: 195,
        sku: 'AUR-STACK',
        collections: ['everyday-gold', 'best-sellers'],
        tags: ['ring', 'stacking', 'set'],
        asset: 'aurelia-prod-stacking',
        seoTitle: 'Stacking Ring Trio — set of three fine bands | Aurelia',
        seoDescription: 'A set of three fine stacking rings in solid 14k gold or sterling silver — plain, hammered and bezel-set.',
    }),
    piece({
        handle: 'petite-pendant-necklace',
        title: 'Petite Pendant Necklace',
        description:
            'A small solid pendant on a delicate 16–18" adjustable chain — the everyday necklace that layers with anything and never needs taking off. Wear it alone for a clean line, or as the shortest layer under longer chains.',
        goldPrice: 165,
        sku: 'AUR-PENDANT',
        productType: 'Necklace',
        category: 'necklaces',
        collections: ['new-arrivals', 'everyday-gold', 'gifts'],
        tags: ['necklace', 'pendant', 'layering'],
        asset: 'aurelia-prod-pendant',
        seoTitle: 'Petite Pendant Necklace — solid gold or silver | Aurelia',
        seoDescription: 'A small solid pendant on a fine adjustable chain, in 14k gold or sterling silver. Made to layer.',
    }),
    piece({
        handle: 'everyday-hoop-earrings',
        title: 'Everyday Hoop Earrings',
        description:
            'The hoop you put in and forget about — a lightweight 15mm solid hoop with a secure hinged closure, smooth enough to sleep in and small enough for the office. The pair most people never take out once they own them.',
        goldPrice: 145,
        sku: 'AUR-HOOP',
        productType: 'Earrings',
        category: 'earrings',
        collections: ['everyday-gold', 'best-sellers'],
        tags: ['earrings', 'hoops', 'everyday'],
        asset: 'aurelia-prod-hoops',
        seoTitle: 'Everyday Hoop Earrings — solid 14k gold or silver | Aurelia',
        seoDescription: 'Lightweight 15mm solid hoop earrings with a secure hinged closure, in 14k gold or sterling silver.',
    }),
    piece({
        handle: 'classic-tennis-bracelet',
        title: 'Classic Tennis Bracelet',
        description:
            'A continuous line of round white sapphires, each hand-set in its own four-prong basket so the light gets all the way around. A double-locking clasp keeps it on; a graceful, unbroken sparkle keeps it a forever piece.',
        goldPrice: 620,
        sku: 'AUR-TENNIS',
        productType: 'Bracelet',
        category: 'bracelets',
        collections: ['the-signature-edit', 'gifts'],
        tags: ['bracelet', 'tennis', 'sapphire'],
        asset: 'aurelia-prod-tennis',
        seoTitle: 'Classic Tennis Bracelet — white sapphire line | Aurelia',
        seoDescription: 'A hand-set line of round white sapphires with a double-locking clasp, in solid 14k gold or sterling silver.',
    }),
    {
        handle: 'birthstone-necklace',
        title: 'Birthstone Necklace',
        description:
            'A single bezel-set birthstone on a fine chain — pick the month that means something and we set the stone to match. The gift that lands every time: personal without being fussy, and worn far past the birthday it marks.',
        status: 'active',
        productType: 'Necklace',
        vendor: 'Aurelia',
        tags: ['necklace', 'birthstone', 'personalized', 'gift'],
        categoryHandles: ['necklaces'],
        collectionHandles: ['gifts', 'new-arrivals'],
        seoTitle: 'Birthstone Necklace — bezel-set, solid gold or silver | Aurelia',
        seoDescription: 'A single bezel-set birthstone on a fine chain, set to your month, in solid 14k gold or sterling silver.',
        options: [metalOption, birthstoneOption],
        variants: [
            ...BIRTHSTONES.flatMap((stone, i) => [
                {
                    sku: `AUR-BIRTH-G-${sizeCode(stone)}`,
                    priceCents: money(150),
                    ...(i === 0 ? { isDefault: true as const } : {}),
                    inventoryPolicy: 'continue' as const,
                    optionValues: { Metal: '14k Gold', Birthstone: stone },
                },
                {
                    sku: `AUR-BIRTH-S-${sizeCode(stone)}`,
                    priceCents: money(silverPrice(150)),
                    inventoryPolicy: 'continue' as const,
                    optionValues: { Metal: 'Sterling Silver', Birthstone: stone },
                },
            ]),
        ],
        images: [{ assetId: 'aurelia-prod-birthstone', isPrimary: true, alt: 'A single birthstone pendant on a fine chain' }],
    },
    piece({
        handle: 'smooth-cuff-bracelet',
        title: 'Smooth Cuff Bracelet',
        description:
            'A solid open cuff with a clean, unadorned curve — the piece that reads as expensive precisely because there’s nothing on it. Gently springs to slip on over the wrist and holds its shape for years; polished bright or brushed soft.',
        goldPrice: 240,
        sku: 'AUR-CUFF',
        productType: 'Bracelet',
        category: 'bracelets',
        collections: ['everyday-gold', 'the-signature-edit'],
        tags: ['bracelet', 'cuff', 'minimal'],
        asset: 'aurelia-prod-cuff',
        seoTitle: 'Smooth Cuff Bracelet — solid 14k gold or silver | Aurelia',
        seoDescription: 'A solid open cuff with a clean unadorned curve, in 14k gold or sterling silver. Polished or brushed.',
    }),
    ring({
        handle: 'solitaire-ring',
        title: 'The Solitaire',
        description:
            'A single brilliant-cut lab-grown white sapphire raised in a slim six-prong setting, on a fine tapered band that lets the stone stand alone. The engagement-style ring for people who want the look, the sparkle and the meaning — without the small mortgage.',
        goldPrice: 1250,
        sku: 'AUR-SOLITAIRE',
        collections: ['engagement', 'the-signature-edit'],
        tags: ['ring', 'solitaire', 'engagement', 'sapphire'],
        asset: 'aurelia-prod-solitaire',
        seoTitle: 'The Solitaire — engagement-style ring | Aurelia',
        seoDescription: 'A brilliant-cut white sapphire in a six-prong solitaire setting on a fine tapered band, in solid gold or silver.',
    }),
];

const COMMERCE = {
    categories: [
        { handle: 'rings', name: 'Rings', description: 'Signets, stackers, bands and the solitaire.', featured: true },
        { handle: 'necklaces', name: 'Necklaces', description: 'Pendants, chains and birthstones.', featured: true },
        { handle: 'earrings', name: 'Earrings', description: 'Hoops and studs for every day.', featured: true },
        { handle: 'bracelets', name: 'Bracelets', description: 'Cuffs and the tennis line.', featured: true },
    ],
    collections: [
        {
            handle: 'new-arrivals',
            name: 'New arrivals',
            description: 'The newest pieces off the bench.',
            type: 'manual',
            featured: true,
            productHandles: ['oval-signet-ring', 'petite-pendant-necklace', 'birthstone-necklace'],
        },
        {
            handle: 'best-sellers',
            name: 'Best sellers',
            description: 'The pieces people come back for.',
            type: 'manual',
            featured: true,
            productHandles: ['oval-signet-ring', 'stacking-ring-trio', 'everyday-hoop-earrings'],
        },
        {
            handle: 'everyday-gold',
            name: 'Everyday gold',
            description: 'Solid pieces made to never take off.',
            type: 'manual',
            featured: true,
            productHandles: ['stacking-ring-trio', 'everyday-hoop-earrings', 'petite-pendant-necklace', 'smooth-cuff-bracelet'],
        },
        {
            handle: 'the-signature-edit',
            name: 'The signature edit',
            description: 'The statement pieces — a little more of everything.',
            type: 'manual',
            featured: false,
            productHandles: ['classic-tennis-bracelet', 'smooth-cuff-bracelet', 'solitaire-ring'],
        },
        {
            handle: 'engagement',
            name: 'Engagement',
            description: 'Rings made to mark a moment.',
            type: 'manual',
            featured: false,
            productHandles: ['solitaire-ring'],
        },
        {
            handle: 'gifts',
            name: 'Gifts',
            description: 'Wrapped, engraved, ready to give.',
            type: 'manual',
            featured: false,
            productHandles: ['petite-pendant-necklace', 'classic-tennis-bracelet', 'birthstone-necklace'],
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
        slug: 'gold-vs-silver',
        status: 'published',
        body: {
            title: 'Gold or silver: how to actually choose',
            excerpt: 'Not a taste test — a practical guide to skin tone, upkeep, budget and how the two metals age, so you buy the one you’ll wear.',
            featuredImage: { $asset: 'aurelia-post-metals' },
            body: {
                type: 'doc',
                content: [
                    para('The gold-versus-silver question gets treated as a matter of taste, but most of the answer is practical. Both of ours are solid metal — 14k gold and .925 sterling silver, never plated — so neither will wear through or turn your skin green. The difference is in tone, upkeep, budget, and how each one ages.'),
                    h2('Tone and how they age'),
                    para('Warm skin tones tend to sit beautifully against gold; cooler tones against silver — but the honest answer is to hold each to your wrist in daylight and trust your eye. In wear, 14k gold barely changes: it keeps its color for decades with almost no effort. Sterling silver naturally tarnishes to a soft grey over time, which some people love as patina and others polish back to bright in seconds with a cloth.'),
                    h2('Budget, and mixing the two'),
                    para('Gold costs more because it genuinely is more — our silver versions run a little over half the price of the same piece in gold, which makes silver a lovely way to try a design before committing. And the old rule about never mixing metals is gone: a gold signet next to a silver band reads as considered now, not careless. Buy the metal you’ll actually reach for, and layer freely.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'caring-for-solid-jewelry',
        status: 'published',
        body: {
            title: 'Caring for solid gold and silver',
            excerpt: 'Solid metal is forgiving, but a few small habits keep it looking new — here’s the whole routine, and the two things to actually avoid.',
            featuredImage: { $asset: 'aurelia-post-care' },
            body: {
                type: 'doc',
                content: [
                    para('One of the quiet luxuries of solid jewelry is how little it asks of you. There’s no plating to wear through, so a scratch polishes out and a piece can be worn hard for years. Still, a few small habits keep gold bright and silver from tarnishing faster than it needs to.'),
                    h2('The everyday routine'),
                    para('Put jewelry on last — after lotion, perfume and hairspray, which are the main things that dull a finish. Take rings off for the gym, the garden and the washing-up; it’s knocks and grit, not water, that do the damage. A quick rub with a soft cloth after wear is enough most days. Once a month, warm water, a drop of dish soap and a soft brush brings everything back — then dry it properly before it goes away.'),
                    h2('Storing it, and what to avoid'),
                    para('Store pieces separately so they don’t scratch each other — a lined box or even individual soft pouches. Silver keeps best sealed away from air, which is why a little zip bag slows tarnish dramatically. The two things to genuinely avoid: chlorine (take rings off before a pool or hot tub) and abrasive "polishing" pastes on anything with stones. When in doubt, send it to us — cleaning and re-polishing anything we made is free, for life.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'finding-your-ring-size',
        status: 'published',
        body: {
            title: 'How to find your ring size at home',
            excerpt: 'No jeweler, no gadget — a piece of string, a ruler, and two rules that stop you sizing wrong. Plus what to do if you land between sizes.',
            featuredImage: { $asset: 'aurelia-post-sizing' },
            body: {
                type: 'doc',
                content: [
                    para('Ordering a ring online feels like a gamble, but sizing at home is genuinely simple — and more reliable than guessing in a shop on a cold day. All you need is a strip of paper or string, a ruler, and a couple of minutes.'),
                    h2('The string method'),
                    para('Wrap a thin strip of paper snugly around the base of the finger, mark where it overlaps, and lay it flat against a millimetre ruler. That length is your finger’s circumference; match it to our size chart. Measure the actual finger the ring will live on — hands differ left to right — and do it at the end of the day, when fingers are at their largest, never first thing in the morning or straight after cold water.'),
                    h2('Between sizes, and wide bands'),
                    para('If you land between two sizes, size up: a fraction loose is comfortable, a fraction tight is unwearable. Wide bands sit more snugly than thin ones, so go up a half size for anything chunky like the signet. Still unsure? Order two sizes, keep the one that fits and send the other back free — or come in and we’ll size you properly. And every ring we make can be resized once for free within the first year.'),
                ],
            },
        },
    },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
    slug: 'retail-jewelry-fine',
    key: 'sparx-retail-jewelry-fine',
    name: 'Fine Jeweler',
    theme: THEME,
    summary:
        'A complete, working shop for a fine & demi-fine jeweler: a real catalogue of solid 14k gold and sterling silver pieces — a signet, stacking rings, a pendant, hoops, a tennis bracelet, a birthstone necklace, a cuff and a solitaire — with Metal and Size variants, categories, collections, a bespoke PDP and a merchandised home page. Precious, restrained theme — a bone/ivory ground, near-black ink, an antique-gold accent, a serif display. Shipped as Aurelia.',
    tagline: 'A precious, working storefront for a fine jeweler.',
    vertical: 'retail',
    industry: 'Fine jeweler',
    requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
    sortWeight: 88,
    brand: {
        businessName: 'Aurelia',
        tagline: 'Fine jewelry, made to be worn every day.',
    },
    chrome: { navbar: 'centerLogo', footer: 'newsletter', showCta: false },
    seo: {
        home: {
            title: 'Aurelia — fine jewelry in solid gold and silver',
            description:
                'Aurelia is a small jewelry house working only in solid 14k gold and sterling silver — rings, necklaces, earrings and bracelets, hand-finished and made to be worn every day.',
        },
        about: {
            title: 'About Aurelia',
            description:
                'How Aurelia designs, casts and finishes solid-metal jewelry — recycled gold and silver, traceable stones, hand-set and hallmarked, repaired for life.',
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
