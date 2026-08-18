// sparx-tech-cinematic — the tech/cinematic reference-driven site template
// (docs/templates/dji).
//
// DJI translated to sparx: a dark, spec-forward product storefront that sells an
// engineered object on capability, not lifestyle — ported to a premium-audio brand,
// Aphelion, "Sound, engineered." The home page is the DJI rhythm — a full-bleed
// cinematic dark hero, then a repeating capability-band → shoppable-carousel cycle down
// a genuinely dark page — dressed in the bespoke `flux` theme (true-dark ground in both
// modes, one electric-blue signal). The live video hero + spec-scrollytelling are a
// LATER behaviors phase; this ships the strong dark PHOTO hero + spec-highlight bands +
// product carousels, statically.
//
// This file is JUST the SPEC; the composition + emission live in the shared
// `template-sites/harness.ts`, which the other nine templates reuse. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-template-tech-cinematic.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-tech-cinematic/**" \
//     "marketplace-catalog/_gen/**/*.ts"
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
import {
    actions,
    body,
    card,
    cardTitle,
    gridFour,
    primaryAction,
    secondaryAction,
    section,
    sectionAlt,
    sectionHead,
    CARD,
} from '../../wizeworks/packages/silica-catalog/src/sections/_shell';
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
// hero / capability-band / scenario-strip photos are TREE imagery, so they hot-link the
// same URL inline (docs/54 §6) — they still appear in `assets` as the single documented
// registry of the bundle's imagery + alt text.
const U = (id: string): string => `https://images.unsplash.com/photo-${id}?w=1400&q=80`;

const IMG = {
    // Products
    one: '1505740420928-5e560c06d30e',
    oneWireless: '1618366712010-f4ae9c647dcb',
    budsPro: '1572569511254-d8f925fe2cbb',
    budsAir: '1606220588913-b3aacb4d2f46',
    monolith: '1531104985437-603d6490e6d4',
    field: '1608538770329-65941f62f9f8',
    pulse: '1557077316-a5212159d3bf',
    ridgeline: '1597183739841-5ca26ab0a604',
    cable: '1585605109191-03cc36051fcb',
    stand: '1585298723682-7115561c51b7',
    travelCase: '1600294037681-c80b4cb5b434',
    pads: '1577174881658-0f30ed549adc',
    // Journal posts
    postPlanar: '1583394838336-acd977736f90',
    postAnc: '1484704849700-f032a568e944',
    postMonolith: '1529911684551-bfe3a8553f19',
    // Hero + capability bands (tree imagery)
    hero: '1508700115892-45ecd05ae2ad',
    bandSound: '1550071781-e5560291f81c',
    bandEngineered: '1546435770-a3e426bf472b',
    bandRange: '1565828751789-6de4e57775d1',
    // Scenario strip
    sceneStudio: '1595432541891-a461100d3054',
    sceneCommute: '1497381446305-7445b7d4d5cd',
    sceneDesktop: '1590783609742-82564b33e5fd',
    sceneTravel: '1625786682948-2168238883d2',
} as const;

interface Asset {
    id: string;
    url: string;
    alt: string;
}

const ASSETS: Asset[] = [
    { id: 'aphelion-one', url: U(IMG.one), alt: 'Open-back over-ear headphones on a dark surface' },
    { id: 'aphelion-one-wireless', url: U(IMG.oneWireless), alt: 'Wireless over-ear headphones in low light' },
    { id: 'aphelion-buds-pro', url: U(IMG.budsPro), alt: 'True-wireless earbuds beside their charging case' },
    { id: 'aphelion-buds-air', url: U(IMG.budsAir), alt: 'A pair of true-wireless earbuds' },
    { id: 'aphelion-monolith', url: U(IMG.monolith), alt: 'A bookshelf speaker photographed against black' },
    { id: 'aphelion-field', url: U(IMG.field), alt: 'A portable Bluetooth speaker' },
    { id: 'aphelion-pulse', url: U(IMG.pulse), alt: 'A portable headphone amplifier with a machined dial' },
    { id: 'aphelion-ridgeline', url: U(IMG.ridgeline), alt: 'A slim soundbar beneath a screen' },
    { id: 'aphelion-cable', url: U(IMG.cable), alt: 'A braided audio cable coiled on a dark table' },
    { id: 'aphelion-stand', url: U(IMG.stand), alt: 'Headphones resting on an aluminium stand' },
    { id: 'aphelion-case', url: U(IMG.travelCase), alt: 'A hard travel case for earbuds' },
    { id: 'aphelion-pads', url: U(IMG.pads), alt: 'Replacement earpads, close up' },
    { id: 'post-planar', url: U(IMG.postPlanar), alt: 'The inside of a headphone earcup, close up' },
    { id: 'post-anc', url: U(IMG.postAnc), alt: 'Over-ear headphones lit against a dark ground' },
    { id: 'post-monolith', url: U(IMG.postMonolith), alt: 'A hi-fi listening setup at home' },
    { id: 'hero-home', url: U(IMG.hero), alt: 'A person listening in over-ear headphones, lit against the dark' },
    { id: 'band-sound', url: U(IMG.bandSound), alt: 'A dim room lit only by the glow of a stereo' },
    { id: 'band-engineered', url: U(IMG.bandEngineered), alt: 'A detailed view of a pair of headphones' },
    { id: 'band-range', url: U(IMG.bandRange), alt: 'A speaker filling a darkened room with sound' },
    { id: 'scene-studio', url: U(IMG.sceneStudio), alt: 'A studio desk with monitors and outboard gear' },
    { id: 'scene-commute', url: U(IMG.sceneCommute), alt: 'Listening on the move' },
    { id: 'scene-desktop', url: U(IMG.sceneDesktop), alt: 'A tidy desk with a DAC and headphones' },
    { id: 'scene-travel', url: U(IMG.sceneTravel), alt: 'Headphones packed for travel' },
];

const assetUrl = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-tech-cinematic: unknown asset "${id}"`);
    return a.url;
};

// ── Home page sections (the DJI cinematic sequence) ───────────────────────────────

/** The full-bleed cinematic hero — one photograph filling the width, the headline and
 *  two actions in a solid readable panel centered over it (the DJI "descriptor → name →
 *  tagline → dual CTA" stack). In the `flux` true-dark theme the `bg-base-100` panel is
 *  near-black with near-white ink, so it reads as the cinematic dark product hero. Tenant
 *  content, so it hot-links a real photograph; every class is a NAMED utility so it
 *  survives the stamp into the tenant's stored tree. */
function hero(): Node {
    return el('section', 'relative @container overflow-hidden bg-base-200', {
        children: [
            // DJI leads with cinematic motion, not a still — so Aphelion's hero runs a dark audio
            // clip behind the panel, the headphones still as poster (kept until it decodes, and if
            // it never plays / reduced motion is preferred).
            videoBackdrop({
                src: '/video/tpl-tech-cinematic.mp4',
                poster: assetUrl('hero-home'),
                posterAlt: 'A person listening in over-ear headphones, lit against the dark',
            }),
            el(
                'div',
                'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-center justify-center gap-6 px-6 py-24 @3xl:px-10 @3xl:py-32',
                {
                    children: [
                        el('div', 'flex max-w-2xl flex-col items-center gap-6 rounded-box bg-base-100 p-8 text-center @3xl:p-12', {
                            children: [
                                el(
                                    'h1',
                                    'text-4xl font-semibold leading-tight tracking-tight text-base-content @3xl:text-6xl',
                                    { text: 'Sound, engineered' }
                                ),
                                el('p', 'text-lg leading-relaxed text-base-content', {
                                    text: 'Reference headphones, earbuds and speakers built the way instruments are — measured, tuned, and finished by the people who designed them. Nothing added to the recording, and nothing taken away.',
                                }),
                                actions([
                                    primaryAction('Shop all audio', '/shop'),
                                    secondaryAction('The Signal Path', '/journal'),
                                ]),
                            ],
                        }),
                    ],
                }
            ),
        ],
    });
}

/** A cinematic capability band — a full-bleed photograph carrying one chapter of the
 *  story (the sound → how it is engineered → the range) with a quiet "read more" text
 *  link (the DJI full-bleed feature-band shape). */
function capabilityBand(o: {
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
                                el('h2', 'text-3xl font-semibold leading-tight text-base-content @3xl:text-4xl', {
                                    text: o.heading,
                                }),
                                el('p', 'text-lg leading-relaxed text-base-content', { text: o.lead }),
                                el('a', 'font-semibold text-primary underline underline-offset-4', {
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

/** The spec-highlight band — the DJI "icon + big value + grey descriptor" close,
 *  translated to value + label + a plain-language line so a non-technical shopper reads a
 *  benefit, not a datasheet. The values wear the electric-blue signal (`text-primary`),
 *  the one chromatic element on the dark page; everything else stays real ink. */
function specHighlights(): Node {
    const stat = (value: string, label: string, note: string): Node =>
        card(CARD, [
            el('p', 'text-3xl font-bold text-primary @3xl:text-4xl', { text: value }),
            cardTitle(label),
            body(note),
        ]);
    return sectionAlt([
        sectionHead(
            'Measured, not marketed',
            'Every number here is one we publish because we test for it — on our own gear, in our own room, the same way you will hear it.'
        ),
        gridFour([
            stat(
                '20Hz–40kHz',
                'Full frequency range',
                'You hear everything a good recording captured, from the lowest bass you feel to detail most gear rounds off.'
            ),
            stat(
                '−42 dB',
                'Active noise cancelling',
                'The plane, the train and the open office, turned down to a hush — so the music, not the world, sets the volume.'
            ),
            stat(
                '38 hours',
                'Battery, cancelling on',
                'More than a week of commutes between charges. Ten minutes on the cable buys a full day when you forget.'
            ),
            stat(
                '112 dB',
                'Dynamic range',
                'The quietest breath and the loudest hit both arrive clean, with nothing lost or smeared in between.'
            ),
        ]),
    ]);
}

/** The "where you listen" strip — square photographs a visitor scrolls through, the DJI
 *  "Explore by Scenario" translation (Studio / Commute / Desktop / Travel). CSS-only
 *  scroll, named utilities throughout. */
function scenarioStrip(): Node {
    const scene = (assetId: string, title: string, note: string): Node =>
        el('figure', 'flex w-72 shrink-0 snap-start flex-col gap-3', {
            children: [
                el('img', 'aspect-square w-full rounded-box border border-base-300 bg-base-200 object-cover', {
                    attrs: { src: assetUrl(assetId), alt: '', loading: 'lazy' },
                }),
                el('figcaption', 'text-base font-semibold text-base-content', { text: title }),
                el('p', 'text-base text-base-content', { text: note }),
            ],
        });
    return section([
        sectionHead(
            'Made for where you listen',
            'One signature, tuned for the room you are actually in — the studio, the street, the desk, the departure lounge.'
        ),
        el('div', 'flex snap-x gap-6 overflow-x-auto pb-4', {
            children: [
                scene('scene-studio', 'In the studio', 'Flat and honest, so a mix that sounds right here sounds right everywhere.'),
                scene('scene-commute', 'On the commute', 'Cancelling that holds the noise down without the pressure other pairs give you.'),
                scene('scene-desktop', 'At the desk', 'Enough drive from the Pulse to run the open-backs properly, all day.'),
                scene('scene-travel', 'On the road', 'Folds into the case, lasts the long-haul, and charges on the same cable as your laptop.'),
            ],
        }),
    ]);
}

/** The closing band — the DJI app / final-CTA moment. Full-width electric-blue primary
 *  surface (the one place the page is allowed to shout), carrying the home-audition
 *  promise and a single action into the shop. */
function closingBand(): Node {
    return el('section', 'bg-primary text-primary-content @container px-6 py-20', {
        children: [
            el('div', 'mx-auto flex w-full max-w-3xl flex-col items-center gap-6', {
                children: [
                    el('h2', 'text-center text-3xl font-semibold @3xl:text-4xl', { text: 'Hear it for yourself' }),
                    el('p', 'max-w-xl text-center text-lg', {
                        text: 'Every Aphelion piece ships with a sixty-day home audition. Listen on your own music, in your own room, and send it back for a full refund if it does not earn its place.',
                    }),
                    actions([
                        el('a', 'btn btn-neutral btn-lg', { attrs: { href: '/shop' }, text: 'Shop all audio' }),
                    ]),
                ],
            }),
        ],
    });
}

const HOME: Node[] = [
    hero(),
    productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'New from Aphelion' }),
    capabilityBand({
        heading: 'The sound comes first',
        lead: 'We start from the recording and work backwards — a signature that adds no color of its own, so a voice sounds like the person and a room sounds like the room. What the artist meant, and not a hair more.',
        assetId: 'band-sound',
        alt: 'A dim room lit only by the glow of a stereo',
        cta: 'How we tune',
        href: '/journal',
    }),
    productsBlock({ source: 'commerce.category.headphones', layout: 'carousel', heading: 'Headphones' }),
    capabilityBand({
        heading: 'Engineered to disappear',
        lead: 'A planar-magnetic driver moves the whole surface of the diaphragm at once, so detail arrives without the ring or the lag a cone leaves behind. Cancelling reads the noise around you a thousand times a second and answers it — quietly, without the pressure that tires your ears.',
        assetId: 'band-engineered',
        alt: 'A detailed view of a pair of headphones',
        cta: 'Inside the driver',
        href: '/journal',
    }),
    productsBlock({ source: 'commerce.category.earbuds', layout: 'carousel', heading: 'Earbuds' }),
    capabilityBand({
        heading: 'A room, filled',
        lead: 'The same reference tuning, scaled up to move air. Reference speakers with the amplifier built in and measured to the millimetre, so a pair on a shelf gives you a stage you can point to with your eyes closed.',
        assetId: 'band-range',
        alt: 'A speaker filling a darkened room with sound',
        cta: 'Meet the Monolith',
        href: '/journal',
    }),
    productsBlock({ source: 'commerce.category.speakers', layout: 'carousel', heading: 'Speakers' }),
    specHighlights(),
    scenarioStrip(),
    closingBand(),
    // The DJI footer-subscribe moment. A real submitting form (lands in the tenant's Form
    // submissions inbox), safe to place here because the `columns` footer variant carries
    // no subscribe of its own — so this is the site's one sign-up, not a duplicate.
    newsletterSignup(),
];

// ── About + Contact (Aphelion-voiced) ─────────────────────────────────────────────

const ABOUT: Node[] = [
    el('section', 'bg-base-100 @container px-6 py-20', {
        children: [
            el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-6', {
                children: [
                    el('h1', 'text-4xl font-semibold tracking-tight text-base-content @2xl:text-5xl', {
                        text: 'About Aphelion',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'Aphelion is a small audio company that builds reference gear — headphones, earbuds and speakers designed to get out of the way of the recording. We are engineers who happen to love music, which is the right way round: the measurements come first, and they are honest, because the ear catches what a spec sheet flatters over.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'We design and tune everything ourselves, publish the numbers we test for, and put every piece through a sixty-day home audition — because the only room that matters is the one you actually listen in. Nothing here is re-badged. We can tell you which driver is inside, why it was chosen, and how to keep it running for years.',
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
        intro: 'A question about which pair suits your music, a room you want to fill, or a piece that needs a part after a few good years — a real person who knows the gear reads every message and replies, usually the same day.',
        submitLabel: 'Email Aphelion',
    }),
];

// ── Commerce (Aphelion — 12 SKUs) ────────────────────────────────────────────────

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
    // The typed product type (docs/143) — every piece here is `electronics`, so the PDP's
    // `pdpAttributes` renders each product's OWN specs/connectivity/box-contents/warranty
    // (real per-product copy, not a hardcoded spec table).
    productTypeKey: 'electronics';
    attributes: {
        specs: { label: string; value: string }[];
        connectivity: string;
        inTheBox: string;
        warranty: string;
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

const money = (dollars: number): number => Math.round(dollars * 100);

const PRODUCTS: Product[] = [
    {
        handle: 'aphelion-one',
        title: 'Aphelion One',
        description:
            'Our flagship open-back over-ear headphones, built around a hand-matched planar-magnetic driver. Open-back means the sound breathes rather than pressing on your ears — a wide, natural stage that puts each instrument in its own place. Machined aluminium, real leather, and a cable and earpads you can replace instead of a headphone you have to.',
        status: 'active',
        productType: 'Headphones',
        vendor: 'Aphelion',
        tags: ['headphones', 'over-ear', 'open-back', 'planar', 'reference'],
        categoryHandles: ['headphones'],
        collectionHandles: ['new-arrivals', 'headphones'],
        seoTitle: 'Aphelion One — open-back planar-magnetic headphones',
        seoDescription: 'Flagship open-back over-ear headphones with a hand-matched planar-magnetic driver and replaceable parts.',
        productTypeKey: 'electronics',
        attributes: {
            specs: [
                { label: 'Driver', value: 'Hand-matched planar-magnetic, 100 mm' },
                { label: 'Design', value: 'Open-back, over-ear' },
                { label: 'Impedance', value: '32 Ω' },
                { label: 'Sensitivity', value: '100 dB / mW' },
                { label: 'Frequency range', value: '8 Hz – 50 kHz' },
                { label: 'Weight', value: '385 g' },
            ],
            connectivity:
                'Wired only, on a detachable 1.5 m cable terminated in 3.5 mm, with a 6.35 mm screw-on adapter in the box and an optional balanced cable for a blacker background. Open-backs are made to sit still and be driven properly — there is no battery to age and no wireless to compress the signal.',
            inTheBox:
                'The Aphelion One, a detachable 1.5 m single-ended cable, a 6.35 mm adapter, a spare set of protein-leather earpads and a hard storage case.',
            warranty:
                'Three years, with a sixty-day home audition. Every wear part — earpads, cable, headband — is a stocked replaceable spare, so a tired pair is repaired, never retired.',
        },
        options: [
            { name: 'Finish', displayType: 'swatch', values: [{ value: 'Onyx' }, { value: 'Titanium' }] },
        ],
        variants: [
            { sku: 'APH-ONE-ONX', priceCents: money(699), isDefault: true, inventoryPolicy: 'continue', optionValues: { Finish: 'Onyx' } },
            { sku: 'APH-ONE-TTN', priceCents: money(729), inventoryPolicy: 'continue', optionValues: { Finish: 'Titanium' } },
        ],
        images: [{ assetId: 'aphelion-one', isPrimary: true, alt: 'The Aphelion One headphones' }],
    },
    {
        handle: 'aphelion-one-wireless',
        title: 'Aphelion One Wireless',
        description:
            'The One tuning, now wireless, with adaptive noise cancelling that reads the room and answers it without the pressure that tires your ears on a long flight. Thirty-eight hours between charges, a ten-minute top-up for a full day, and the cable in the box for when you want to listen wired.',
        status: 'active',
        productType: 'Headphones',
        vendor: 'Aphelion',
        tags: ['headphones', 'over-ear', 'wireless', 'anc'],
        categoryHandles: ['headphones'],
        collectionHandles: ['headphones'],
        seoTitle: 'Aphelion One Wireless — adaptive-ANC over-ear headphones',
        seoDescription: 'Wireless over-ear headphones with adaptive noise cancelling, 38-hour battery, and the reference One tuning.',
        productTypeKey: 'electronics',
        attributes: {
            specs: [
                { label: 'Driver', value: 'Planar-magnetic, 100 mm' },
                { label: 'Design', value: 'Closed-back, over-ear' },
                { label: 'Noise cancelling', value: 'Adaptive hybrid, −42 dB' },
                { label: 'Battery', value: '38 h with cancelling on' },
                { label: 'Fast charge', value: '10 min for a full day' },
                { label: 'Weight', value: '330 g' },
            ],
            connectivity:
                'Bluetooth 5.3 with high-resolution LDAC and multipoint to two devices, plus the supplied analogue cable for wired listening with zero latency. USB-C both charges it and passes audio, so it works while it tops up.',
            inTheBox:
                'The Aphelion One Wireless, a 1.2 m USB-C charging cable, a 1.5 m analogue listening cable, a 6.35 mm adapter and a hard travel case.',
            warranty:
                'Three years, with a sixty-day home audition. The battery is a serviceable part we replace rather than write the headphone off when it eventually tires.',
        },
        options: [
            { name: 'Finish', displayType: 'swatch', values: [{ value: 'Onyx' }, { value: 'Graphite' }] },
        ],
        variants: [
            { sku: 'APH-ONEW-ONX', priceCents: money(449), isDefault: true, inventoryPolicy: 'continue', optionValues: { Finish: 'Onyx' } },
            { sku: 'APH-ONEW-GRP', priceCents: money(449), inventoryPolicy: 'continue', optionValues: { Finish: 'Graphite' } },
        ],
        images: [{ assetId: 'aphelion-one-wireless', isPrimary: true, alt: 'The Aphelion One Wireless headphones' }],
    },
    {
        handle: 'aphelion-buds-pro',
        title: 'Aphelion Buds Pro',
        description:
            'True-wireless earbuds that carry the reference tuning in a shell the size of a thumbnail. High-resolution wireless (LDAC) sends more of the recording across than most earbuds bother to, and the cancelling is deep enough to make a train carriage disappear. A snug, sealed fit in four sizes, so the bass is there because it fits, not because it was cranked.',
        status: 'active',
        productType: 'Earbuds',
        vendor: 'Aphelion',
        tags: ['earbuds', 'true-wireless', 'anc', 'ldac'],
        categoryHandles: ['earbuds'],
        collectionHandles: ['new-arrivals', 'earbuds'],
        seoTitle: 'Aphelion Buds Pro — ANC true-wireless earbuds with LDAC',
        seoDescription: 'True-wireless earbuds with high-resolution LDAC, deep active noise cancelling, and a sealed four-size fit.',
        productTypeKey: 'electronics',
        attributes: {
            specs: [
                { label: 'Driver', value: '11 mm dynamic' },
                { label: 'Noise cancelling', value: 'Hybrid, up to −40 dB' },
                { label: 'Battery', value: '8 h buds, 30 h with case' },
                { label: 'Water resistance', value: 'IPX4 (buds)' },
                { label: 'Codecs', value: 'LDAC, AAC, SBC' },
                { label: 'Fit', value: 'Sealed, four tip sizes' },
            ],
            connectivity:
                'Bluetooth 5.3 with high-resolution LDAC, AAC and multipoint to two devices. The case charges over USB-C or any Qi wireless pad, and either bud runs solo for calls while the other rests.',
            inTheBox:
                'The Aphelion Buds Pro, a USB-C charging case, four sizes of silicone tips (XS–L) and a short USB-C cable.',
            warranty:
                'Two years, with a sixty-day home audition. Tips are replaceable and the case is stocked as a spare part if it is ever lost.',
        },
        options: [
            { name: 'Finish', displayType: 'swatch', values: [{ value: 'Onyx' }, { value: 'Titanium' }] },
        ],
        variants: [
            { sku: 'APH-BPRO-ONX', priceCents: money(279), isDefault: true, inventoryPolicy: 'continue', optionValues: { Finish: 'Onyx' } },
            { sku: 'APH-BPRO-TTN', priceCents: money(279), inventoryPolicy: 'continue', optionValues: { Finish: 'Titanium' } },
        ],
        images: [{ assetId: 'aphelion-buds-pro', isPrimary: true, alt: 'The Aphelion Buds Pro earbuds' }],
    },
    {
        handle: 'aphelion-buds-air',
        title: 'Aphelion Buds Air',
        description:
            'The everyday earbud — the Aphelion signature, the long battery and the easy pairing, without the active cancelling. A light, comfortable fit for a run or a call, with clear voice pickup so the person on the other end hears you, not the wind.',
        status: 'active',
        productType: 'Earbuds',
        vendor: 'Aphelion',
        tags: ['earbuds', 'true-wireless', 'everyday'],
        categoryHandles: ['earbuds'],
        collectionHandles: ['earbuds'],
        seoTitle: 'Aphelion Buds Air — everyday true-wireless earbuds',
        seoDescription: 'Light, comfortable true-wireless earbuds with the Aphelion signature, long battery, and clear call pickup.',
        productTypeKey: 'electronics',
        attributes: {
            specs: [
                { label: 'Driver', value: '10 mm dynamic' },
                { label: 'Noise cancelling', value: 'None — light open fit' },
                { label: 'Battery', value: '7 h buds, 28 h with case' },
                { label: 'Water resistance', value: 'IPX4 (buds)' },
                { label: 'Codecs', value: 'AAC, SBC' },
                { label: 'Microphones', value: 'Dual, wind-reduced' },
            ],
            connectivity:
                'Bluetooth 5.3 with AAC and multipoint to two devices. USB-C charging, fast-pair the first time you open the case, and clear dual-mic voice pickup that hears you over the wind.',
            inTheBox:
                'The Aphelion Buds Air, a USB-C charging case, two extra tip sizes and a short USB-C cable.',
            warranty:
                'Two years, with a sixty-day home audition. A light everyday earbud, built to be replaced part by part rather than as a whole.',
        },
        options: [
            { name: 'Finish', displayType: 'swatch', values: [{ value: 'Onyx' }, { value: 'Graphite' }] },
        ],
        variants: [
            { sku: 'APH-BAIR-ONX', priceCents: money(149), isDefault: true, inventoryPolicy: 'continue', optionValues: { Finish: 'Onyx' } },
            { sku: 'APH-BAIR-GRP', priceCents: money(149), inventoryPolicy: 'continue', optionValues: { Finish: 'Graphite' } },
        ],
        images: [{ assetId: 'aphelion-buds-air', isPrimary: true, alt: 'The Aphelion Buds Air earbuds' }],
    },
    {
        handle: 'aphelion-monolith',
        title: 'Aphelion Monolith',
        description:
            'A reference active bookshelf speaker, sold as a matched pair. The amplifier lives inside, tuned to the exact driver it drives, so you plug in a source and you are done — no separate box, no guesswork, no mismatch. Measured to the millimetre and voiced by ear, a pair on a shelf throws a stage you can point to with your eyes shut.',
        status: 'active',
        productType: 'Speakers',
        vendor: 'Aphelion',
        tags: ['speakers', 'bookshelf', 'active', 'reference', 'pair'],
        categoryHandles: ['speakers'],
        collectionHandles: ['new-arrivals', 'speakers'],
        seoTitle: 'Aphelion Monolith — reference active bookshelf speakers (pair)',
        seoDescription: 'A matched pair of reference active bookshelf speakers with the amplifier built in and tuned to the driver.',
        productTypeKey: 'electronics',
        attributes: {
            specs: [
                { label: 'Type', value: 'Active two-way bookshelf' },
                { label: 'Amplifier', value: '80 W per channel, built in' },
                { label: 'Drivers', value: '25 mm tweeter, 130 mm mid-bass' },
                { label: 'Frequency range', value: '42 Hz – 30 kHz' },
                { label: 'Room correction', value: 'On-board, self-measuring' },
                { label: 'Weight', value: '6.2 kg each' },
            ],
            connectivity:
                'Balanced XLR and RCA analogue in, plus optical, coaxial and USB digital in — the amplifier and DAC live inside, tuned to the exact driver, so you plug a source straight in with no separate box and no mismatch. The two speakers link over a single supplied cable.',
            inTheBox:
                'A matched pair of Aphelion Monolith speakers, the inter-speaker link cable, a power lead for each, magnetic grilles and two sets of isolation feet.',
            warranty:
                'Five years on the drivers and cabinet, two on the electronics, with a sixty-day home audition. Room-correction firmware updates over USB for the life of the pair.',
        },
        options: [
            { name: 'Finish', displayType: 'swatch', values: [{ value: 'Onyx' }, { value: 'Walnut' }] },
        ],
        variants: [
            { sku: 'APH-MONO-ONX', priceCents: money(1299), isDefault: true, inventoryPolicy: 'continue', optionValues: { Finish: 'Onyx' } },
            { sku: 'APH-MONO-WLN', priceCents: money(1399), inventoryPolicy: 'continue', optionValues: { Finish: 'Walnut' } },
        ],
        images: [{ assetId: 'aphelion-monolith', isPrimary: true, alt: 'The Aphelion Monolith speakers' }],
    },
    {
        handle: 'aphelion-field',
        title: 'Aphelion Field',
        description:
            'A portable speaker that does not apologise for its size. Sealed against dust and water to IP67 — it survives a beach, a shower and a spilled drink — with a battery that runs a whole afternoon and a tuning that stays honest instead of turning everything into thud. Pairs two together for real stereo.',
        status: 'active',
        productType: 'Speakers',
        vendor: 'Aphelion',
        tags: ['speakers', 'portable', 'bluetooth', 'ip67'],
        categoryHandles: ['speakers'],
        collectionHandles: ['speakers'],
        seoTitle: 'Aphelion Field — IP67 portable Bluetooth speaker',
        seoDescription: 'A rugged IP67 portable Bluetooth speaker with an all-afternoon battery and an honest, un-boomy tuning.',
        productTypeKey: 'electronics',
        attributes: {
            specs: [
                { label: 'Type', value: 'Portable, sealed enclosure' },
                { label: 'Drivers', value: 'Dual 45 mm + passive radiator' },
                { label: 'Battery', value: 'Up to 18 h' },
                { label: 'Water & dust', value: 'IP67 rated' },
                { label: 'Pairing', value: 'Stereo-pair two units' },
                { label: 'Weight', value: '680 g' },
            ],
            connectivity:
                'Bluetooth 5.3 with AAC, a 3.5 mm aux in for anything wired, and USB-C charging that will also top up a phone in a pinch. Pair two Fields for a true left-and-right stereo image.',
            inTheBox:
                'The Aphelion Field, a USB-C charging cable, a woven carry strap and a quick-start card.',
            warranty:
                'Two years, with a sixty-day home audition. Sealed to IP67 against dust and water, so a beach or a spilled drink is a wipe-down, not a repair.',
        },
        options: [
            { name: 'Finish', displayType: 'swatch', values: [{ value: 'Onyx' }, { value: 'Sand' }] },
        ],
        variants: [
            { sku: 'APH-FIELD-ONX', priceCents: money(199), isDefault: true, inventoryPolicy: 'continue', optionValues: { Finish: 'Onyx' } },
            { sku: 'APH-FIELD-SND', priceCents: money(199), inventoryPolicy: 'continue', optionValues: { Finish: 'Sand' } },
        ],
        images: [{ assetId: 'aphelion-field', isPrimary: true, alt: 'The Aphelion Field portable speaker' }],
    },
    {
        handle: 'aphelion-pulse',
        title: 'Aphelion Pulse',
        description:
            'A pocket-sized USB-C headphone amplifier and DAC — the small box that makes a laptop or a phone drive a real pair of headphones properly. It gives demanding open-backs the power they need to open up, and cleans up the thin, quiet output most devices ship with. One cable in, your headphones out, and everything gets louder, clearer and more alive.',
        status: 'active',
        productType: 'Amps & DACs',
        vendor: 'Aphelion',
        tags: ['dac', 'amplifier', 'usb-c', 'portable'],
        categoryHandles: ['amps-dacs'],
        collectionHandles: ['new-arrivals'],
        seoTitle: 'Aphelion Pulse — portable USB-C DAC and headphone amplifier',
        seoDescription: 'A pocket USB-C DAC and headphone amplifier that drives demanding headphones from a laptop or phone.',
        productTypeKey: 'electronics',
        attributes: {
            specs: [
                { label: 'Type', value: 'USB-C DAC & headphone amp' },
                { label: 'Output', value: '2 Vrms, drives up to 300 Ω' },
                { label: 'DAC resolution', value: 'Up to 32-bit / 384 kHz' },
                { label: 'Formats', value: 'PCM and native DSD' },
                { label: 'Control', value: 'Machined analogue volume dial' },
                { label: 'Weight', value: '95 g' },
            ],
            connectivity:
                'One USB-C in from a laptop or phone, one 3.5 mm and one 4.4 mm balanced headphone out. Bus-powered, so there is no battery and no wall wart — one cable in, your headphones out, everything louder and cleaner.',
            inTheBox:
                'The Aphelion Pulse, a USB-C to USB-C cable, a USB-C to USB-A adapter and a silicone band for stacking it to a phone.',
            warranty:
                'Three years, with a sixty-day home audition. Firmware updates over the same USB-C port keep it current with new formats.',
        },
        variants: [{ sku: 'APH-PULSE', priceCents: money(229), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'aphelion-pulse', isPrimary: true, alt: 'The Aphelion Pulse DAC and amplifier' }],
    },
    {
        handle: 'aphelion-ridgeline',
        title: 'Aphelion Ridgeline',
        description:
            'A slim soundbar that treats a film the way we treat a record — dialogue you never have to rewind, and an effects track with real weight, from one bar under the screen. No rack of boxes, no calibration ritual: it measures your room on setup and tunes itself to it.',
        status: 'active',
        productType: 'Speakers',
        vendor: 'Aphelion',
        tags: ['speakers', 'soundbar', 'home-cinema'],
        categoryHandles: ['speakers'],
        collectionHandles: ['speakers'],
        seoTitle: 'Aphelion Ridgeline — self-calibrating soundbar',
        seoDescription: 'A slim soundbar with clear dialogue and real weight that measures your room and tunes itself to it.',
        productTypeKey: 'electronics',
        attributes: {
            specs: [
                { label: 'Type', value: 'Self-calibrating soundbar' },
                { label: 'Channels', value: '3.1.2, room-corrected' },
                { label: 'Drivers', value: 'Six drivers + up-firing pair' },
                { label: 'Tuning', value: 'Automatic room measurement' },
                { label: 'Placement', value: 'Shelf or wall mount' },
                { label: 'Width', value: '98 cm' },
            ],
            connectivity:
                'HDMI eARC to the television, plus optical in and Bluetooth for music. It measures your room on setup and tunes itself — no rack of boxes, no calibration mic to fuss with.',
            inTheBox:
                'The Aphelion Ridgeline, an HDMI eARC cable, a wall-mount template and bracket, and a power lead.',
            warranty:
                'Three years, with a sixty-day home audition. Room tuning and format support update over HDMI for the life of the bar.',
        },
        variants: [{ sku: 'APH-RIDGE', priceCents: money(599), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'aphelion-ridgeline', isPrimary: true, alt: 'The Aphelion Ridgeline soundbar' }],
    },
    {
        handle: 'aphelion-cable',
        title: 'Aphelion Balanced Cable',
        description:
            'A braided replacement cable for the One and One Wireless, in a balanced connection that keeps the left and right channels fully apart for a cleaner, blacker background. Oxygen-free copper, a machined connector, and a length you choose — so a worn cable is a small part, never a reason to retire the headphones.',
        status: 'active',
        productType: 'Accessories',
        vendor: 'Aphelion',
        tags: ['accessories', 'cable', 'balanced'],
        categoryHandles: ['accessories'],
        collectionHandles: ['accessories'],
        seoTitle: 'Aphelion Balanced Cable — braided replacement headphone cable',
        seoDescription: 'A braided balanced replacement cable in oxygen-free copper for the Aphelion One headphones.',
        productTypeKey: 'electronics',
        attributes: {
            specs: [
                { label: 'Type', value: 'Balanced replacement cable' },
                { label: 'Conductor', value: 'Oxygen-free copper' },
                { label: 'Amp connector', value: '4.4 mm balanced' },
                { label: 'Fits', value: 'Aphelion One / One Wireless' },
                { label: 'Lengths', value: '1.5 m or 3 m' },
                { label: 'Sleeve', value: 'Braided, low-microphonic' },
            ],
            connectivity:
                'A passive analogue cable — a balanced 4.4 mm at the amplifier end and dual locking connectors at the earcups, keeping the left and right channels fully apart for a cleaner, blacker background.',
            inTheBox: 'The Aphelion Balanced Cable in your chosen length, and a reusable cable tie.',
            warranty:
                'Two years. A replaceable wear part by design, so a worn cable is a small part to swap, never a reason to retire the headphones.',
        },
        options: [
            { name: 'Length', displayType: 'dropdown', values: [{ value: '1.5 m' }, { value: '3 m' }] },
        ],
        variants: [
            { sku: 'APH-CBL-15', priceCents: money(49), isDefault: true, inventoryPolicy: 'continue', optionValues: { Length: '1.5 m' } },
            { sku: 'APH-CBL-30', priceCents: money(59), inventoryPolicy: 'continue', optionValues: { Length: '3 m' } },
        ],
        images: [{ assetId: 'aphelion-cable', isPrimary: true, alt: 'The Aphelion Balanced Cable' }],
    },
    {
        handle: 'aphelion-stand',
        title: 'Aphelion Stand',
        description:
            'A machined aluminium stand that gives your headphones a home on the desk instead of a hook or a heap. A wide, weighted base so it never tips, a soft yoke so the headband keeps its shape, and a cable channel so the wire is not draped across your keyboard.',
        status: 'active',
        productType: 'Accessories',
        vendor: 'Aphelion',
        tags: ['accessories', 'stand', 'desk'],
        categoryHandles: ['accessories'],
        collectionHandles: ['accessories'],
        seoTitle: 'Aphelion Stand — machined aluminium headphone stand',
        seoDescription: 'A weighted machined-aluminium headphone stand with a soft yoke and a cable channel.',
        productTypeKey: 'electronics',
        attributes: {
            specs: [
                { label: 'Material', value: 'Machined aluminium' },
                { label: 'Base', value: 'Wide and weighted' },
                { label: 'Yoke', value: 'Soft-touch, headband-safe' },
                { label: 'Cable', value: 'Rear routing channel' },
                { label: 'Finish', value: 'Anodised' },
                { label: 'Weight', value: '640 g' },
            ],
            connectivity:
                'None — a passive desk stand. The channel down the back keeps the cable off your keyboard rather than routing any signal.',
            inTheBox:
                'The Aphelion Stand, assembled, with felt base pads and a hex key for the yoke.',
            warranty:
                'Two years against any manufacturing fault in the machining or the anodised finish.',
        },
        variants: [{ sku: 'APH-STAND', priceCents: money(79), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'aphelion-stand', isPrimary: true, alt: 'The Aphelion Stand' }],
    },
    {
        handle: 'aphelion-case',
        title: 'Aphelion Travel Case',
        description:
            'A hard case that lets you throw the Buds Pro or the Pulse in a bag without a second thought. A crush-proof shell, a moulded tray that holds each piece and its tips in place, and a zip that has been pulled fifty thousand times in testing without giving up.',
        status: 'active',
        productType: 'Accessories',
        vendor: 'Aphelion',
        tags: ['accessories', 'case', 'travel'],
        categoryHandles: ['accessories'],
        collectionHandles: ['accessories'],
        seoTitle: 'Aphelion Travel Case — hard case for earbuds and the Pulse',
        seoDescription: 'A crush-proof hard travel case with a moulded tray for the Aphelion Buds Pro and Pulse.',
        productTypeKey: 'electronics',
        attributes: {
            specs: [
                { label: 'Type', value: 'Hard travel case' },
                { label: 'Shell', value: 'Crush-proof moulded EVA' },
                { label: 'Interior', value: 'Moulded holding tray' },
                { label: 'Fits', value: 'Buds Pro and the Pulse' },
                { label: 'Zip', value: 'Tested to 50,000 cycles' },
                { label: 'Weight', value: '140 g' },
            ],
            connectivity:
                'None — protection, not electronics. The moulded tray holds each piece and its tips in place so nothing rattles loose in a bag.',
            inTheBox:
                'The Aphelion Travel Case with its moulded tray, and a clip-in mesh pocket for cables and tips.',
            warranty:
                'Two years, covering the zip and the shell against failure in normal use.',
        },
        variants: [{ sku: 'APH-CASE', priceCents: money(69), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'aphelion-case', isPrimary: true, alt: 'The Aphelion Travel Case' }],
    },
    {
        handle: 'aphelion-pads',
        title: 'Aphelion Earpads',
        description:
            'Replacement earpads for the One and One Wireless, in the same protein leather and memory foam we fit at the factory. Pads are the one part that wears, and swapping them brings back the seal, the comfort and the bass a tired pair loses — a five-minute job, no tools, in a couple of years when you need it.',
        status: 'active',
        productType: 'Accessories',
        vendor: 'Aphelion',
        tags: ['accessories', 'earpads', 'replacement'],
        categoryHandles: ['accessories'],
        collectionHandles: ['accessories'],
        seoTitle: 'Aphelion Earpads — replacement earpads for the One',
        seoDescription: 'Factory-grade replacement earpads in protein leather and memory foam for the Aphelion One.',
        productTypeKey: 'electronics',
        attributes: {
            specs: [
                { label: 'Type', value: 'Replacement earpads' },
                { label: 'Material', value: 'Protein leather, memory foam' },
                { label: 'Fits', value: 'Aphelion One / One Wireless' },
                { label: 'Fitting', value: 'Twist-lock, tool-free' },
                { label: 'Sold as', value: 'A matched pair' },
                { label: 'Swap time', value: 'About five minutes' },
            ],
            connectivity:
                'None — a factory-grade wear part. Swapping the pads restores the seal, the comfort and the bass a tired pair slowly loses.',
            inTheBox: 'A matched pair of Aphelion Earpads, and a quick-fit card.',
            warranty:
                'One year. Pads are the part that wears, so we price them to be replaced every couple of years without a second thought.',
        },
        variants: [{ sku: 'APH-PADS', priceCents: money(39), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'aphelion-pads', isPrimary: true, alt: 'The Aphelion Earpads' }],
    },
];

const COMMERCE = {
    categories: [
        { handle: 'headphones', name: 'Headphones', description: 'Over-ear headphones, wired and wireless.', featured: true },
        { handle: 'earbuds', name: 'Earbuds', description: 'True-wireless earbuds.', featured: true },
        { handle: 'speakers', name: 'Speakers', description: 'Bookshelf, portable and home-cinema speakers.', featured: true },
        { handle: 'amps-dacs', name: 'Amps & DACs', description: 'The small boxes that drive your headphones properly.', featured: false },
        { handle: 'accessories', name: 'Accessories', description: 'Cables, stands, cases and the parts that keep gear going.', featured: false },
    ],
    collections: [
        {
            handle: 'new-arrivals',
            name: 'New Arrivals',
            description: 'The latest from the workshop.',
            type: 'manual',
            featured: true,
            productHandles: ['aphelion-one', 'aphelion-one-wireless', 'aphelion-buds-pro', 'aphelion-monolith', 'aphelion-pulse'],
        },
        {
            handle: 'headphones',
            name: 'Headphones',
            description: 'Reference over-ear headphones, wired and wireless.',
            type: 'manual',
            featured: false,
            productHandles: ['aphelion-one', 'aphelion-one-wireless'],
        },
        {
            handle: 'earbuds',
            name: 'Earbuds',
            description: 'The reference signature, in your pocket.',
            type: 'manual',
            featured: false,
            productHandles: ['aphelion-buds-pro', 'aphelion-buds-air'],
        },
        {
            handle: 'speakers',
            name: 'Speakers',
            description: 'Reference sound for the shelf, the beach and the screen.',
            type: 'manual',
            featured: false,
            productHandles: ['aphelion-monolith', 'aphelion-field', 'aphelion-ridgeline'],
        },
        {
            handle: 'accessories',
            name: 'Accessories',
            description: 'Cables, stands, cases and replaceable parts.',
            type: 'manual',
            featured: false,
            productHandles: ['aphelion-cable', 'aphelion-stand', 'aphelion-case', 'aphelion-pads'],
        },
    ],
    products: PRODUCTS,
};

// ── Content (The Signal Path — Aphelion's journal) ───────────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });

const CONTENT = [
    {
        typeKey: 'blog_post',
        slug: 'inside-the-planar-driver',
        status: 'published',
        body: {
            title: 'Inside the One: how a planar driver moves air',
            excerpt: 'Most headphones push air with a cone. The One uses a flat sheet — and the difference is why it sounds the way it does.',
            featuredImage: { $asset: 'post-planar' },
            body: {
                type: 'doc',
                content: [
                    para('Open almost any headphone and you find a small paper or plastic cone, driven from a single point at its centre by a coil of wire. It works, and it is cheap, but a cone pushed from the middle flexes at its edges — and that flexing is distortion you can hear as a faint ring or a smear on fast, complex music.'),
                    h2('A whole surface, moving at once'),
                    para('A planar-magnetic driver does it differently. Instead of a cone, it uses a thin, flat film with a circuit printed across its entire face, suspended between two arrays of magnets. The whole sheet moves together, evenly, from edge to edge. There is nothing to flex, so a struck cymbal or a plucked string starts and stops cleanly, exactly when the recording says it should.'),
                    h2('Why it needs a little more push'),
                    para('The trade is that a planar film is harder to drive than a cone — which is why the One opens up so much more from a proper amplifier than from a phone, and why we make the Pulse. Give it the power it wants and the stage widens, the bass firms up, and the quiet details step forward out of the black.'),
                    para('None of this is exotic for its own sake. It is the most honest way we know to turn an electrical signal back into the air pressure that was in the room when the recording was made.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'how-we-measure-noise-cancelling',
        status: 'published',
        body: {
            title: 'How we measure noise cancelling (and why the number lies)',
            excerpt: 'A bigger cancelling figure is not always the quieter one. What the decibel number does and does not tell you, in plain terms.',
            featuredImage: { $asset: 'post-anc' },
            body: {
                type: 'doc',
                content: [
                    para('Every pair of cancelling headphones quotes a decibel figure, and shoppers are told bigger is better. It is not that simple. That single number is measured at one pitch, in a lab, and it says nothing about the pitches it does not cover or the side effects of reaching for a record-breaking figure.'),
                    h2('Noise is not one sound'),
                    para('The drone of a plane is low and steady, and cancelling handles it well. A crying child, a closing door, a colleague two desks away — these are higher and sudden, and no cancelling touches them much. A pair that crushes the low drone while ignoring everything else can measure beautifully and still leave you reaching for the volume.'),
                    h2('The cost of chasing the number'),
                    para('Push cancelling hard and it introduces its own pressure — that faint, ears-blocked feeling that turns a long flight into a headache. We tune for the point where the world drops away but your ears stay relaxed, then we publish the figure that point produces, not the biggest one we could force.'),
                    para('So read the number, but trust your ears. The right question is never "how many decibels" — it is "can I wear this for six hours and forget I have it on."'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'reference-or-fun-tuning-the-monolith',
        status: 'published',
        body: {
            title: 'Reference or fun? Tuning the Monolith',
            excerpt: 'The oldest argument in audio is whether a speaker should be honest or exciting. Here is where we landed, and why.',
            featuredImage: { $asset: 'post-monolith' },
            body: {
                type: 'doc',
                content: [
                    para('There are two schools. One says a speaker should be a flat, honest window — it plays exactly what was recorded and adds nothing. The other says a little extra bass and a little extra sparkle make music more fun, and fun is the point. Both are right, which is precisely the problem.'),
                    h2('Honest, with the lights on'),
                    para('We voice the Monolith flat, because a colored speaker flatters some records and wrecks others — and once the color is baked in you cannot take it back out. Flat means a well-made recording sounds thrilling and a badly-made one sounds honest about it, which is the speaker telling you the truth rather than a lie you happen to like.'),
                    h2('Where the room comes in'),
                    para('Flat at the speaker is not flat at your chair — walls, glass and furniture bend the sound on its way to you. That is why the Monolith measures its own placement and corrects for the room, and why the excitement, when you want it, belongs on a tone control you can turn back, not in a driver you cannot.'),
                    para('Reference or fun is a false choice. Build it honest, hand the shaping to the listener, and you get both — on the nights you want each one.'),
                ],
            },
        },
    },
];

// ── Product detail (the cinematic spec PDP) + Shop ───────────────────────────────
// DJI's PDP sells an engineered object on capability: a near-black cinematic hero with a
// big product render, then a spec-forward buy box that closes the deal on numbers, not
// lifestyle (DESIGN §4 PDP-anatomy / §6). Ported to Aphelion in the `flux` true-dark
// theme: a two-column dark split — a large product render left on the near-black
// `base-100` ground, a spec-heavy buy column right (breadcrumb → title → price →
// description → real Add-to-cart → the typed attribute table → shipping/returns links). The
// one electric-blue signal stays on the chrome + primary action; every readable line is
// ink (`text-base-content`) so contrast holds on the dark ground. Bound fields come from
// the shared PDP kit (correct `repeat('product')` scope + `item.*` binds). The spec table is
// no longer hardcoded per template (a soundbar's specs ≠ an earpad's): `pdpAttributes`
// repeats the routed piece's OWN typed `electronics` attributes (docs/143) — specifications,
// connectivity, in-the-box and warranty — and `pdpPolicyLinks` points at the real
// shipping/returns pages. The layout is ours.

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the big cinematic product render. Right: the spec-forward buy column. */
function pdpBuyRegion(): Node {
    return el('section', 'bg-base-100 @container px-6 py-12 @3xl:py-16', {
        children: [
            el('div', 'mx-auto grid w-full max-w-6xl gap-10 @3xl:grid-cols-2 @3xl:gap-16', {
                children: [
                    // The big product render on the near-black ground (one bound primary — the
                    // storefront fills it per routed product).
                    pdpImage(
                        'aspect-square w-full rounded-box border border-base-300 bg-base-200 object-cover'
                    ),
                    // The spec-forward buy column.
                    el('div', 'flex flex-col gap-6 @3xl:py-4', {
                        children: [
                            el('div', 'flex flex-col gap-3', {
                                children: [
                                    // Breadcrumb/label above the title — a plain <p>, so the product title
                                    // stays the page's one <h1>.
                                    el('p', 'text-sm font-medium uppercase tracking-widest text-base-content', {
                                        text: 'Aphelion — Reference audio',
                                    }),
                                    pdpTitle(
                                        'h1',
                                        'text-4xl font-semibold leading-tight tracking-tight text-base-content @3xl:text-5xl'
                                    ),
                                    pdpPriceRow({
                                        priceClass: 'text-3xl font-semibold text-base-content',
                                        compareClass: 'text-lg text-base-content line-through',
                                        rowClass: 'flex items-baseline gap-4',
                                    }),
                                    // A real low-stock signal in the electric-blue primary — shown only when the
                                    // routed piece is genuinely running low (never fabricated scarcity).
                                    pdpStockBadge({
                                        className:
                                            'inline-flex w-fit items-center gap-2 rounded-field bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary-content',
                                        label: 'Low stock',
                                    }),
                                ],
                            }),
                            pdpDescription('text-lg leading-relaxed text-base-content'),
                            // Qty + Add to cart — the real cart form (electric-blue btn-primary in `flux`).
                            addToCartForm(),
                            // The product's OWN typed attributes — the DJI spec table, now per-product:
                            // `specs` repeats as key/value rows, and connectivity / in-the-box / warranty
                            // read as prose, all from `attributeSections` (docs/143). Real per-product copy,
                            // not a hardcoded, byte-identical spec block.
                            pdpAttributes({
                                containerClass: 'mt-2 flex flex-col gap-6',
                                sectionClass: 'flex flex-col gap-2 border-t border-base-300 pt-5',
                                labelTag: 'h2',
                                labelClass: 'text-sm font-semibold uppercase tracking-widest text-base-content',
                                valueClass: 'text-base leading-relaxed text-base-content',
                                rowClass:
                                    'flex items-baseline justify-between gap-6 border-t border-base-300 py-3',
                                rowLabelClass: 'text-sm font-medium uppercase tracking-widest text-base-content',
                                rowValueClass: 'text-right text-base font-medium text-base-content',
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

/** The full cinematic PDP — the buy region above a "Pairs well with" carousel of
 *  same-collection pieces (`commerce.related`, the shared kit's default cross-sell). */
const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Pairs well with' });

/** The Shop page's own cinematic header, shown ABOVE the faceted catalogue core the harness
 *  appends. A full-bleed dark band with a readable `base-100` panel — the same showroom
 *  framing the home hero + capability bands use — in place of the generic shop header. */
const SHOP: Node[] = [
    el('section', 'relative @container overflow-hidden bg-base-200', {
        children: [
            el('img', 'absolute inset-0 h-full w-full object-cover', {
                attrs: { src: assetUrl('band-range'), alt: '', loading: 'lazy' },
            }),
            el(
                'div',
                'relative mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
                {
                    children: [
                        el('div', 'flex max-w-2xl flex-col gap-4 rounded-box bg-base-100 p-8 @3xl:p-10', {
                            children: [
                                el(
                                    'h1',
                                    'text-4xl font-semibold leading-tight tracking-tight text-base-content @3xl:text-6xl',
                                    { text: 'The full range' }
                                ),
                                el('p', 'text-lg leading-relaxed text-base-content', {
                                    text: 'Every Aphelion piece — headphones, earbuds, speakers and the parts that keep them running — filtered and sorted however you like. One reference signature, engineered for wherever you listen.',
                                }),
                            ],
                        }),
                    ],
                }
            ),
        ],
    }),
];

// ── The remaining functional pages (bespoke framing over the shared cores) ───────
// Collections / Cart / Search each get Aphelion's own cinematic masthead above the
// pinned, shoppable core the harness appends; the Journal index gets its own masthead
// over the shared linkable post grid. Same true-dark showroom voice as the rest of the
// site — near-white ink on the near-black `base-100` ground, electric-blue kept to the
// chrome the chrome/nav already carry (readable copy stays real ink).

/** A plain cinematic page masthead — an `<h1>` + one intro line on the near-black
 *  `base-100` ground. Used for Collections / Search / Journal, which each want a calm,
 *  readable header over the core the harness appends beneath. Every class is a NAMED
 *  utility so it survives the stamp into the tenant's stored tree. */
function pageMasthead(heading: string, lead: string): Node {
    return el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
                children: [
                    el(
                        'h1',
                        'text-4xl font-semibold leading-tight tracking-tight text-base-content @3xl:text-6xl',
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
        'The range, by room',
        'Headphones, earbuds, speakers and the parts that keep them running — grouped the way you actually listen, so you can start from the desk, the commute or the living room and work out from there. One reference signature across all of it.'
    ),
];

const SEARCH: Node[] = [
    pageMasthead(
        'Find your sound',
        'Looking for something specific — a driver type, a price, a piece you read about in The Signal Path? Search the whole range and the journal below.'
    ),
];

const JOURNAL: Node[] = [
    el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-20', {
        children: [
            el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-4', {
                children: [
                    el(
                        'h1',
                        'text-4xl font-semibold leading-tight tracking-tight text-base-content @3xl:text-6xl',
                        { text: 'The Signal Path' }
                    ),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Engineering notes from the people who tune the gear — inside the drivers, how we measure what we publish, and the choices behind the way an Aphelion piece sounds.',
                    }),
                ],
            }),
        ],
    }),
];

/** The Cart page's own header — a reassurance band above the pinned cart core, in place of
 *  the generic "Your cart" heading. Free insured shipping, the three-year warranty and the
 *  sixty-day home audition: the three things a reference-audio buyer wants to read before
 *  they check out. */
const CART: Node[] = [
    el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
                children: [
                    el(
                        'h1',
                        'text-4xl font-semibold leading-tight tracking-tight text-base-content @3xl:text-5xl',
                        { text: 'Your cart' }
                    ),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Free insured shipping, dispatched within two business days and tracked to your door. Every piece is covered for three years and ships with a sixty-day home audition — listen on your own music, in your own room, and send it back for a full refund if it does not earn its place.',
                    }),
                ],
            }),
        ],
    }),
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
    slug: 'tech-cinematic',
    key: 'sparx-tech-cinematic',
    name: 'Tech Cinematic',
    summary:
        'A dark, spec-forward storefront for engineered hardware — a full-bleed cinematic hero over a repeating capability-band and shoppable-carousel rhythm, on a genuinely dark page with one electric-blue signal. Modelled on the tech/cinematic product archetype; shipped as Aphelion, a premium-audio brand.',
    tagline: 'A dark, cinematic, spec-forward template for makers of premium engineered hardware.',
    vertical: 'retail',
    industry: 'Premium audio',
    requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
    sortWeight: 65,
    brand: {
        businessName: 'Aphelion',
        tagline: 'Sound, engineered.',
    },
    // DJI chrome: a three-zone dark bar — brand LEFT with the categories beside it and a
    // solid electric-blue "Store/Buy" pill on the right (`brandLeft` + `showCta: true`) —
    // over a structured dark mega-footer with link columns + the live legal-links host core
    // (`columns`). The footer carries no subscribe of its own, so the home page ships the
    // "get the latest" sign-up as its one capture.
    chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
    seo: {
        home: {
            title: 'Aphelion — reference headphones, earbuds & speakers',
            description:
                'Aphelion builds reference headphones, earbuds and speakers the way instruments are made — measured, tuned and finished so nothing is added to the recording and nothing taken away.',
        },
        about: {
            title: 'About Aphelion',
            description:
                'The people and engineering behind Aphelion — how every driver is measured, tuned and finished before it ships.',
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
