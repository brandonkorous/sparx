// sparx-couture-serif — a reference-driven site template (docs/templates/victoria-beckham).
//
// Victoria Beckham translated to sparx: a high-fashion luxury-serif storefront where
// restraint itself is the premium — pure black on pure white, one classical serif
// carrying everything, full-bleed campaign imagery, near-zero chrome. Ported from
// ready-to-wear to a fine-jewellery & fragrance maison — Vérane, "Cut and composed in
// small numbers". The home page is the VB rhythm — a centered-overlay campaign hero,
// three collection tiles, a featured carousel, the "why we make so few" turn, the
// fragrance library, and an "Inside the maison" editorial trio — dressed in the bespoke
// `maison` theme (pure #000 ink on #FFF, serif everywhere, zero radius, flat).
//
// This file is JUST the SPEC; the composition + emission live in the shared
// `template-sites/harness.ts`, which the other nine templates reuse. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-template-couture-serif.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-couture-serif/**" \
//     "marketplace-catalog/_gen/**/*.ts"
//   pnpm --filter @sparx/api-rest marketplace:self-register
//
// WHY RELATIVE IMPORTS — see the harness header (marketplace-catalog has no node_modules).

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
    el,
    type Node,
} from '../../packages/silica-catalog/node_modules/@wizeworks/silicaui-html/dist/index.js';
import { productsBlock } from '../../packages/silica-catalog/src/commerce';
import { safeParseBlueprint } from '../../packages/blueprints/src/validate';

import { contactSection } from './shared/contact-section';
import { emitBundle, type TemplateSiteSpec } from './template-sites/harness';
import { writeTemplatePreview } from './template-sites/preview';
import { videoBackdrop } from './template-sites/behaviors';
import {
    addToCartForm,
    pdpAttributes,
    pdpDescription,
    pdpImage,
    pdpPolicyLinks,
    pdpPriceRow,
    pdpStockBadge,
    pdpTitle,
    productPage,
} from './template-sites/pdp';

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Royalty-free Unsplash photographs, verified reachable (HTTP 200) at authoring time.
// Product + post images go through `assets` by id (the installer re-hosts them); the
// hero / category-tile / editorial photos are TREE imagery, so they hot-link the same
// URL inline (docs/54 §6) — they still appear in `assets` as the single documented
// registry of the bundle's imagery + alt text. In the `maison` translation the imagery
// carries the ENTIRE color palette — the chrome is pure black on white.
const U = (id: string): string => `https://images.unsplash.com/photo-${id}?w=1400&q=80`;

const IMG = {
    // Products — fine jewellery
    astridRing: '1622398925373-3f91b1e275f5',
    coletteBracelet: '1623365545467-d0f2c7ecd677',
    vesperEarrings: '1603974372039-adc49044b6bd',
    luneNecklace: '1601121141461-9d6647bca1ed',
    odetteBand: '1598560917807-1bae44bd2be8',
    margauxHoops: '1615655114865-4cc1bda5901e',
    celesteCuff: '1628926379972-9843ad139a8c',
    // Products — fragrance
    no1: '1523293182086-7651a899d37f',
    no2: '1541643600914-78b084683601',
    no3: '1594035910387-fea47794261f',
    no4: '1587017539504-67cfbddac569',
    discoverySet: '1610461888750-10bfc601b874',
    // Journal posts
    postWinter: '1758631279564-785e98313f8b',
    postMaking: '1622618991746-fe6004db3a47',
    postFounder: '1592833578500-1082e18665a3',
    // Hero + collection tiles + editorial (tree imagery)
    heroCampaign: '1536924430914-91f9e2041b83',
    tileHighJewellery: '1623321673989-830eff0fd59f',
    tileEverydayFine: '1614606140245-2c33ece9e2cf',
    tileFragrance: '1582211594533-268f4f1edcb9',
    bandAtelier: '1613915617430-8ab0fd7c6baf',
    trioStones: '1762537132897-f6b577190e80',
    trioScent: '1615634260167-c8cdede054de',
    trioFounder: '1529408570047-e4414fb17e95',
} as const;

interface Asset {
    id: string;
    url: string;
    alt: string;
}

const ASSETS: Asset[] = [
    { id: 'astrid-signet-ring', url: U(IMG.astridRing), alt: 'A gold signet ring on a plain ground' },
    { id: 'colette-tennis-bracelet', url: U(IMG.coletteBracelet), alt: 'A line of white diamonds set in a bracelet' },
    { id: 'vesper-drop-earrings', url: U(IMG.vesperEarrings), alt: 'A pair of gold drop earrings' },
    { id: 'lune-pendant-necklace', url: U(IMG.luneNecklace), alt: 'A fine gold pendant necklace' },
    { id: 'odette-pave-band', url: U(IMG.odetteBand), alt: 'A slim pavé band ring' },
    { id: 'margaux-hoop-earrings', url: U(IMG.margauxHoops), alt: 'A pair of brushed-gold hoop earrings' },
    { id: 'celeste-cuff', url: U(IMG.celesteCuff), alt: 'A polished cuff on a plain ground' },
    { id: 'no1-fig-neroli', url: U(IMG.no1), alt: 'A glass eau de parfum bottle' },
    { id: 'no2-iris-ambrette', url: U(IMG.no2), alt: 'An amber-glass fragrance bottle' },
    { id: 'no3-black-rose-oud', url: U(IMG.no3), alt: 'A dark fragrance bottle in low light' },
    { id: 'no4-bergamot-vetiver', url: U(IMG.no4), alt: 'A clear fragrance bottle beside a sprig' },
    { id: 'discovery-set', url: U(IMG.discoverySet), alt: 'A set of small fragrance vials' },
    { id: 'post-winter-high-jewellery', url: U(IMG.postWinter), alt: 'A close study of a high-jewellery stone' },
    { id: 'post-making-no3', url: U(IMG.postMaking), alt: 'A fragrance bottle on a marble surface' },
    { id: 'post-founder', url: U(IMG.postFounder), alt: 'A quiet editorial portrait in black and white' },
    { id: 'hero-campaign', url: U(IMG.heroCampaign), alt: 'A black-and-white campaign portrait' },
    { id: 'tile-high-jewellery', url: U(IMG.tileHighJewellery), alt: 'A high-jewellery necklace worn against skin' },
    { id: 'tile-everyday-fine', url: U(IMG.tileEverydayFine), alt: 'A fine gold ring worn on a hand' },
    { id: 'tile-fragrance', url: U(IMG.tileFragrance), alt: 'A fragrance bottle in soft light' },
    { id: 'band-atelier', url: U(IMG.bandAtelier), alt: 'A hand at work in the atelier' },
    { id: 'trio-stones', url: U(IMG.trioStones), alt: 'Loose stones under a jeweller’s light' },
    { id: 'trio-scent', url: U(IMG.trioScent), alt: 'The making of a fragrance' },
    { id: 'trio-founder', url: U(IMG.trioFounder), alt: 'A portrait from the house’s campaign' },
];

const assetUrl = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-couture-serif: unknown asset "${id}"`);
    return a.url;
};

// ── Home page sections (the Victoria Beckham sequence, maison-restraint) ──────────

/** The full-bleed campaign hero — one photograph filling the width, a CENTERED serif
 *  overlay in a solid readable panel over it and a SINGLE hairline underlined text link
 *  (the VB restraint: no button chrome, no dual CTA). Tenant content, so it hot-links a
 *  real photograph; every class is a NAMED utility so it survives the stamp. */
function hero(): Node {
    return el('section', 'relative @container overflow-hidden bg-base-200', {
        children: [
            // A couture maison opens on a runway/campaign film, not a still — so the hero is an
            // editorial fashion clip behind the centred panel, the campaign still as poster (kept
            // until the clip decodes, and if it never plays / reduced motion is preferred).
            videoBackdrop({
                src: '/video/tpl-couture-serif.mp4',
                poster: assetUrl('hero-campaign'),
                posterAlt: 'A black-and-white campaign portrait',
            }),
            el(
                'div',
                'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-center justify-center gap-6 px-6 py-24 @3xl:py-32',
                {
                    children: [
                        el('div', 'flex max-w-xl flex-col items-center gap-5 bg-base-100 px-10 py-12 text-center', {
                            children: [
                                el(
                                    'h1',
                                    'text-4xl font-medium leading-tight tracking-tight text-base-content @3xl:text-6xl',
                                    { text: 'Cut and composed in small numbers' }
                                ),
                                el('p', 'text-lg leading-relaxed text-base-content', {
                                    text: 'Fine jewellery and fragrance from the Vérane atelier — made a few pieces at a time, to be kept for a lifetime.',
                                }),
                                el('a', 'text-base font-medium text-base-content underline underline-offset-4', {
                                    attrs: { href: '/shop' },
                                    text: 'Discover the collection',
                                }),
                            ],
                        }),
                    ],
                }
            ),
        ],
    });
}

/** One collection tile — a full-bleed photograph with a serif label + underlined link in
 *  a solid panel over it (the VB "New Arrivals / Ready to Wear / Dresses" tile). The whole
 *  tile is the link; the "Explore" affordance is a span, not a nested `<a>`. */
function collectionTile(o: { assetId: string; label: string; href: string; alt: string }): Node {
    return el('a', 'relative @container block overflow-hidden bg-base-200', {
        attrs: { href: o.href },
        children: [
            el('img', 'absolute inset-0 h-full w-full object-cover', {
                attrs: { src: assetUrl(o.assetId), alt: o.alt, loading: 'lazy' },
            }),
            el('div', 'relative flex min-h-96 flex-col items-center justify-end p-6', {
                children: [
                    el('div', 'flex flex-col items-center gap-3 bg-base-100 px-8 py-6 text-center', {
                        children: [
                            el('h3', 'text-2xl font-medium text-base-content', { text: o.label }),
                            el('span', 'text-base text-base-content underline underline-offset-4', {
                                text: 'Explore',
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });
}

/** The three collection tiles under a quiet centered heading — the VB category-tile band,
 *  here the three registers of the house (High Jewellery / Everyday Fine / Fragrance). */
function collectionTiles(): Node {
    return el('section', 'bg-base-100 @container px-6 py-16', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-10', {
                children: [
                    el('h2', 'text-center text-3xl font-medium text-base-content @3xl:text-4xl', {
                        text: 'Three houses under one name',
                    }),
                    el('div', 'grid grid-cols-1 gap-6 @2xl:grid-cols-2 @4xl:grid-cols-3', {
                        children: [
                            collectionTile({
                                assetId: 'tile-high-jewellery',
                                label: 'High Jewellery',
                                href: '/shop',
                                alt: 'A high-jewellery necklace worn against skin',
                            }),
                            collectionTile({
                                assetId: 'tile-everyday-fine',
                                label: 'Everyday Fine',
                                href: '/shop',
                                alt: 'A fine gold ring worn on a hand',
                            }),
                            collectionTile({
                                assetId: 'tile-fragrance',
                                label: 'Fragrance',
                                href: '/shop',
                                alt: 'A fragrance bottle in soft light',
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });
}

/** The mid-page editorial band — a full-bleed photograph carrying the house's turn ("why
 *  we make so few") in a solid centered panel with a single underlined link. The VB
 *  "House of…" register, held to maison restraint. */
function editorialBand(o: {
    heading: string;
    lead: string;
    assetId: string;
    cta: string;
    href: string;
    alt: string;
}): Node {
    return el('section', 'relative @container overflow-hidden bg-base-200', {
        children: [
            el('img', 'absolute inset-0 h-full w-full object-cover', {
                attrs: { src: assetUrl(o.assetId), alt: o.alt, loading: 'lazy' },
            }),
            el(
                'div',
                'relative mx-auto flex w-full max-w-6xl flex-col items-center justify-center gap-6 px-6 py-20 @3xl:py-28',
                {
                    children: [
                        el('div', 'flex max-w-xl flex-col items-center gap-4 bg-base-100 px-10 py-12 text-center', {
                            children: [
                                el('h2', 'text-3xl font-medium leading-tight text-base-content @3xl:text-4xl', {
                                    text: o.heading,
                                }),
                                el('p', 'text-lg leading-relaxed text-base-content', { text: o.lead }),
                                el('a', 'text-base font-medium text-base-content underline underline-offset-4', {
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

/** One "Inside the maison" tile — a tall photograph with a serif-italic caption below it
 *  and an underlined DISCOVER link (the VB editorial lookbook tile). Caption sits on the
 *  stone ground under the image so it stays legible without a scrim. */
function editorialTile(o: { assetId: string; caption: string; alt: string }): Node {
    return el('a', 'flex flex-col gap-4 bg-base-100', {
        attrs: { href: '/journal' },
        children: [
            el('img', 'aspect-square w-full border border-base-300 bg-base-200 object-cover', {
                attrs: { src: assetUrl(o.assetId), alt: o.alt, loading: 'lazy' },
            }),
            el('div', 'flex flex-col gap-2', {
                children: [
                    el('h3', 'text-xl font-medium italic text-base-content', { text: o.caption }),
                    el('span', 'text-base text-base-content underline underline-offset-4', { text: 'Discover' }),
                ],
            }),
        ],
    });
}

/** The "Inside the maison" editorial trio closing the page — three lookbook tiles under a
 *  centered serif-italic heading, and one black DISCOVER button beneath (the VB
 *  "second editorial trio + black button" beat). The button is a `btn-primary` — pure
 *  black with white ink in `maison`, legible by construction. */
function editorialTrio(): Node {
    return el('section', 'bg-base-100 @container px-6 py-16', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-10', {
                children: [
                    el('h2', 'text-center text-3xl font-medium italic text-base-content @3xl:text-4xl', {
                        text: 'Inside the maison',
                    }),
                    el('div', 'grid grid-cols-1 gap-6 @2xl:grid-cols-2 @4xl:grid-cols-3', {
                        children: [
                            editorialTile({
                                assetId: 'trio-stones',
                                caption: 'Choosing the stones',
                                alt: 'Loose stones under a jeweller’s light',
                            }),
                            editorialTile({
                                assetId: 'trio-scent',
                                caption: 'The making of Nº3',
                                alt: 'The making of a fragrance',
                            }),
                            editorialTile({
                                assetId: 'trio-founder',
                                caption: 'As composed by the founder',
                                alt: 'A portrait from the house’s campaign',
                            }),
                        ],
                    }),
                    el('div', 'flex justify-center', {
                        children: [
                            el('a', 'btn btn-primary btn-lg', {
                                attrs: { href: '/journal' },
                                text: 'Read the Vérane Journal',
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });
}

const HOME: Node[] = [
    hero(),
    collectionTiles(),
    productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'New this season' }),
    editorialBand({
        heading: 'Why we make so few',
        lead: 'Every Vérane piece is cut, set and finished by hand in numbered runs. Small numbers are not a scarcity trick — they are what it takes to answer for every stone, every setting and every drop of scent that leaves the atelier.',
        assetId: 'band-atelier',
        cta: 'Read our story',
        href: '/about',
        alt: 'A hand at work in the atelier',
    }),
    productsBlock({
        source: 'commerce.category.fragrance',
        layout: 'carousel',
        heading: 'The fragrance library',
    }),
    editorialTrio(),
    // NB: no page-level newsletter band here — the `footer: 'newsletter'` chrome variant
    // carries the sign-up, so a section here would be two back-to-back captures.
];

// ── About + Contact (Vérane-voiced) ──────────────────────────────────────────────

const ABOUT: Node[] = [
    el('section', 'bg-base-100 @container px-6 py-20', {
        children: [
            el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-6', {
                children: [
                    el('h1', 'text-4xl font-medium tracking-tight text-base-content @2xl:text-5xl', {
                        text: 'About Vérane',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'Vérane is a small maison of fine jewellery and fragrance. We work in gold, platinum and hand-selected stones, and in scent composed a few litres at a time — and we make in numbered runs, in our own atelier, by the people whose hands are on the work.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'Nothing here is bought in and re-badged. We can tell you where every stone came from, who set it, and how to keep a piece bright for a lifetime. That is the whole idea: cut and composed in small numbers, made to be kept.',
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
        heading: 'Visit the atelier',
        intro: 'Our atelier and salon are open by appointment. Tell us what you are looking for — a single piece, a bespoke commission, or a fragrance to be layered to your own — and we will find a time.',
        submitLabel: 'Email the atelier',
    }),
];

// ── Commerce (Vérane — 12 SKUs: 7 fine jewellery + 5 fragrance) ───────────────────

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
    // The typed product type (docs/143) — every piece here is `apparel`, so the PDP's
    // `pdpAttributes` renders each product's OWN fabric/fit/care/materials/origin.
    productTypeKey: 'apparel';
    attributes: {
        fabric: string;
        fit: string;
        care: string;
        materials: { name: string; percent: string }[];
        origin: string;
    };
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

// Care copy shared across the four eaux + the discovery set — genuinely identical for every
// fragrance in the house, so it lives once (each jewellery piece keeps its own metal-specific
// care, and per-product fabric/fit/materials/origin still differ everywhere).
const SCENT_CARE =
    'Keep it out of heat, direct sun and steam — a closed drawer or its own box, never a bathroom shelf, which is the one place a fine fragrance turns. Composed from natural materials, it settles and deepens a little with age rather than fading.';

const money = (dollars: number): number => Math.round(dollars * 100);

const PRODUCTS: Product[] = [
    {
        handle: 'astrid-signet-ring',
        title: 'Astrid Signet Ring',
        description:
            'A weighty signet turned and finished by hand in solid 18k gold, its face left plain for you or engraved to your own mark. A modern heirloom made to be worn every day and handed on.',
        status: 'active',
        productType: 'Rings',
        vendor: 'Vérane',
        tags: ['ring', 'signet', 'gold', 'fine-jewellery'],
        categoryHandles: ['rings'],
        collectionHandles: ['new-arrivals', 'high-jewellery'],
        seoTitle: 'Astrid Signet Ring — solid 18k gold signet',
        seoDescription: 'A hand-finished solid 18k gold signet ring, plain or engraved to your mark.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'Turned from a solid billet of 18k gold and finished entirely by hand — no plating, no hollow core. The face is left broad and flat to take a seal or a monogram, the shoulders rounded so it sits close to the finger without ever catching.',
            fit: 'A substantial, weighted everyday ring, sized true to a standard band; the broad face wears equally on the little finger or the ring finger. Between sizes, size up so a signet turns freely.',
            care: 'Gold takes a scratch and polishes straight back — a soft cloth keeps the face bright between wears, and the atelier will re-polish the piece and re-cut an engraving for as long as you own it.',
            materials: [
                { name: '18k yellow gold', percent: '75%' },
                { name: 'Fine alloy', percent: '25%' },
            ],
            origin: 'Made in France',
        },
        options: [
            { name: 'Metal', displayType: 'swatch', values: [{ value: 'Yellow gold' }, { value: 'Rose gold' }] },
        ],
        variants: [
            { sku: 'VER-ASTRID-YG', priceCents: money(1450), isDefault: true, inventoryPolicy: 'continue', optionValues: { Metal: 'Yellow gold' } },
            { sku: 'VER-ASTRID-RG', priceCents: money(1450), inventoryPolicy: 'continue', optionValues: { Metal: 'Rose gold' } },
        ],
        images: [{ assetId: 'astrid-signet-ring', isPrimary: true, alt: 'The Astrid Signet Ring' }],
    },
    {
        handle: 'colette-tennis-bracelet',
        title: 'Colette Tennis Bracelet',
        description:
            'An unbroken line of hand-set white diamonds on an 18k gold rail, each stone chosen to match its neighbour for cut and color. The clasp is worked to sit flat and disappear.',
        status: 'active',
        productType: 'Bracelets',
        vendor: 'Vérane',
        tags: ['bracelet', 'diamond', 'gold', 'high-jewellery'],
        categoryHandles: ['bracelets'],
        collectionHandles: ['new-arrivals', 'high-jewellery'],
        seoTitle: 'Colette Tennis Bracelet — white-diamond line bracelet',
        seoDescription: 'An 18k gold tennis bracelet of hand-matched white diamonds with a flat, hidden clasp.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'An unbroken line of hand-matched white diamonds, each grain-set into an articulated 18k gold rail that flexes with the wrist. The box clasp is worked flush and fitted with a safety catch, so it sits flat and all but disappears.',
            fit: 'Cut to drape rather than grip; we size each bracelet to the wrist on commission, with a half-link either way for the season. The clasp doubles with a hidden figure-eight for security.',
            care: 'Rinse in warm water with a soft brush to keep the stones lively, and store it apart from harder pieces so nothing marks the gold. Every setting is checked and re-tightened by the atelier for the life of the bracelet.',
            materials: [
                { name: '18k gold rail', percent: '62%' },
                { name: 'White diamonds', percent: '38%' },
            ],
            origin: 'Made in France',
        },
        variants: [
            { sku: 'VER-COLETTE', priceCents: money(6800), isDefault: true, inventoryPolicy: 'continue' },
        ],
        images: [{ assetId: 'colette-tennis-bracelet', isPrimary: true, alt: 'The Colette Tennis Bracelet' }],
    },
    {
        handle: 'vesper-drop-earrings',
        title: 'Vesper Drop Earrings',
        description:
            'A pair of long drops pairing polished onyx with warm 18k gold — quiet by day, and exactly enough after dark. Weighted so they hang true and sit close to the jaw.',
        status: 'active',
        productType: 'Earrings',
        vendor: 'Vérane',
        tags: ['earrings', 'onyx', 'gold', 'fine-jewellery'],
        categoryHandles: ['earrings'],
        collectionHandles: ['high-jewellery'],
        seoTitle: 'Vesper Drop Earrings — onyx and 18k gold drops',
        seoDescription: 'A pair of onyx-and-gold drop earrings, weighted to hang true against the jaw.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'Polished onyx drops hung from warm 18k gold, weighted low so they fall true and sit close to the jaw. Posts and backs are solid gold; the join is pivoted so each drop swings a little as you move.',
            fit: 'Long enough to read after dark, light enough to wear through dinner; for pierced ears, with a secure friction back. They sit just below the lobe, against the line of the jaw.',
            care: 'Wipe the gold and the stone with a dry, soft cloth; onyx dislikes solvents and perfume, so dress and scent first and put these on last. The atelier re-polishes the gold and re-seats a loosened stone whenever needed.',
            materials: [
                { name: '18k gold', percent: '70%' },
                { name: 'Onyx', percent: '30%' },
            ],
            origin: 'Made in France',
        },
        variants: [
            { sku: 'VER-VESPER', priceCents: money(1150), isDefault: true, inventoryPolicy: 'continue' },
        ],
        images: [{ assetId: 'vesper-drop-earrings', isPrimary: true, alt: 'The Vesper Drop Earrings' }],
    },
    {
        handle: 'lune-pendant-necklace',
        title: 'Lune Pendant Necklace',
        description:
            'A single 18k gold disc on a fine chain, brushed on one face and polished on the other so it catches the light as you move. Chosen in two lengths to sit at the collarbone or below.',
        status: 'active',
        productType: 'Necklaces',
        vendor: 'Vérane',
        tags: ['necklace', 'pendant', 'gold', 'everyday'],
        categoryHandles: ['necklaces'],
        collectionHandles: ['new-arrivals', 'everyday-fine'],
        seoTitle: 'Lune Pendant Necklace — 18k gold disc pendant',
        seoDescription: 'A brushed-and-polished 18k gold disc pendant on a fine chain, in two lengths.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'A single 18k gold disc, brushed on one face and mirror-polished on the other so it catches the light differently as it turns, hung from a fine cable chain on a discreet spring clasp.',
            fit: 'Offered in two lengths, to sit at the collarbone or just below; the disc lies flat against the skin and layers cleanly under a heavier chain.',
            care: 'A soft cloth brings the polished face back after wear; keep it clasped and hung so the fine chain never knots. Gold does not tarnish, so it asks for little more than the occasional wipe.',
            materials: [{ name: '18k gold', percent: '100%' }],
            origin: 'Made in France',
        },
        options: [
            { name: 'Chain length', displayType: 'dropdown', values: [{ value: '40cm' }, { value: '45cm' }] },
        ],
        variants: [
            { sku: 'VER-LUNE-40', priceCents: money(980), isDefault: true, inventoryPolicy: 'continue', optionValues: { 'Chain length': '40cm' } },
            { sku: 'VER-LUNE-45', priceCents: money(1020), inventoryPolicy: 'continue', optionValues: { 'Chain length': '45cm' } },
        ],
        images: [{ assetId: 'lune-pendant-necklace', isPrimary: true, alt: 'The Lune Pendant Necklace' }],
    },
    {
        handle: 'odette-pave-band',
        title: 'Odette Pavé Band',
        description:
            'A slim platinum band set edge to edge with pavé diamonds, low enough to stack or to wear alone. Each stone is grain-set by hand so the line reads as one bright ribbon.',
        status: 'active',
        productType: 'Rings',
        vendor: 'Vérane',
        tags: ['ring', 'band', 'platinum', 'diamond', 'high-jewellery'],
        categoryHandles: ['rings'],
        collectionHandles: ['high-jewellery', 'the-gift-edit'],
        seoTitle: 'Odette Pavé Band — platinum pavé-diamond band',
        seoDescription: 'A slim platinum band grain-set edge to edge with pavé diamonds.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'A slim platinum band grain-set edge to edge with pavé diamonds, each stone raised by hand so the line reads as one continuous ribbon of light. Platinum for its weight, and for the way it refuses to wear thin.',
            fit: 'Low enough in profile to stack or to wear alone; sized true, and best sized precisely — a fully-set band cannot be resized without lifting and re-setting the stones.',
            care: 'Warm water and a soft brush behind the stones keeps the pavé bright — hand cream and dust dull it faster than anything. The atelier checks every grain and re-tightens the setting for life.',
            materials: [
                { name: 'Platinum', percent: '85%' },
                { name: 'Pavé diamonds', percent: '15%' },
            ],
            origin: 'Made in France',
        },
        options: [
            { name: 'Ring size', displayType: 'dropdown', values: [{ value: '52' }, { value: '54' }] },
        ],
        variants: [
            { sku: 'VER-ODETTE-52', priceCents: money(2400), isDefault: true, inventoryPolicy: 'continue', optionValues: { 'Ring size': '52' } },
            { sku: 'VER-ODETTE-54', priceCents: money(2400), inventoryPolicy: 'continue', optionValues: { 'Ring size': '54' } },
        ],
        images: [{ assetId: 'odette-pave-band', isPrimary: true, alt: 'The Odette Pavé Band' }],
    },
    {
        handle: 'margaux-hoop-earrings',
        title: 'Margaux Hoop Earrings',
        description:
            'A pair of mid-weight hoops in brushed 18k gold, sized to clear the earlobe and turn without catching. The everyday hoop, made properly — solid, not hollow, and balanced to stay put.',
        status: 'active',
        productType: 'Earrings',
        vendor: 'Vérane',
        tags: ['earrings', 'hoop', 'gold', 'everyday'],
        categoryHandles: ['earrings'],
        collectionHandles: ['everyday-fine'],
        seoTitle: 'Margaux Hoop Earrings — brushed 18k gold hoops',
        seoDescription: 'A pair of solid brushed-gold hoop earrings, balanced to sit and turn cleanly.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'Solid 18k gold hoops — not hollow tube — brushed to a soft matte that hides the marks of daily wear, on a hinged click closure that seats with a positive snap.',
            fit: 'A mid-weight, mid-size hoop, sized to clear the lobe and turn without catching, and balanced so it hangs level rather than tipping forward. For pierced ears.',
            care: 'The brushed finish is forgiving — a dry cloth is usually enough, and the atelier can re-brush or re-polish the surface to your preference. Store the pair clasped so the hinge stays true.',
            materials: [{ name: '18k gold', percent: '100%' }],
            origin: 'Made in France',
        },
        variants: [
            { sku: 'VER-MARGAUX', priceCents: money(720), isDefault: true, inventoryPolicy: 'continue' },
        ],
        images: [{ assetId: 'margaux-hoop-earrings', isPrimary: true, alt: 'The Margaux Hoop Earrings' }],
    },
    {
        handle: 'celeste-cuff',
        title: 'Céleste Cuff',
        description:
            'A single-piece cuff in high-polished silver, formed to sit close and open just enough to slip on. Substantial without weight, and made to take a lifetime of small marks into a soft patina.',
        status: 'active',
        productType: 'Bracelets',
        vendor: 'Vérane',
        tags: ['bracelet', 'cuff', 'silver', 'everyday'],
        categoryHandles: ['bracelets'],
        collectionHandles: ['everyday-fine'],
        seoTitle: 'Céleste Cuff — high-polished silver cuff',
        seoDescription: 'A single-piece high-polished silver cuff, formed to sit close and slip on.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'Formed from a single piece of high-polished sterling silver, shaped to sit close to the wrist with an opening just wide enough to slip on. Substantial in the hand without the dead weight of a solid bangle.',
            fit: 'An open cuff that eases on over the wrist bone and can be gently adjusted by hand; offered in three sizes to sit snug rather than loose. Wear it high on the forearm or low at the wrist.',
            care: 'Silver lives — worn often it stays bright; left in a drawer it softens to a patina you can either keep or lift with a silver cloth. The atelier will re-polish it back to a mirror whenever you like.',
            materials: [
                { name: 'Sterling silver', percent: '92.5%' },
                { name: 'Fine copper', percent: '7.5%' },
            ],
            origin: 'Made in Italy',
        },
        options: [
            { name: 'Size', displayType: 'dropdown', values: [{ value: 'Small' }, { value: 'Medium' }, { value: 'Large' }] },
        ],
        variants: [
            { sku: 'VER-CELESTE-S', priceCents: money(890), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: 'Small' } },
            { sku: 'VER-CELESTE-M', priceCents: money(890), inventoryPolicy: 'continue', optionValues: { Size: 'Medium' } },
            { sku: 'VER-CELESTE-L', priceCents: money(890), inventoryPolicy: 'continue', optionValues: { Size: 'Large' } },
        ],
        images: [{ assetId: 'celeste-cuff', isPrimary: true, alt: 'The Céleste Cuff' }],
    },
    {
        handle: 'no1-fig-neroli',
        title: 'Nº1 Fig & Neroli',
        description:
            'The house’s opening scent — green fig softened by neroli and a warm cedar base. Bright at first, then quiet and skin-close for hours. An eau de parfum, composed in small batches.',
        status: 'active',
        productType: 'Fragrance',
        vendor: 'Vérane',
        tags: ['fragrance', 'eau-de-parfum', 'fig', 'neroli'],
        categoryHandles: ['fragrance'],
        collectionHandles: ['fragrance'],
        seoTitle: 'Nº1 Fig & Neroli — eau de parfum',
        seoDescription: 'A green fig and neroli eau de parfum on a warm cedar base, in 50ml and 100ml.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'An eau de parfum built on green fig, softened with neroli and set on a warm cedar base — composed in small batches and left to marry before it is bottled. Bright at the top, quiet and skin-close as it settles.',
            fit: 'Wears soft and close rather than loud; a pulse at the wrist and the throat carries through a day. Brightest in the first hour, then a warm second skin.',
            care: SCENT_CARE,
            materials: [
                { name: 'Alcohol base', percent: '82%' },
                { name: 'Fig & neroli accord', percent: '14%' },
                { name: 'Cedar & musk', percent: '4%' },
            ],
            origin: 'Made in Grasse, France',
        },
        options: [
            { name: 'Size', displayType: 'dropdown', values: [{ value: '50ml' }, { value: '100ml' }] },
        ],
        variants: [
            { sku: 'VER-NO1-50', priceCents: money(180), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: '50ml' } },
            { sku: 'VER-NO1-100', priceCents: money(260), inventoryPolicy: 'continue', optionValues: { Size: '100ml' } },
        ],
        images: [{ assetId: 'no1-fig-neroli', isPrimary: true, alt: 'Nº1 Fig & Neroli eau de parfum' }],
    },
    {
        handle: 'no2-iris-ambrette',
        title: 'Nº2 Iris & Ambrette',
        description:
            'Powdery iris drawn out with ambrette seed and a breath of musk — soft, cool and quietly expensive. The house’s most-worn scent, and the hardest to name on someone else.',
        status: 'active',
        productType: 'Fragrance',
        vendor: 'Vérane',
        tags: ['fragrance', 'eau-de-parfum', 'iris', 'musk'],
        categoryHandles: ['fragrance'],
        collectionHandles: ['fragrance'],
        seoTitle: 'Nº2 Iris & Ambrette — eau de parfum',
        seoDescription: 'A powdery iris and ambrette-seed eau de parfum with a soft musk, in 50ml and 100ml.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'An eau de parfum that draws powdery iris out with ambrette seed and a breath of musk — cool, soft and quietly expensive. The most-worn scent in the house, and the hardest to place on someone else.',
            fit: 'Sits close to the skin and stays soft all day — never a scent that fills a room. A single application at the pulse points lasts, and it layers well over Nº1.',
            care: SCENT_CARE,
            materials: [
                { name: 'Alcohol base', percent: '81%' },
                { name: 'Iris & ambrette accord', percent: '15%' },
                { name: 'Musk', percent: '4%' },
            ],
            origin: 'Made in Grasse, France',
        },
        options: [
            { name: 'Size', displayType: 'dropdown', values: [{ value: '50ml' }, { value: '100ml' }] },
        ],
        variants: [
            { sku: 'VER-NO2-50', priceCents: money(180), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: '50ml' } },
            { sku: 'VER-NO2-100', priceCents: money(260), inventoryPolicy: 'continue', optionValues: { Size: '100ml' } },
        ],
        images: [{ assetId: 'no2-iris-ambrette', isPrimary: true, alt: 'Nº2 Iris & Ambrette eau de parfum' }],
    },
    {
        handle: 'no3-black-rose-oud',
        title: 'Nº3 Black Rose & Oud',
        description:
            'The evening scent — dark rose over real oud and a resinous amber. Warm, dense and made to be noticed at close range. The one the atelier is asked about most.',
        status: 'active',
        productType: 'Fragrance',
        vendor: 'Vérane',
        tags: ['fragrance', 'eau-de-parfum', 'rose', 'oud'],
        categoryHandles: ['fragrance'],
        collectionHandles: ['fragrance', 'new-arrivals'],
        seoTitle: 'Nº3 Black Rose & Oud — eau de parfum',
        seoDescription: 'A dark-rose and oud eau de parfum on a resinous amber base, in 50ml and 100ml.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'The evening eau — a dark rose laid over real oud and a resinous amber, composed at a higher concentration so it holds warm and dense at close range. The scent the atelier is asked about most.',
            fit: 'Made to be noticed at close range rather than across a room; a little carries a long way. One pulse at the throat is plenty for an evening.',
            care: SCENT_CARE,
            materials: [
                { name: 'Alcohol base', percent: '78%' },
                { name: 'Rose & oud accord', percent: '18%' },
                { name: 'Amber', percent: '4%' },
            ],
            origin: 'Made in Grasse, France',
        },
        options: [
            { name: 'Size', displayType: 'dropdown', values: [{ value: '50ml' }, { value: '100ml' }] },
        ],
        variants: [
            { sku: 'VER-NO3-50', priceCents: money(180), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: '50ml' } },
            { sku: 'VER-NO3-100', priceCents: money(260), inventoryPolicy: 'continue', optionValues: { Size: '100ml' } },
        ],
        images: [{ assetId: 'no3-black-rose-oud', isPrimary: true, alt: 'Nº3 Black Rose & Oud eau de parfum' }],
    },
    {
        handle: 'no4-bergamot-vetiver',
        title: 'Nº4 Bergamot & Vetiver',
        description:
            'Cool bergamot over smoky vetiver and a clean woody dry-down — the house’s sharpest, most unisex scent. Crisp in the morning, and still there, softened, by evening.',
        status: 'active',
        productType: 'Fragrance',
        vendor: 'Vérane',
        tags: ['fragrance', 'eau-de-parfum', 'bergamot', 'vetiver'],
        categoryHandles: ['fragrance'],
        collectionHandles: ['fragrance'],
        seoTitle: 'Nº4 Bergamot & Vetiver — eau de parfum',
        seoDescription: 'A bergamot and smoky-vetiver eau de parfum with a clean woody dry-down, in 50ml and 100ml.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'Cool bergamot over smoky vetiver on a clean woody dry-down — the sharpest and most unisex of the four. Crisp on application, and still there, softened, by evening.',
            fit: 'The most versatile of the eaux — bright enough for the morning, settled enough for the night, and easy on close company. A pulse at each wrist carries the day.',
            care: SCENT_CARE,
            materials: [
                { name: 'Alcohol base', percent: '83%' },
                { name: 'Bergamot & vetiver accord', percent: '13%' },
                { name: 'Woods', percent: '4%' },
            ],
            origin: 'Made in Grasse, France',
        },
        options: [
            { name: 'Size', displayType: 'dropdown', values: [{ value: '50ml' }, { value: '100ml' }] },
        ],
        variants: [
            { sku: 'VER-NO4-50', priceCents: money(180), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: '50ml' } },
            { sku: 'VER-NO4-100', priceCents: money(260), inventoryPolicy: 'continue', optionValues: { Size: '100ml' } },
        ],
        images: [{ assetId: 'no4-bergamot-vetiver', isPrimary: true, alt: 'Nº4 Bergamot & Vetiver eau de parfum' }],
    },
    {
        handle: 'the-four-eaux-discovery-set',
        title: 'The Four Eaux — Discovery Set',
        description:
            'All four house scents in 2ml travel vials, boxed together — the honest way to find yours before committing to a bottle. The set’s value is redeemable against any full-size eau.',
        status: 'active',
        productType: 'Fragrance',
        vendor: 'Vérane',
        tags: ['fragrance', 'discovery-set', 'gift', 'sampler'],
        categoryHandles: ['fragrance'],
        collectionHandles: ['fragrance', 'new-arrivals', 'the-gift-edit'],
        seoTitle: 'The Four Eaux — Vérane fragrance discovery set',
        seoDescription: 'All four Vérane eaux de parfum in 2ml vials, redeemable against a full-size bottle.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'All four house eaux — Nº1 through Nº4 — decanted into 2ml travel vials and boxed together, drawn from the same small batches as the full bottles. The honest way to live with each scent before choosing.',
            fit: 'A week with a single vial tells you far more than any note list; wear one at a time, on skin, across a full day. Its value is redeemable against any full-size bottle.',
            care: SCENT_CARE,
            materials: [
                { name: 'Alcohol base', percent: '80%' },
                { name: 'The four house accords', percent: '18%' },
                { name: 'Musk & wood bases', percent: '2%' },
            ],
            origin: 'Made in Grasse, France',
        },
        variants: [
            { sku: 'VER-DISCOVERY', priceCents: money(95), isDefault: true, inventoryPolicy: 'continue' },
        ],
        images: [{ assetId: 'discovery-set', isPrimary: true, alt: 'The Four Eaux Discovery Set' }],
    },
];

const COMMERCE = {
    categories: [
        { handle: 'rings', name: 'Rings', description: 'Signets, bands and stacking rings.', featured: true },
        { handle: 'necklaces', name: 'Necklaces', description: 'Pendants and chains in fine gold.', featured: true },
        { handle: 'earrings', name: 'Earrings', description: 'Hoops, studs and drops.', featured: true },
        { handle: 'bracelets', name: 'Bracelets', description: 'Cuffs and line bracelets.', featured: false },
        { handle: 'fragrance', name: 'Fragrance', description: 'The house eaux de parfum.', featured: true },
    ],
    collections: [
        {
            handle: 'new-arrivals',
            name: 'New Arrivals',
            description: 'The latest from the atelier.',
            type: 'manual',
            featured: true,
            productHandles: [
                'astrid-signet-ring',
                'colette-tennis-bracelet',
                'lune-pendant-necklace',
                'no3-black-rose-oud',
                'the-four-eaux-discovery-set',
            ],
        },
        {
            handle: 'high-jewellery',
            name: 'High Jewellery',
            description: 'The pieces we make a few of a year.',
            type: 'manual',
            featured: false,
            productHandles: ['colette-tennis-bracelet', 'odette-pave-band', 'vesper-drop-earrings', 'astrid-signet-ring'],
        },
        {
            handle: 'everyday-fine',
            name: 'Everyday Fine',
            description: 'Fine gold and silver for every day.',
            type: 'manual',
            featured: false,
            productHandles: ['lune-pendant-necklace', 'margaux-hoop-earrings', 'celeste-cuff'],
        },
        {
            handle: 'fragrance',
            name: 'Fragrance',
            description: 'The four house eaux and the discovery set.',
            type: 'manual',
            featured: false,
            productHandles: [
                'no1-fig-neroli',
                'no2-iris-ambrette',
                'no3-black-rose-oud',
                'no4-bergamot-vetiver',
                'the-four-eaux-discovery-set',
            ],
        },
        {
            handle: 'the-gift-edit',
            name: 'The Gift Edit',
            description: 'A short list, chosen to give.',
            type: 'manual',
            featured: false,
            productHandles: ['odette-pave-band', 'the-four-eaux-discovery-set', 'margaux-hoop-earrings'],
        },
    ],
    products: PRODUCTS,
};

// ── Content (The Vérane Journal) ─────────────────────────────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });

const CONTENT = [
    {
        typeKey: 'blog_post',
        slug: 'winter-high-jewellery',
        status: 'published',
        body: {
            title: 'The Winter High Jewellery',
            excerpt: 'A first look at this winter’s numbered pieces — where the stones came from, and why there are so few of them.',
            featuredImage: { $asset: 'post-winter-high-jewellery' },
            body: {
                type: 'doc',
                content: [
                    para('A high-jewellery run begins with the stones, not the drawings. We buy a small parcel, lay it out under a north light, and see what it wants to become — which is why we can never tell you in advance exactly how many pieces a season will hold.'),
                    h2('Matched by eye, set by hand'),
                    para('Every stone in a Colette bracelet is chosen against its neighbours for cut and color, then grain-set by one setter from end to end. A machine could set faster; it could not match the line the way an eye does, and the line is the whole point.'),
                    h2('Few by necessity'),
                    para('When one person answers for every setting, the numbers stay small on their own. We would rather make twelve pieces we can stand behind for a lifetime than a hundred we cannot, and the winter run is exactly that: few, and finished properly.'),
                    para('Each piece leaves the atelier numbered, with a note of where its principal stone was cut. That note is not marketing — it is the reason to buy the real thing.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'the-making-of-no3',
        status: 'published',
        body: {
            title: 'The making of Nº3 Black Rose & Oud',
            excerpt: 'How the house’s evening scent came together — real oud, a dark rose, and eighteen months of getting the balance wrong.',
            featuredImage: { $asset: 'post-making-no3' },
            body: {
                type: 'doc',
                content: [
                    para('Nº3 took the longest of the four to settle. Oud is a difficult material — powerful, unpredictable, and expensive enough that every trial batch is a real decision — and pairing it with a rose dark enough to hold its own without turning to jam took most of two years.'),
                    h2('Composed in small litres'),
                    para('We compose in small quantities, let each version rest, and wear it for a week before changing a single note. A scent behaves differently on skin an hour in than it does on a blotter, and the only honest test is time.'),
                    h2('Why it costs what it costs'),
                    para('Real oud, a natural rose absolute and an amber base are what make Nº3 warm and dense rather than sharp and loud. There is no cheaper way to that particular warmth, so we did not look for one.'),
                    para('If you are not sure it is you, start with the discovery set. A week with a 2ml vial will tell you more than any description we could write.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'as-composed-by-the-founder',
        status: 'published',
        body: {
            title: 'As composed by the founder',
            excerpt: 'The pieces our founder wears every day, and the single rule behind the whole house: buy less, choose better, keep it for good.',
            featuredImage: { $asset: 'post-founder' },
            body: {
                type: 'doc',
                content: [
                    para('People ask which piece to start with, and the honest answer is: the one you will actually wear. A signet worn every day is worth more than a necklace kept in a box for occasions that never quite arrive.'),
                    h2('One good thing at a time'),
                    para('The house was built on a plain idea — buy less, choose better, and keep it for good. A collection assembled slowly, around a few pieces worth keeping, reads as yours in a way a whole set bought at once never will.'),
                    h2('Made to be lived in'),
                    para('Fine jewellery is not fragile. Gold takes a scratch and polishes back; silver softens into a patina; a good stone has survived far worse than a dinner table. Wear it. That is what it is for.'),
                    para('When you are ready, come to the atelier. We would rather help you choose one piece you will keep than sell you three you will not.'),
                ],
            },
        },
    },
];

// ── Product detail (the couture PDP) + Shop ──────────────────────────────────────
// Victoria Beckham's PDP is magazine-calm: a large product image on a warm off-white
// ground on the left, a quiet sticky buy-box on the right — breadcrumb, SERIF title,
// SERIF price, one black CTA, then DESCRIPTION / MATERIALS & CARE / DELIVERY accordions
// (DESIGN §5.4 / §6 / §7). Ported to Vérane's `maison` theme, held to its verbatim
// restraint: pure black on white, one classical serif carrying everything, ZERO radius
// (square image, hairline `base-300` divider — no `rounded-*`, no shadow), the warm stone
// `base-200` ground for the image, and `btn-primary` as the pure-black #000 fill the VB
// `SELECT SIZE` calls for. The detail stack is stacked (not tabbed) so it reads without
// JavaScript. Bound fields come from the shared PDP kit (correct `repeat('product')` scope
// + `item.*` binds); the layout + static brand copy are ours.

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the large square product image on the warm stone ground. Right: the calm serif buy
 *  column. Magazine-quiet, maison-restraint. */
function pdpBuyRegion(): Node {
    return el('section', 'bg-base-100 @container px-6 py-12 @3xl:py-20', {
        children: [
            el('div', 'mx-auto grid w-full max-w-6xl gap-10 @3xl:grid-cols-2 @3xl:gap-16', {
                children: [
                    // The large square image (one bound primary — the storefront fills it per product).
                    // Zero radius + a single hairline border on the warm stone ground, matching the VB
                    // off-white product plate exactly. NAMED utilities only so it survives the stamp.
                    pdpImage('aspect-square w-full border border-base-300 bg-base-200 object-cover'),
                    // The calm serif buy column.
                    el('div', 'flex flex-col gap-6 @3xl:py-2', {
                        children: [
                            el('div', 'flex flex-col gap-3', {
                                children: [
                                    // Breadcrumb/house label above the title — the VB `HOME › …` slot, here the
                                    // maison name in the whisper sans register. A plain <p>, so the product title
                                    // stays the page's one <h1>.
                                    el('p', 'text-xs font-medium uppercase tracking-widest text-base-content', {
                                        text: 'Vérane — the maison',
                                    }),
                                    pdpTitle(
                                        'h1',
                                        'text-4xl font-medium leading-tight tracking-tight text-base-content @3xl:text-5xl'
                                    ),
                                    pdpPriceRow({
                                        priceClass: 'text-2xl font-medium text-base-content',
                                        compareClass: 'text-lg text-base-content line-through',
                                        rowClass: 'flex items-baseline gap-4',
                                    }),
                                    // A quiet low-stock signal, in the maison's whisper register (bordered, zero
                                    // radius) — shown only when the routed piece is genuinely running low, never
                                    // fabricated scarcity.
                                    pdpStockBadge({
                                        className:
                                            'inline-flex w-fit items-center gap-2 border border-base-300 px-3 py-1 text-xs font-medium uppercase tracking-widest text-base-content',
                                        label: 'Low stock',
                                    }),
                                ],
                            }),
                            pdpDescription('text-lg leading-relaxed text-base-content'),
                            // Qty + Add to cart — the pure-black #000 CTA (btn-primary in `maison`, white ink
                            // by construction). The real cart form from the kit, never hand-rolled.
                            addToCartForm(),
                            // The piece's OWN typed attributes (fabric / fit / care / materials / origin),
                            // repeated from `attributeSections` — real per-product copy, not a hardcoded stack.
                            pdpAttributes({
                                containerClass: 'mt-2 flex flex-col gap-5',
                                sectionClass: 'flex flex-col gap-3 border-t border-base-300 pt-5',
                                labelTag: 'h2',
                                labelClass: 'text-xs font-medium uppercase tracking-widest text-base-content',
                                valueClass: 'text-base leading-relaxed text-base-content',
                                rowClass:
                                    'flex items-baseline justify-between gap-4 border-b border-base-200 pb-1',
                                rowLabelClass: 'text-base font-medium text-base-content',
                                rowValueClass: 'text-base text-base-content',
                            }),
                            // Delivery & returns — LINKS to the maison's real legal pages, never reprinted copy.
                            pdpPolicyLinks({
                                className:
                                    'flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-base-300 pt-5 text-xs font-medium uppercase tracking-widest text-base-content',
                                linkClass: 'underline underline-offset-4',
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });
}

/** The full couture PDP — the buy region above a quiet cross-sell carousel of same-collection
 *  pieces (`commerce.related`, the shared kit's default), retitled to the maison voice. */
const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'To be worn together' });

/** The Shop page's own editorial header, shown ABOVE the faceted catalogue core the harness
 *  appends. A CENTERED serif-italic display title + a single quiet intro line — the VB PLP
 *  framing ("New Season Arrivals" + centered intro), in place of the generic listing chrome.
 *  The filter/sort bar and product grid are added beneath by the harness. */
const SHOP: Node[] = [
    el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
        children: [
            el('div', 'mx-auto flex w-full max-w-3xl flex-col items-center gap-5 text-center', {
                children: [
                    el(
                        'h1',
                        'text-4xl font-medium italic leading-tight tracking-tight text-base-content @3xl:text-6xl',
                        { text: 'The full collection' }
                    ),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Everything Vérane currently makes — fine jewellery in gold, platinum and hand-selected stones, and the four house eaux de parfum. Cut and composed in small numbers, and made to be kept.',
                    }),
                ],
            }),
        ],
    }),
];

// ── The remaining functional pages (bespoke framing over the shared cores) ───────
// Collections / Cart / Search each get Vérane's own centered serif masthead above the
// pinned, shoppable core the harness appends; the Journal index gets its own masthead
// over the shared linkable post grid. Same maison restraint as the rest of the site —
// pure black on white, one classical serif, a centred column, zero chrome.

/** A plain centred maison masthead — an `<h1>` + one intro line on the white ground, in
 *  the VB centered-serif register. Used for Collections / Search / Journal, which each want
 *  a quiet header over their core. NAMED utilities only so it survives the stamp. */
function pageMasthead(heading: string, lead: string): Node {
    return el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
        children: [
            el('div', 'mx-auto flex w-full max-w-3xl flex-col items-center gap-5 text-center', {
                children: [
                    el(
                        'h1',
                        'text-4xl font-medium leading-tight tracking-tight text-base-content @3xl:text-6xl',
                        { text: heading }
                    ),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', { text: lead }),
                ],
            }),
        ],
    });
}

const COLLECTIONS: Node[] = [
    pageMasthead(
        'The collections',
        'The house in three registers — the numbered high jewellery we make a few of a year, the fine gold and silver made for every day, and the four house eaux de parfum. Begin wherever you are dressing.'
    ),
];

const SEARCH: Node[] = [
    pageMasthead(
        'Search the maison',
        'Looking for a particular piece — a stone, a metal, a scent you were once given? Search the whole collection and the Journal below.'
    ),
];

const JOURNAL: Node[] = [
    pageMasthead(
        'The Vérane Journal',
        'Notes from the atelier — where the stones are cut, how a fragrance is composed, and the plain idea behind the whole house: buy less, choose better, keep it for a lifetime.'
    ),
];

/** The Cart page's own header — a quiet reassurance band above the pinned cart core, in
 *  place of the generic "Your cart" heading. Insured worldwide shipping, thirty-day unworn
 *  returns and the sealed-fragrance rule: the three things a fine-jewellery buyer wants to
 *  read before they check out, in the maison's centered serif register. */
const CART: Node[] = [
    el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
        children: [
            el('div', 'mx-auto flex w-full max-w-3xl flex-col items-center gap-5 text-center', {
                children: [
                    el(
                        'h1',
                        'text-4xl font-medium leading-tight tracking-tight text-base-content @3xl:text-5xl',
                        { text: 'Your cart' }
                    ),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Every piece is packed in the house box and fully insured in transit, with complimentary shipping worldwide. You have thirty days to return anything unworn for a full refund; fragrance can be returned only while sealed, and engraved or bespoke commissions are made to your mark and final. Take your time deciding.',
                    }),
                ],
            }),
        ],
    }),
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
    slug: 'couture-serif',
    key: 'sparx-couture-serif',
    name: 'Couture Serif',
    summary:
        'A high-fashion luxury-serif storefront where restraint is the premium — a centered-overlay campaign hero over collection tiles, a featured carousel and an editorial lookbook, all pure black on white in a classical serif. Modelled on the couture-serif archetype; shipped as Vérane, a fine-jewellery & fragrance maison.',
    tagline: 'A stark, serif-everything luxury template for jewellers, perfumers and fashion houses.',
    vertical: 'retail',
    industry: 'Fine jewellery & fragrance',
    requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
    sortWeight: 70,
    brand: {
        businessName: 'Vérane',
        tagline: 'Cut and composed in small numbers.',
    },
    // Victoria Beckham chrome: a CENTERED serif wordmark with a minimal nav either side
    // (`centerLogo`), NO loud filled CTA in the bar (`showCta: false` — restraint is the
    // signal), and the "Enjoy 10% off" newsletter footer (`newsletter`) whose bottom bar
    // carries the live © business name.
    chrome: { navbar: 'centerLogo', footer: 'newsletter', showCta: false },
    seo: {
        home: {
            title: 'Vérane — fine jewellery & fragrance',
            description:
                'Vérane is a fine jewellery and fragrance maison — pieces cut and composed in small numbers, made to be worn every day and kept for a lifetime.',
        },
        about: {
            title: 'About Vérane — the maison',
            description:
                'The maison behind Vérane — how each piece of jewellery and every fragrance is made in small numbers, by the hands that designed it.',
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

    // Oracle 3 — a self-contained home-page preview for visual review.
    const { path: previewPath } = await writeTemplatePreview(SPEC, theme);
    console.log(`· preview → ${previewPath}`);
}

main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
});
