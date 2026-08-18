// sparx-bold-athletic — a reference-driven SITE TEMPLATE (docs/templates/gymshark).
//
// Gymshark translated to sparx: a bold-athletic DTC storefront — big confident photo
// hero, drop-culture merchandising rhythm, power category tiles, high-energy ride
// imagery — ported to an endurance cycling-apparel label, Threshold, "Kit built for the
// long road". The home page is the Gymshark rhythm — a full-bleed hero, then a repeating
// editorial-band → shoppable-carousel cycle, a signature power-tiles grid, and a
// ride-shot strip — dressed in the bespoke `velodrome` theme (dark mono chrome, near-
// white paper content bands, ONE hi-vis chartreuse accent held to a single loud action).
//
// This file is JUST the SPEC; the composition + emission live in the shared
// `template-sites/harness.ts`, which the other nine templates reuse. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-template-bold-athletic.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-bold-athletic/**" \
//     "marketplace-catalog/_gen/gen-template-bold-athletic.ts"
//   pnpm --filter @wizeworks/api-rest marketplace:self-register
//
// WHY RELATIVE IMPORTS — see the harness header (marketplace-catalog has no node_modules).

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
    el,
    type Node,
} from '../../wizeworks/packages/silica-catalog/node_modules/@wizeworks/silicaui-html/dist/index.js';
import { productsBlock } from '../../wizeworks/packages/silica-catalog/src/commerce';
import { sectionHead } from '../../wizeworks/packages/silica-catalog/src/sections/_shell';
import { newsletterSignup } from '../../wizeworks/packages/silica-catalog/src/sections/convert';
import { safeParseBlueprint } from '../../wizeworks/packages/blueprints/src/validate';

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
// hero / editorial-band / tile / ride-strip photos are TREE imagery, so they hot-link
// the same URL inline (docs/54 §6) — they still appear in `assets` as the single
// documented registry of the bundle's imagery + alt text.
const U = (id: string): string => `https://images.unsplash.com/photo-${id}?w=1400&q=80`;

const IMG = {
    // Products
    enduranceBib: '1541625602330-2277a4c46182',
    raceBib: '1534787238916-9ba6764efd4f',
    climbersJersey: '1517649763962-0c623066013b',
    aeroJersey: '1631276893368-554b60393efb',
    thermalJersey: '1615387362883-bc09da7b4c0c',
    meshBase: '1536244955395-0b8a2a5ab5df',
    merinoBase: '1605235185711-bf04486a4720',
    windGilet: '1622456149571-44563067b5d7',
    rainJacket: '1628440167042-197d8eb88929',
    thermalGloves: '1574965234283-2f20a4cffa43',
    raceSocks: '1605050825077-289f85b6cf43',
    cottonCap: '1516147697747-02adcafd3fda',
    // Journal posts
    postTraining: '1444491741275-3747c53c99b4',
    postKit: '1531502774286-5e4e8e94879f',
    postRide: '1471506480208-91b3a4cc78be',
    // Hero + editorial bands (tree imagery)
    hero: '1695238070098-83d6775247a7',
    bandBib: '1528629297340-d1d466945dc5',
    bandCold: '1601625193660-86f2807b024b',
    // Ride strip
    ride1: '1534146789009-76ed5060ec70',
    ride2: '1576435728678-68d0fbf94e91',
    ride3: '1572717051745-383d107c2a16',
    ride4: '1600403477955-2b8c2cfab221',
} as const;

interface Asset {
    id: string;
    url: string;
    alt: string;
}

const ASSETS: Asset[] = [
    { id: 'endurance-bib-short', url: U(IMG.enduranceBib), alt: 'A rider climbing on the road in bib shorts' },
    { id: 'race-bib-short', url: U(IMG.raceBib), alt: 'A cyclist out of the saddle sprinting' },
    { id: 'climbers-jersey', url: U(IMG.climbersJersey), alt: 'A cyclist on a mountain pass in a lightweight jersey' },
    { id: 'aero-jersey', url: U(IMG.aeroJersey), alt: 'A rider tucked low in an aero jersey' },
    { id: 'thermal-jersey', url: U(IMG.thermalJersey), alt: 'A cyclist riding in cold, low winter light' },
    { id: 'mesh-base-layer', url: U(IMG.meshBase), alt: 'A cyclist in a lightweight mesh base layer' },
    { id: 'merino-base-layer', url: U(IMG.merinoBase), alt: 'A rider layered up against the cold' },
    { id: 'wind-gilet', url: U(IMG.windGilet), alt: 'A cyclist wearing a packable wind gilet' },
    { id: 'stormshell-rain-jacket', url: U(IMG.rainJacket), alt: 'A rider in a rain shell on a wet road' },
    { id: 'thermal-gloves', url: U(IMG.thermalGloves), alt: "A cyclist's gloved hands on the bars" },
    { id: 'race-socks', url: U(IMG.raceSocks), alt: 'Cycling socks and shoes clipped in' },
    { id: 'cotton-cap', url: U(IMG.cottonCap), alt: 'A rider in a cotton cycling cap' },
    { id: 'post-training', url: U(IMG.postTraining), alt: 'A cyclist on a long solo training ride' },
    { id: 'post-kit', url: U(IMG.postKit), alt: 'Cycling kit laid out and ready' },
    { id: 'post-ride', url: U(IMG.postRide), alt: 'An open road climbing into the hills' },
    { id: 'hero-home', url: U(IMG.hero), alt: 'A rider on an empty mountain road at first light' },
    { id: 'band-bib', url: U(IMG.bandBib), alt: 'A close crop of a rider seated in the drops' },
    { id: 'band-cold', url: U(IMG.bandCold), alt: 'A cyclist riding through cold, grey weather' },
    { id: 'ride-1', url: U(IMG.ride1), alt: 'A group ride strung out along the road' },
    { id: 'ride-2', url: U(IMG.ride2), alt: 'A rider on gravel at the edge of the light' },
    { id: 'ride-3', url: U(IMG.ride3), alt: 'A cyclist cresting a climb' },
    { id: 'ride-4', url: U(IMG.ride4), alt: 'A long descent opening out below' },
];

const assetUrl = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-bold-athletic: unknown asset "${id}"`);
    return a.url;
};

// ── Home page sections (the Gymshark sequence) ───────────────────────────────────

/** The full-bleed hero — one photograph filling the width, the headline and two actions
 *  in a solid readable panel over it (the `hero_overlay` shape). The ONE loud action on
 *  the page is the hi-vis accent button; the second is a quiet outline. Tenant content,
 *  so it hot-links a real photograph; every class is a NAMED utility so it survives the
 *  stamp into the tenant's stored tree. */
function hero(): Node {
    return el('section', 'relative @container overflow-hidden bg-base-200', {
        children: [
            // Gymshark leads with a muted autoplay film, not a still — so Threshold's hero is a
            // ride clip behind the readable panel, with the still as the poster (shown until the
            // video decodes, and kept if it never plays / reduced motion is preferred).
            videoBackdrop({
                src: '/video/tpl-bold-athletic.mp4',
                poster: assetUrl('hero-home'),
                posterAlt: 'A rider on an empty mountain road at first light',
            }),
            el(
                'div',
                'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
                {
                    children: [
                        el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
                            children: [
                                el(
                                    'h1',
                                    'text-4xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-6xl',
                                    { text: 'Kit built for the long road' }
                                ),
                                el('p', 'text-lg leading-relaxed text-base-content', {
                                    text: 'Threshold makes endurance cycling kit for the riders who are still out when everyone else has turned for home — bibs, jerseys and shells tested over real distance, in real weather, and made to hold up ride after ride.',
                                }),
                                el('div', 'flex flex-wrap items-center gap-3', {
                                    children: [
                                        el('a', 'btn btn-accent btn-lg', {
                                            attrs: { href: '/shop' },
                                            text: 'Shop the new season',
                                        }),
                                        el('a', 'btn btn-neutral btn-outline btn-lg', {
                                            attrs: { href: '/journal' },
                                            text: 'Read the Journal',
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

/** A mid-page editorial band — a full-bleed photograph carrying a range's intro and a
 *  quiet text link into the shop (the `picture_band` shape). Same overlay-panel shape as
 *  the hero so the words stay readable over whatever photo sits behind them. */
function editorialBand(o: {
    heading: string;
    lead: string;
    assetId: string;
    alt: string;
    cta: string;
    href: string;
}): Node {
    return el('section', 'relative @container overflow-hidden bg-base-200', {
        children: [
            el('img', 'absolute inset-0 h-full w-full object-cover', {
                attrs: { src: assetUrl(o.assetId), alt: o.alt, loading: 'lazy' },
            }),
            el(
                'div',
                'relative mx-auto flex w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-16 @3xl:px-10 @3xl:py-24',
                {
                    children: [
                        el('div', 'flex max-w-xl flex-col gap-4 rounded-box bg-base-100 p-8 @3xl:p-10', {
                            children: [
                                el('h2', 'text-3xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-4xl', {
                                    text: o.heading,
                                }),
                                el('p', 'text-lg leading-relaxed text-base-content', { text: o.lead }),
                                el('a', 'font-semibold text-base-content underline underline-offset-4', {
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

/** The signature power-tiles grid — four full-bleed category tiles a visitor taps
 *  straight into a discipline (the Gymshark "FAVORITES" band). Each tile is the link:
 *  a photo with a solid near-black label bar pinned to the bottom, so the label reads
 *  clean over any image. Named utilities throughout. */
function powerTiles(): Node {
    const tile = (assetId: string, label: string, href: string, alt: string): Node =>
        el('a', 'group relative flex aspect-square flex-col overflow-hidden rounded-box', {
            attrs: { href },
            children: [
                el('img', 'absolute inset-0 h-full w-full object-cover', {
                    attrs: { src: assetUrl(assetId), alt, loading: 'lazy' },
                }),
                el('div', 'relative mt-auto w-full bg-primary px-4 py-3', {
                    children: [
                        el('span', 'text-lg font-bold uppercase tracking-tight text-primary-content', { text: label }),
                    ],
                }),
            ],
        });
    return el('section', 'bg-base-100 @container px-6 py-16', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-10', {
                children: [
                    sectionHead(
                        'Shop by discipline',
                        'Whatever the ride asks of you — a long climb, a fast bunch, a cold dawn — start with the kit built for it.'
                    ),
                    el('div', 'grid grid-cols-2 gap-6 @2xl:grid-cols-4', {
                        children: [
                            tile('endurance-bib-short', 'Bib shorts', '/shop', 'A rider climbing on the road in bib shorts'),
                            tile('climbers-jersey', 'Jerseys', '/shop', 'A cyclist on a mountain pass in a lightweight jersey'),
                            tile('merino-base-layer', 'Base layers', '/shop', 'A rider layered up against the cold'),
                            tile('band-cold', 'Cold weather', '/shop', 'A cyclist riding through cold, grey weather'),
                        ],
                    }),
                ],
            }),
        ],
    });
}

/** The "From the road" strip — a row of ride photographs a visitor scrolls through (the
 *  `gallery_strip` shape). CSS-only snap scroll, named utilities throughout. */
function rideStrip(): Node {
    const shot = (assetId: string, title: string, alt: string): Node =>
        el('figure', 'flex w-72 shrink-0 snap-start flex-col gap-3', {
            children: [
                el('img', 'aspect-video w-full rounded-box border border-base-300 bg-base-200 object-cover', {
                    attrs: { src: assetUrl(assetId), alt, loading: 'lazy' },
                }),
                el('figcaption', 'text-base font-semibold text-base-content', { text: title }),
            ],
        });
    return el('section', 'bg-base-100 @container px-6 py-16', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-10', {
                children: [
                    sectionHead(
                        'From the road',
                        'Kit gets tested where it gets ridden. A few frames from the rides that shaped this season.'
                    ),
                    el('div', 'flex snap-x gap-6 overflow-x-auto pb-4', {
                        children: [
                            shot('ride-1', 'The Saturday bunch', 'A group ride strung out along the road'),
                            shot('ride-2', 'Off the tarmac', 'A rider on gravel at the edge of the light'),
                            shot('ride-3', 'Over the top', 'A cyclist cresting a climb'),
                            shot('ride-4', 'The long way down', 'A long descent opening out below'),
                        ],
                    }),
                ],
            }),
        ],
    });
}

const HOME: Node[] = [
    hero(),
    productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'New this season' }),
    editorialBand({
        heading: 'It starts with the bib',
        lead: 'A century is decided from the waist down. Our bibs run a seamless multi-panel chamois and a bracing straps-and-mesh upper, so hour six feels like hour one — the single piece of kit worth getting right first.',
        assetId: 'band-bib',
        alt: 'A close crop of a rider seated in the drops',
        cta: 'Shop bib shorts',
        href: '/shop',
    }),
    productsBlock({ source: 'commerce.category.bib-shorts', layout: 'carousel', heading: 'Bib shorts' }),
    powerTiles(),
    editorialBand({
        heading: 'When the weather turns',
        lead: 'The season does not stop because it got cold and wet. Thermal jerseys, a packable wind gilet and a proper storm shell — the layers that keep you riding through the months most riders sit out.',
        assetId: 'band-cold',
        alt: 'A cyclist riding through cold, grey weather',
        cta: 'Shop cold weather',
        href: '/shop',
    }),
    productsBlock({ source: 'commerce.category.cold-weather', layout: 'carousel', heading: 'Cold weather' }),
    rideStrip(),
    // footer is `columns` (not `newsletter`), so the page carries its own "join the list"
    // capture — a real submitting form, not a decorative one.
    newsletterSignup(),
];

// ── About + Contact (Threshold-voiced) ───────────────────────────────────────────

const ABOUT: Node[] = [
    el('section', 'bg-base-100 @container px-6 py-20', {
        children: [
            el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-6', {
                children: [
                    el('h1', 'text-4xl font-bold uppercase tracking-tight text-base-content @2xl:text-5xl', {
                        text: 'About Threshold',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'Threshold started with a simple complaint: too much cycling kit is designed for the photo and not the ride. It looks fast in the shop and falls apart at the point where a ride actually gets hard — the seam that chafes at hour four, the shell that wets out in the first real downpour, the chamois that gives up before you do.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'So we build the other way round. Every piece is ridden long and hard before it ships — over passes, through winters, deep into the kind of distance where cheap kit shows its true colors. If it does not hold up out there, it does not get made. That is the whole standard, and it is not negotiable.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'We are a small team of riders making kit for other riders. No sponsored pros, no seasonal churn for its own sake — just gear built to earn its place in your kit bag and stay there for years.',
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
        heading: 'Talk to us',
        intro: 'Sizing question, a fault, or you just want to know how a piece holds up over a long winter? A real rider on the team reads every message and answers straight — no script, no runaround.',
        submitLabel: 'Email the team',
    }),
];

// ── Commerce (Threshold — 12 SKUs) ───────────────────────────────────────────────

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
    // The typed product type (docs/143) — every product here is `apparel`, so the PDP's
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

// Care copy shared across the whole range — genuinely the same for every technical
// cycling garment here, so it lives once (per-product fabric/fit/origin still differ).
const TECH_CARE =
    'Machine wash cold on a gentle cycle, inside out, with like colors; hang to dry. No fabric softener — it clogs the wicking — and no tumble dryer, which cooks the elastane and the chamois. Looked after, this rides hard for years.';
// A windproof/waterproof shell wants different care — heat and softeners kill the DWR.
const SHELL_CARE =
    'Machine wash warm on a gentle cycle, zipped up, with like colors; hang to dry. No fabric softener or tumble dryer — both strip the water-repellent finish. Reproof occasionally to keep water beading off rather than soaking in.';

const money = (dollars: number): number => Math.round(dollars * 100);

// Apparel sizes as one declared option + a SKU per size — DRY, so the six-size ladder
// stays one source of truth instead of twelve hand-typed variant rows per product.
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
function sizeOption(values: readonly string[] = SIZES): OptionDecl {
    return { name: 'Size', displayType: 'dropdown', values: values.map((v) => ({ value: v })) };
}
function sizeVariants(
    skuPrefix: string,
    dollars: number,
    values: readonly string[] = SIZES,
    defaultValue = 'M'
): Variant[] {
    return values.map((v) => ({
        sku: `${skuPrefix}-${v}`,
        priceCents: money(dollars),
        ...(v === defaultValue ? { isDefault: true as const } : {}),
        inventoryPolicy: 'continue' as const,
        optionValues: { Size: v },
    }));
}

const PRODUCTS: Product[] = [
    {
        handle: 'endurance-bib-short',
        title: 'Endurance Bib Short',
        description:
            'The bib built for the sixth hour. A seamless, multi-density chamois carries you through a full day in the saddle, and a lightweight bracing upper with a mesh back holds the pad exactly where it should be without ever digging in. Compressive Italian fabric, laser-cut grippers, and flatlock seams placed where your legs never meet the frame.',
        status: 'active',
        productType: 'Bib Shorts',
        vendor: 'Threshold',
        tags: ['bib-shorts', 'endurance-fit', 'chamois', 'road'],
        categoryHandles: ['bib-shorts'],
        collectionHandles: ['new-in', 'bib-shorts'],
        seoTitle: 'Endurance Bib Short — all-day cycling bib shorts',
        seoDescription: 'A multi-density seamless chamois and compressive Italian fabric, built for all-day endurance rides.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'A compressive Italian-milled Lycra body over a seamless, multi-density chamois — denser under the sit bones, softer at the edges — carried on a bracing mesh upper so the pad never shifts. Flatlock seams throughout, placed off every contact point.',
            fit: 'Endurance fit: supportive without race compression, with a higher back and a wide, flat leg gripper for time in the saddle. True to size; between sizes, size up for all-day comfort.',
            care: TECH_CARE,
            materials: [
                { name: 'Italian Lycra', percent: '80%' },
                { name: 'Elastane', percent: '20%' },
            ],
            origin: 'Made in Italy',
        },
        options: [sizeOption()],
        variants: sizeVariants('THR-BIB-END', 180),
        images: [{ assetId: 'endurance-bib-short', isPrimary: true, alt: 'The Endurance Bib Short' }],
    },
    {
        handle: 'race-bib-short',
        title: 'Race Bib Short',
        description:
            'When the ride turns into a race. A thinner, faster chamois and a second-skin compressive fit put everything into the pedals — cut close, held tight, and finished with a wide power band that stays put through a full-gas sprint. For the days you are riding to win the sign, not just to finish.',
        status: 'active',
        productType: 'Bib Shorts',
        vendor: 'Threshold',
        tags: ['bib-shorts', 'race-fit', 'compressive', 'road'],
        categoryHandles: ['bib-shorts'],
        collectionHandles: ['bib-shorts'],
        seoTitle: 'Race Bib Short — compressive race-fit cycling bibs',
        seoDescription: 'A fast, thin chamois in a second-skin compressive cut for race-day riding.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'A second-skin compressive weave over a thin, fast race chamois, finished with a wide silicone power band. Every panel is cut close and bonded flat so nothing bags, rolls or robs a watt.',
            fit: 'Race fit: aggressive and body-hugging, short at the front and long at the back for the drops. Between sizes, size down.',
            care: TECH_CARE,
            materials: [
                { name: 'Compressive nylon', percent: '78%' },
                { name: 'Elastane', percent: '22%' },
            ],
            origin: 'Made in Italy',
        },
        options: [sizeOption()],
        variants: sizeVariants('THR-BIB-RACE', 220),
        images: [{ assetId: 'race-bib-short', isPrimary: true, alt: 'The Race Bib Short' }],
    },
    {
        handle: 'climbers-jersey',
        title: "Climber's Jersey",
        description:
            'The lightest jersey we make, for the days the road only goes up. An airy open-knit body dumps heat on a long climb, three deep pockets swallow a full day of food, and a half-length zip lets you dial the airflow as the gradient bites. Barely there on the back, exactly there when the sun is on you.',
        status: 'active',
        productType: 'Jerseys',
        vendor: 'Threshold',
        tags: ['jersey', 'lightweight', 'climbing', 'summer'],
        categoryHandles: ['jerseys'],
        collectionHandles: ['jerseys'],
        seoTitle: "Climber's Jersey — ultralight summer cycling jersey",
        seoDescription: 'An ultralight open-knit cycling jersey with three deep pockets, built for long summer climbs.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'An ultralight open-knit polyester body that dumps heat on a climb, a half-length front zip to dial the airflow, and three deep drop-in pockets plus a zipped valuables pocket for a full day of food.',
            fit: 'Climbing fit: close through the body without race compression, so it still breathes on a long ascent. True to size.',
            care: TECH_CARE,
            materials: [
                { name: 'Recycled polyester', percent: '88%' },
                { name: 'Elastane', percent: '12%' },
            ],
            origin: 'Made in Portugal',
        },
        options: [sizeOption()],
        variants: sizeVariants('THR-JER-CLM', 140),
        images: [{ assetId: 'climbers-jersey', isPrimary: true, alt: "The Climber's Jersey" }],
    },
    {
        handle: 'aero-jersey',
        title: 'Aero Jersey',
        description:
            'A jersey cut to disappear in the wind. A race-close body, bonded seams and textured sleeve panels shave watts where they hide, while a gripper hem keeps it locked down in the drops. Fast enough for the bunch, comfortable enough to wear all day getting there.',
        status: 'active',
        productType: 'Jerseys',
        vendor: 'Threshold',
        tags: ['jersey', 'aero', 'race-fit', 'road'],
        categoryHandles: ['jerseys'],
        collectionHandles: ['new-in', 'jerseys'],
        seoTitle: 'Aero Jersey — race-fit aerodynamic cycling jersey',
        seoDescription: 'A race-close aero cycling jersey with bonded seams and textured sleeve panels.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'A race-close body in a slick low-drag weave with textured sleeve panels that trip the airflow, bonded seams throughout and a silicone gripper hem that locks it down in the drops.',
            fit: 'Aero race fit: very close, cut for the riding position rather than the coffee stop. Between sizes, size down.',
            care: TECH_CARE,
            materials: [
                { name: 'Polyamide', percent: '82%' },
                { name: 'Elastane', percent: '18%' },
            ],
            origin: 'Made in Italy',
        },
        options: [sizeOption()],
        variants: sizeVariants('THR-JER-AERO', 160),
        images: [{ assetId: 'aero-jersey', isPrimary: true, alt: 'The Aero Jersey' }],
    },
    {
        handle: 'thermal-jersey',
        title: 'Thermal Roubaix Jersey',
        description:
            'A brushed-back thermal jersey for the cold, dry days that make winter riding worth it. A deep pile inner traps warmth without the bulk of a jacket, a tall zip guard keeps the wind off your throat, and a dropped tail covers you in the drops. The jersey that turns three-season riding into four.',
        status: 'active',
        productType: 'Jerseys',
        vendor: 'Threshold',
        tags: ['jersey', 'thermal', 'winter', 'cold-weather'],
        categoryHandles: ['jerseys', 'cold-weather'],
        collectionHandles: ['jerseys', 'cold-weather'],
        seoTitle: 'Thermal Roubaix Jersey — brushed thermal winter cycling jersey',
        seoDescription: 'A brushed-back thermal cycling jersey with a tall zip guard, built for cold, dry winter rides.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'A brushed-back Roubaix thermal fabric with a deep, warm pile inner, a tall fleece-lined zip guard that keeps the wind off your throat and a dropped tail for coverage in the drops.',
            fit: 'Winter fit: room for a base layer underneath without bulk. True to size; size up if you layer heavily.',
            care: TECH_CARE,
            materials: [
                { name: 'Brushed polyester', percent: '86%' },
                { name: 'Elastane', percent: '14%' },
            ],
            origin: 'Made in Portugal',
        },
        options: [sizeOption()],
        variants: sizeVariants('THR-JER-THM', 175),
        images: [{ assetId: 'thermal-jersey', isPrimary: true, alt: 'The Thermal Roubaix Jersey' }],
    },
    {
        handle: 'mesh-base-layer',
        title: 'Mesh Base Layer',
        description:
            'The layer that does the quiet work. A featherweight open mesh sits between you and your jersey and moves sweat off your skin before it can chill you — barely there in summer, essential the moment the pace drops on a descent. Wear it under everything, feel it on nothing.',
        status: 'active',
        productType: 'Base Layers',
        vendor: 'Threshold',
        tags: ['base-layer', 'mesh', 'summer', 'wicking'],
        categoryHandles: ['base-layers'],
        collectionHandles: [],
        seoTitle: 'Mesh Base Layer — lightweight wicking cycling base layer',
        seoDescription: 'A featherweight open-mesh cycling base layer that moves sweat off the skin fast.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'A featherweight open-mesh knit that lifts sweat off the skin and hands it to your jersey, with flatlock seams so nothing rubs under a race fit.',
            fit: 'Second-skin fit — it should sit snug against the skin to wick properly. True to size.',
            care: TECH_CARE,
            materials: [{ name: 'Polypropylene', percent: '100%' }],
            origin: 'Made in Italy',
        },
        options: [sizeOption()],
        variants: sizeVariants('THR-BASE-MSH', 55),
        images: [{ assetId: 'mesh-base-layer', isPrimary: true, alt: 'The Mesh Base Layer' }],
    },
    {
        handle: 'merino-base-layer',
        title: 'Merino Long-Sleeve Base',
        description:
            'Winter warmth that regulates itself. A fine merino blend holds heat when you are soft-pedalling and sheds it when you go hard, resists odour over back-to-back days, and stays warm even when it is damp. The base layer that makes a cold ride feel like a choice, not a sentence.',
        status: 'active',
        productType: 'Base Layers',
        vendor: 'Threshold',
        tags: ['base-layer', 'merino', 'winter', 'cold-weather'],
        categoryHandles: ['base-layers', 'cold-weather'],
        collectionHandles: ['new-in', 'cold-weather'],
        seoTitle: 'Merino Long-Sleeve Base — winter merino cycling base layer',
        seoDescription: 'A fine merino long-sleeve cycling base layer that regulates heat and resists odour.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'A fine merino-blend long-sleeve knit that holds heat when you soft-pedal and sheds it when you go hard, resists odour over back-to-back days and stays warm even when it is damp.',
            fit: 'Close winter base fit, long in the sleeve and body so it stays tucked. True to size.',
            care: 'Machine wash cold on the wool cycle, inside out; reshape and dry flat. No fabric softener, no tumble dryer — heat felts merino. Air between rides and it needs washing far less than you think.',
            materials: [
                { name: 'Merino wool', percent: '62%' },
                { name: 'Polyester', percent: '33%' },
                { name: 'Elastane', percent: '5%' },
            ],
            origin: 'Made in Italy',
        },
        options: [sizeOption()],
        variants: sizeVariants('THR-BASE-MER', 95),
        images: [{ assetId: 'merino-base-layer', isPrimary: true, alt: 'The Merino Long-Sleeve Base' }],
    },
    {
        handle: 'wind-gilet',
        title: 'Featherweight Wind Gilet',
        description:
            'The insurance that lives in your pocket. A whisper-thin windproof front knocks the chill off a fast descent and a cold start, while a mesh back stops you cooking on the way back up. Packs down to the size of a gel, weighs almost nothing, and saves more rides than any other piece you own.',
        status: 'active',
        productType: 'Gilets',
        vendor: 'Threshold',
        tags: ['gilet', 'windproof', 'packable', 'cold-weather'],
        categoryHandles: ['cold-weather'],
        collectionHandles: ['new-in', 'cold-weather'],
        seoTitle: 'Featherweight Wind Gilet — packable windproof cycling gilet',
        seoDescription: 'A whisper-thin packable windproof cycling gilet with a breathable mesh back.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'A whisper-thin windproof ripstop front with a breathable mesh back, a full zip with a chin guard, and a rear pocket it packs down into — smaller than a gel.',
            fit: 'Close over a jersey, cut to layer without flapping at speed. True to size.',
            care: SHELL_CARE,
            materials: [{ name: 'Ripstop nylon', percent: '100%' }],
            origin: 'Made in Vietnam',
        },
        options: [sizeOption()],
        variants: sizeVariants('THR-GIL-WND', 130),
        images: [{ assetId: 'wind-gilet', isPrimary: true, alt: 'The Featherweight Wind Gilet' }],
    },
    {
        handle: 'stormshell-rain-jacket',
        title: 'Stormshell Rain Jacket',
        description:
            'Built for the ride you would rather not do. A genuinely waterproof, genuinely breathable three-layer shell with taped seams, a storm flap over the zip and a dropped tail keeps the weather out for hours, not minutes — then packs away small when the sky clears. The jacket that decides you are going, whatever it is doing outside.',
        status: 'active',
        productType: 'Jackets',
        vendor: 'Threshold',
        tags: ['jacket', 'waterproof', 'rain', 'cold-weather'],
        categoryHandles: ['cold-weather'],
        collectionHandles: ['cold-weather'],
        seoTitle: 'Stormshell Rain Jacket — waterproof breathable cycling shell',
        seoDescription: 'A taped-seam three-layer waterproof, breathable cycling rain jacket that packs away small.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'A genuinely waterproof, genuinely breathable three-layer laminate shell with fully taped seams, a storm flap over the zip, a dropped tail and a packable rear pocket.',
            fit: 'Race-cut shell, close enough to layer over a jersey without billowing in a crosswind. True to size.',
            care: SHELL_CARE,
            materials: [{ name: '3-layer waterproof laminate', percent: '100%' }],
            origin: 'Made in Vietnam',
        },
        options: [sizeOption()],
        variants: sizeVariants('THR-JKT-STM', 240),
        images: [{ assetId: 'stormshell-rain-jacket', isPrimary: true, alt: 'The Stormshell Rain Jacket' }],
    },
    {
        handle: 'thermal-gloves',
        title: 'Long-Finger Thermal Gloves',
        description:
            'Warm hands, working fingers. A wind-blocking back and a brushed lining keep the cold out down to freezing, while a thin, tacky palm keeps you in full control of the bars and the levers — no fumbling for the shifter, no numb fingers on a long descent. A soft thumb panel for the one job every rider needs it for.',
        status: 'active',
        productType: 'Gloves',
        vendor: 'Threshold',
        tags: ['gloves', 'thermal', 'winter', 'cold-weather'],
        categoryHandles: ['accessories', 'cold-weather'],
        collectionHandles: ['cold-weather', 'accessories'],
        seoTitle: 'Long-Finger Thermal Gloves — winter cycling gloves',
        seoDescription: 'Wind-blocking brushed-lined long-finger cycling gloves with a tacky, dexterous palm.',
        options: [sizeOption(['S', 'M', 'L', 'XL'])],
        variants: sizeVariants('THR-GLV-THM', 60, ['S', 'M', 'L', 'XL']),
        images: [{ assetId: 'thermal-gloves', isPrimary: true, alt: 'The Long-Finger Thermal Gloves' }],
    },
    {
        handle: 'race-socks',
        title: 'Aero Race Socks',
        description:
            'The last watt is at your ankle. A tall, sheer aero cuff and a compressive fit keep the airflow clean and your legs feeling fresh, while a cushioned sole and a mesh instep handle the sweat. Fast, loud when you want them to be, and the easiest upgrade in cycling.',
        status: 'active',
        productType: 'Socks',
        vendor: 'Threshold',
        tags: ['socks', 'aero', 'race', 'accessories'],
        categoryHandles: ['accessories'],
        collectionHandles: ['new-in', 'accessories'],
        seoTitle: 'Aero Race Socks — tall aero cycling socks',
        seoDescription: 'Tall, compressive aero cycling socks with a cushioned sole and breathable mesh instep.',
        options: [
            { name: 'Color', displayType: 'swatch', values: [{ value: 'Black' }, { value: 'White' }, { value: 'Hi-Vis' }] },
        ],
        variants: [
            { sku: 'THR-SCK-BLK', priceCents: money(22), isDefault: true, inventoryPolicy: 'continue', optionValues: { Color: 'Black' } },
            { sku: 'THR-SCK-WHT', priceCents: money(22), inventoryPolicy: 'continue', optionValues: { Color: 'White' } },
            { sku: 'THR-SCK-HIV', priceCents: money(22), inventoryPolicy: 'continue', optionValues: { Color: 'Hi-Vis' } },
        ],
        images: [{ assetId: 'race-socks', isPrimary: true, alt: 'The Aero Race Socks' }],
    },
    {
        handle: 'cotton-cap',
        title: 'Cotton Cycling Cap',
        description:
            'The one that never goes out of fashion. A classic cotton cap sits under the helmet on a cold morning, flips its little brim up for the cafe stop, and keeps the rain and the sun out of your eyes on the road. Every rider owns one; the good ones own three.',
        status: 'active',
        productType: 'Caps',
        vendor: 'Threshold',
        tags: ['cap', 'cotton', 'classic', 'accessories'],
        categoryHandles: ['accessories'],
        collectionHandles: ['accessories'],
        seoTitle: 'Cotton Cycling Cap — classic under-helmet cycling cap',
        seoDescription: 'A classic cotton cycling cap for under the helmet, the cafe stop and the road.',
        options: [
            { name: 'Color', displayType: 'swatch', values: [{ value: 'Black' }, { value: 'White' }, { value: 'Hi-Vis' }] },
        ],
        variants: [
            { sku: 'THR-CAP-BLK', priceCents: money(28), isDefault: true, inventoryPolicy: 'continue', optionValues: { Color: 'Black' } },
            { sku: 'THR-CAP-WHT', priceCents: money(28), inventoryPolicy: 'continue', optionValues: { Color: 'White' } },
            { sku: 'THR-CAP-HIV', priceCents: money(28), inventoryPolicy: 'continue', optionValues: { Color: 'Hi-Vis' } },
        ],
        images: [{ assetId: 'cotton-cap', isPrimary: true, alt: 'The Cotton Cycling Cap' }],
    },
];

const COMMERCE = {
    categories: [
        { handle: 'bib-shorts', name: 'Bib Shorts', description: 'All-day and race-fit bibs.', featured: true },
        { handle: 'jerseys', name: 'Jerseys', description: 'From ultralight climbers to brushed thermals.', featured: true },
        { handle: 'base-layers', name: 'Base Layers', description: 'The quiet layer that regulates everything.', featured: false },
        { handle: 'cold-weather', name: 'Cold Weather', description: 'Gilets, shells and thermals for the off-season.', featured: true },
        { handle: 'accessories', name: 'Accessories', description: 'Socks, caps and gloves.', featured: false },
    ],
    collections: [
        {
            handle: 'new-in',
            name: 'New This Season',
            description: 'The latest kit off the test rides.',
            type: 'manual',
            featured: true,
            productHandles: ['endurance-bib-short', 'aero-jersey', 'wind-gilet', 'merino-base-layer', 'race-socks'],
        },
        {
            handle: 'bib-shorts',
            name: 'Bib Shorts',
            description: 'The single piece of kit worth getting right first.',
            type: 'manual',
            featured: false,
            productHandles: ['endurance-bib-short', 'race-bib-short'],
        },
        {
            handle: 'jerseys',
            name: 'Jerseys',
            description: 'A jersey for every temperature and every gradient.',
            type: 'manual',
            featured: false,
            productHandles: ['climbers-jersey', 'aero-jersey', 'thermal-jersey'],
        },
        {
            handle: 'cold-weather',
            name: 'Cold Weather',
            description: 'The layers that keep you riding through the off-season.',
            type: 'manual',
            featured: false,
            productHandles: ['thermal-jersey', 'merino-base-layer', 'wind-gilet', 'stormshell-rain-jacket', 'thermal-gloves'],
        },
        {
            handle: 'accessories',
            name: 'Accessories',
            description: 'The small upgrades that finish the kit.',
            type: 'manual',
            featured: false,
            productHandles: ['race-socks', 'cotton-cap', 'thermal-gloves'],
        },
    ],
    products: PRODUCTS,
};

// ── Content (the Threshold Journal) ──────────────────────────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });

const CONTENT = [
    {
        typeKey: 'blog_post',
        slug: 'how-to-actually-build-endurance',
        status: 'published',
        body: {
            title: 'How to actually build endurance',
            excerpt: 'There is no shortcut to a big day in the saddle, but there is a method. What actually moves the needle when you want to ride longer than you can now.',
            featuredImage: { $asset: 'post-training' },
            body: {
                type: 'doc',
                content: [
                    para('Endurance is not a talent you either have or you do not. It is a base you build, one unglamorous ride at a time — and the riders who go furthest are almost never the ones training hardest. They are the ones training most consistently.'),
                    h2('Most of your riding should feel easy'),
                    para('The single biggest mistake is riding every ride at the same medium-hard pace — too easy to be a real workout, too hard to actually recover. Slow most of your rides right down until you can hold a conversation, and save the genuinely hard efforts for one or two days a week. It feels wrong. It works.'),
                    h2('Add distance slowly, then hold it'),
                    para('Stretch your longest ride of the week by no more than ten to fifteen percent at a time, then sit at that distance for a couple of weeks before you reach again. The body adapts to a load it sees repeatedly, not to a single heroic effort that leaves you wrecked for a week.'),
                    para('Do that patiently through a winter and the century that feels impossible in March is a good day out by June. No shortcut, just the long way — which, on a bike, is the only way there is.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'dressing-for-the-cold-and-wet',
        status: 'published',
        body: {
            title: 'Dressing for the cold and wet',
            excerpt: 'Winter riding is a layering problem, not a toughness problem. Get the system right and the months everyone else sits out become the best riding of the year.',
            featuredImage: { $asset: 'post-kit' },
            body: {
                type: 'doc',
                content: [
                    para('Nobody quits winter riding because they are not hard enough. They quit because they were cold and wet and miserable, and they were cold and wet and miserable because they dressed wrong. Layering is a skill, and it is a learnable one.'),
                    h2('Dress for the middle of the ride'),
                    para('If you are warm in the car park, you are overdressed. You will warm up within ten minutes and then spend the rest of the ride sweating into your layers, which is how you end up cold on the descents. Dress so the first ten minutes feel slightly too cold, and let the effort do the rest.'),
                    h2('Three layers, each doing one job'),
                    para('A base layer to move sweat off your skin, a thermal jersey to hold your warmth, and a windproof or waterproof shell to keep the weather out. Each layer has one job; add and shed them as the ride and the weather change, starting with the gilet that lives in your pocket for exactly this.'),
                    para('Get the system dialled and the cold stops being the reason you did not ride. It becomes the reason the road was empty and yours.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'notes-from-a-dawn-century',
        status: 'published',
        body: {
            title: 'Notes from a dawn century',
            excerpt: 'A hundred miles that started in the dark. Why the hardest rides to leave for are so often the ones you remember longest.',
            featuredImage: { $asset: 'post-ride' },
            body: {
                type: 'doc',
                content: [
                    para('The alarm goes at four and everything in you argues against it. The bed is warm, the road is cold, and the century you planned last week is a much better idea in the abstract than it is at four in the morning. You go anyway. You always half-regret it, and you never regret it once you are rolling.'),
                    h2('The first hour is a tax'),
                    para('The first hour of a big ride is always the worst — cold hands, stiff legs, a body asking what exactly it did to deserve this. Pay it. Ride steady, eat before you are hungry, drink before you are thirsty, and let the sun come up. Somewhere in the second hour the ride quietly hands you the day.'),
                    h2('The middle is the reward'),
                    para('There is a stretch of every long ride, usually far from anywhere, where it all comes good — the legs are open, the road is empty, and the noise in your head finally goes quiet. That is the bit you came for. That is the bit that gets you out of bed the next time the alarm goes at four.'),
                    para('You will not remember the ride you skipped. You will remember this one for years.'),
                ],
            },
        },
    },
];

// ── Product detail (the athletic PDP) + Shop ─────────────────────────────────────
// Gymshark's PDP is a confident two-column buy floor: a big on-body image on the left,
// a hard-working sticky buy-box on the right — uppercase title, fit, price, size grid and
// a full-width black ADD TO BAG, then the Designed-For / Description / Delivery detail
// stack (DESIGN §4/§6). Ported to Threshold: the same bold two-column split in the dark
// `velodrome` theme, where `btn-primary` is the near-black mono fill Gymshark's black CTA
// calls for and the labels ride Threshold's uppercase-condensed voice. Bound fields come
// from the shared PDP kit (correct `repeat('product')` scope + `item.*` binds); the layout
// + static performance copy are ours. Readable copy stays on `text-base-content` over the
// white content band — the hi-vis accent is held to the chrome + the buy button.

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the big on-body product image. Right: the bold, hard-working buy column. The detail
 *  stack is no longer hardcoded per template (a cap's care ≠ a jacket's care): `pdpAttributes`
 *  repeats the routed product's OWN typed attributes (docs/143), styled in the uppercase
 *  Threshold voice, and `pdpPolicyLinks` points at the real shipping/returns pages. */
function pdpBuyRegion(): Node {
    return el('section', 'bg-base-100 @container px-6 py-12 @3xl:py-16', {
        children: [
            el('div', 'mx-auto grid w-full max-w-6xl gap-10 @3xl:grid-cols-2 @3xl:gap-16', {
                children: [
                    // The big product image (one bound primary — the storefront fills it per product).
                    pdpImage(
                        'aspect-square w-full rounded-box border border-base-300 bg-base-200 object-cover'
                    ),
                    // The bold buy column.
                    el('div', 'flex flex-col gap-6 @3xl:py-4', {
                        children: [
                            el('div', 'flex flex-col gap-3', {
                                children: [
                                    // Category/brand label above the title — the Gymshark tag/fit slot. A plain
                                    // <p>, so the product title stays the page's one <h1>.
                                    el('p', 'text-sm font-bold uppercase tracking-widest text-base-content', {
                                        text: 'Threshold — race-tested kit',
                                    }),
                                    pdpTitle(
                                        'h1',
                                        'text-4xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-5xl'
                                    ),
                                    pdpPriceRow({
                                        priceClass: 'text-2xl font-bold text-base-content',
                                        compareClass: 'text-lg text-base-content line-through',
                                        rowClass: 'flex items-baseline gap-4',
                                    }),
                                    // A real low-stock signal, in the hi-vis accent — shown only when the
                                    // routed product is genuinely running low (never fabricated scarcity).
                                    pdpStockBadge({
                                        className:
                                            'inline-flex w-fit items-center gap-2 rounded-field bg-primary px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary-content',
                                        label: 'Low stock',
                                    }),
                                ],
                            }),
                            pdpDescription('text-lg leading-relaxed text-base-content'),
                            // Qty + Add to cart — the near-black mono CTA (btn-primary in `velodrome`).
                            addToCartForm(),
                            // The product's OWN typed attributes (fabric / fit / care / materials / origin),
                            // repeated from `attributeSections` — real per-product copy, not a hardcoded stack.
                            pdpAttributes({
                                containerClass: 'mt-2 flex flex-col gap-5',
                                sectionClass: 'flex flex-col gap-2 border-t border-base-300 pt-5',
                                labelTag: 'h2',
                                labelClass: 'text-sm font-bold uppercase tracking-widest text-base-content',
                                valueClass: 'text-base leading-relaxed text-base-content',
                                rowClass:
                                    'flex items-baseline justify-between gap-4 border-b border-base-200 pb-1',
                                rowLabelClass: 'text-base font-semibold text-base-content',
                                rowValueClass: 'text-base text-base-content',
                            }),
                            // Shipping & returns — LINKS to the store's real legal pages, never reprinted copy.
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

/** The full athletic PDP — the buy region above a "You might like too" carousel of
 *  same-collection kit (`commerce.related`, the shared kit's default cross-sell, and the
 *  exact heading the DESIGN §4 PDP anatomy names). */
const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'You might like too' });

/** The Shop page's own header, shown ABOVE the faceted catalogue core the harness appends.
 *  A bold dark entrance band — uppercase condensed title on the `velodrome` ink ground, one
 *  hard intro line — the strong, reversed framing Gymshark gives its listing, in place of the
 *  generic "Shop / Everything we currently have". `text-neutral-content` is the guaranteed
 *  readable ink for the `bg-neutral` fill, so the copy clears on the dark ground. */
const SHOP: Node[] = [
    el('section', 'bg-neutral @container px-6 pt-16 pb-12', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
                children: [
                    el(
                        'h1',
                        'text-4xl font-bold uppercase leading-none tracking-tight text-neutral-content @3xl:text-6xl',
                        { text: 'Shop the range' }
                    ),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-neutral-content', {
                        text: 'Every piece Threshold makes — bibs, jerseys, base layers, shells and the small kit that finishes the ride — filtered and sorted however you like. All of it tested over real distance, in real weather, and built to hold up ride after ride.',
                    }),
                ],
            }),
        ],
    }),
];

// ── The remaining functional pages (bespoke framing over the shared cores) ───────
// Collections / Cart / Search each get Threshold's own bold entrance band above the
// pinned, shoppable core the harness appends; the Journal index gets its own masthead over
// the shared linkable post grid. Same reversed `velodrome` ink ground as the Shop header, so
// the copy stays on the guaranteed-readable `bg-neutral` / `text-neutral-content` pairing and
// the hi-vis accent is left to the chrome. Uppercase-condensed, hard-riding voice throughout.

/** A bold dark page masthead — an uppercase `<h1>` + one hard intro line reversed out on the
 *  `velodrome` ink ground. Shared by Collections / Cart / Search / Journal, which each want a
 *  strong Threshold entrance over their pinned core. `text-neutral-content` is the guaranteed
 *  readable ink for the `bg-neutral` fill, so the copy always clears the dark band. */
function pageMasthead(heading: string, lead: string): Node {
    return el('section', 'bg-neutral @container px-6 pt-16 pb-12', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
                children: [
                    el(
                        'h1',
                        'text-4xl font-bold uppercase leading-none tracking-tight text-neutral-content @3xl:text-6xl',
                        { text: heading }
                    ),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-neutral-content', { text: lead }),
                ],
            }),
        ],
    });
}

const COLLECTIONS: Node[] = [
    pageMasthead(
        'Kit by discipline',
        'Bibs, jerseys, base layers, cold-weather kit and the small stuff that finishes the ride — grouped by the job it does, so you can kit up for the ride in front of you and not the one in the catalogue.'
    ),
];

const SEARCH: Node[] = [
    pageMasthead(
        'Find your kit',
        'Chasing something specific — a size, a fabric, the gilet that lives in your jersey pocket? Search the whole range and the Journal below and get straight to it.'
    ),
];

const JOURNAL: Node[] = [
    pageMasthead(
        'The Threshold Journal',
        'Training that actually moves the needle, kit that earns its place in the bag, and notes from the long rides that shape every season — written by riders, for riders.'
    ),
];

/** The Cart page's own header — a bold reassurance band above the pinned cart core, in place
 *  of the generic "Your cart" heading. Free tracked shipping, thirty-day returns and the
 *  ride-guarantee — the three things a rider wants to read before they check out, in the same
 *  words the PDP delivery block uses, so the promise stays consistent across the store. */
const CART: Node[] = [
    pageMasthead(
        'Your cart',
        'Free tracked shipping on orders over $75, dispatched within one business day. Thirty days to return anything unworn, with tags, for a full refund — and if a seam or a fabric ever fails in normal riding, we replace it. Kit that does not hold up does not get to wear our name.'
    ),
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
    slug: 'bold-athletic',
    key: 'sparx-bold-athletic',
    name: 'Bold Athletic',
    summary:
        'A bold-athletic DTC storefront for a performance apparel label — a confident full-bleed hero over a drop-culture rhythm of shoppable carousels, a signature power-tiles grid and a ride-shot strip, in a dark mono `velodrome` theme with one hi-vis accent. Modelled on the bold-athletic DTC archetype; shipped as Threshold, an endurance cycling-apparel label.',
    tagline: 'A bold, high-energy template for performance and athletic apparel brands.',
    vertical: 'retail',
    industry: 'Endurance cycling apparel',
    requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
    sortWeight: 90,
    brand: {
        businessName: 'Threshold',
        tagline: 'Kit built for the long road.',
    },
    // Gymshark chrome: a strong brand-left header with a filled SHOP call to action in the
    // bar (`brandLeft` + `showCta: true`), and the three-column footer with a legal bar
    // (`columns`) — so the home page carries its own newsletter capture (footer ≠ newsletter).
    chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
    seo: {
        home: {
            title: 'Threshold — endurance cycling kit for the long road',
            description:
                'Threshold makes endurance cycling kit — bibs, jerseys and shells tested over real distance, in real weather, and built to hold up ride after ride.',
        },
        about: {
            title: 'About Threshold',
            description:
                'The riders behind Threshold, and why we build endurance kit tested on the long road rather than the showroom floor.',
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
