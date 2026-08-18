// sparx-playful-mission — a reference-driven SITE TEMPLATE (docs/templates/bombas).
//
// Bombas translated to sparx: a playful, colorful, mission-driven DTC storefront whose
// whole identity is a "buy one, give one" pledge — ported to a pet-supplies brand, Rally,
// "Every wag does some good". A calm warm-cream page is deliberately broken up by
// fully-saturated color bands (marigold giveback, navy impact, sage "the rest") so
// scrolling reads like turning pages in a picture book, with the give-one thread stated
// once big at the turn and echoed small down the page. Dressed in the bespoke `romp`
// theme (warm cream ground, BRIGHT marigold primary carrying dark ink, deep-navy
// secondary chrome islands, sage accent; heavy playful Syne display over rounded Nunito).
//
// This file is JUST the SPEC; the composition + emission live in the shared
// `template-sites/harness.ts`, which the other nine templates reuse. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-template-playful-mission.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-playful-mission/**" \
//     "marketplace-catalog/_gen/gen-template-playful-mission.ts"
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
    body,
    card,
    cardTitle,
    gridThree,
    sectionHead,
    CARD,
} from '../../wizeworks/packages/silica-catalog/src/sections/_shell';
import { newsletterSignup } from '../../wizeworks/packages/silica-catalog/src/sections/convert';
import { safeParseBlueprint } from '../../wizeworks/packages/blueprints/src/validate';

import { contactSection } from './shared/contact-section';
import { emitBundle, type TemplateSiteSpec } from './template-sites/harness';
import { writeTemplatePreview } from './template-sites/preview';
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
// Royalty-free Unsplash photographs, verified reachable (HTTP 200) AND visually confirmed
// on-brand at authoring time. Product + post images go through `assets` by id (the
// installer re-hosts them); the hero / color-tile / editorial-band photos are TREE
// imagery, so they hot-link the same URL inline (docs/54 §6) — they still appear in
// `assets` as the single documented registry of the bundle's imagery + alt text.
const U = (id: string): string => `https://images.unsplash.com/photo-${id}?w=1400&q=80`;

const IMG = {
    // Products
    bolsterBed: '1581888227599-779811939961',
    donutBed: '1601758123927-4f7acc7da589',
    webbingCollar: '1543466835-00a7907e9de1',
    noPullHarness: '1580129518863-f00fcf1d6e68',
    reflectiveLead: '1530700131180-d43d9b8cc41f',
    slowFeedBowl: '1598134493136-7b63ebbd7b64',
    ceramicBowlSet: '1591946559594-8c6d3b7391eb',
    fleeceBlanket: '1600369671236-e74521d4b6ad',
    ropeTugToy: '1545249390-6bdfa286032f',
    catnipKicker: '1516750105099-4b8a83e217ee',
    trainingTreats: '1568640347023-a616a30bc3bd',
    biscuitBites: '1508609540374-67d1601ba520',
    // Journal posts
    postShelter: '1544568100-847a948585b9',
    postBedSize: '1520721973443-8f2bfd949b19',
    postPartners: '1592194996308-7b43878e84a6',
    // Hero + editorial bands (tree imagery)
    hero: '1530281700549-e82e7bf110d6',
    bandComfort: '1552053831-71594a27632d',
    bandPlay: '1518717758536-85ae29035b6d',
    // Color-block category tiles (tree imagery)
    tileBeds: '1520721973443-8f2bfd949b19',
    tileCollars: '1494947665470-20322015e3a8',
    tileToys: '1585837575652-267c041d77d4',
    tileTreats: '1592468257342-8375cb556a69',
} as const;

interface Asset {
    id: string;
    url: string;
    alt: string;
}

const ASSETS: Asset[] = [
    { id: 'orthopedic-bolster-dog-bed', url: U(IMG.bolsterBed), alt: 'A dog resting in a padded bolster bed with a soft blanket' },
    { id: 'calming-donut-cat-bed', url: U(IMG.donutBed), alt: 'A dog curled into a fluffy round donut bed by a window' },
    { id: 'everyday-webbing-collar', url: U(IMG.webbingCollar), alt: 'A happy beagle wearing a webbing collar' },
    { id: 'no-pull-harness', url: U(IMG.noPullHarness), alt: 'A dog walking calmly in a padded no-pull harness' },
    { id: 'reflective-city-lead', url: U(IMG.reflectiveLead), alt: 'A retriever out for a walk on a lead beside its owner' },
    { id: 'stainless-slow-feed-bowl', url: U(IMG.slowFeedBowl), alt: 'A small dog eating from a metal bowl' },
    { id: 'ceramic-bowl-set', url: U(IMG.ceramicBowlSet), alt: 'A dog sitting beside a stoneware feeding bowl' },
    { id: 'cozy-fleece-blanket', url: U(IMG.fleeceBlanket), alt: 'A puppy nestled into a cosy woven pet bed' },
    { id: 'rope-tug-toy', url: U(IMG.ropeTugToy), alt: 'A kitten batting at a rope toy on a scratching post' },
    { id: 'catnip-kicker-toy', url: U(IMG.catnipKicker), alt: 'A kitten playing with a ball and toys' },
    { id: 'grain-free-training-treats', url: U(IMG.trainingTreats), alt: 'Bone-shaped dog biscuits laid out on a pink surface' },
    { id: 'peanut-butter-biscuit-bites', url: U(IMG.biscuitBites), alt: 'A golden puppy balancing a biscuit on its nose' },
    { id: 'post-shelter', url: U(IMG.postShelter), alt: 'A happy retriever running through a sunlit field' },
    { id: 'post-bed-size', url: U(IMG.postBedSize), alt: 'A small puppy sitting in a round cushioned bed' },
    { id: 'post-partners', url: U(IMG.postPartners), alt: 'A playful kitten reaching up against a bright background' },
    { id: 'hero-home', url: U(IMG.hero), alt: 'A retriever running joyfully through the surf at the beach' },
    { id: 'band-comfort', url: U(IMG.bandComfort), alt: 'A golden puppy sitting patiently holding a flower' },
    { id: 'band-play', url: U(IMG.bandPlay), alt: 'A chocolate labrador mid-lick, full of energy' },
    { id: 'tile-beds', url: U(IMG.tileBeds), alt: 'A puppy settled into a soft round bed' },
    { id: 'tile-collars', url: U(IMG.tileCollars), alt: 'Several dogs sitting together on their leads' },
    { id: 'tile-toys', url: U(IMG.tileToys), alt: 'A cat playing with a feather wand toy' },
    { id: 'tile-treats', url: U(IMG.tileTreats), alt: 'A spaniel gently taking a treat from a hand' },
];

const assetUrl = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-playful-mission: unknown asset "${id}"`);
    return a.url;
};

// ── Home page sections (the Bombas sequence) ─────────────────────────────────────

/** The full-bleed lifestyle hero — one joyful photograph filling the width, the headline
 *  and two actions in a solid readable panel over it (the `offer_hero` / hero-overlay
 *  shape). The giveback thread is stated once, small, right under the promise. Tenant
 *  content, so it hot-links a real photograph; every class is a NAMED utility so it
 *  survives the stamp into the tenant's stored tree. */
function hero(): Node {
    return el('section', 'relative @container overflow-hidden bg-base-200', {
        children: [
            el('img', 'absolute inset-0 h-full w-full object-cover', {
                attrs: {
                    src: assetUrl('hero-home'),
                    alt: 'A retriever running joyfully through the surf at the beach',
                    loading: 'lazy',
                },
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
                                    'text-4xl font-bold leading-tight tracking-tight text-base-content @3xl:text-6xl',
                                    { text: 'Every wag does some good' }
                                ),
                                el('p', 'text-lg leading-relaxed text-base-content', {
                                    text: 'Rally makes the good stuff for dogs and cats — beds, collars, toys and treats built to last. And for every item you buy, we give one to an animal still waiting for a home. Shop for your pet, and a shelter pet gets looked after too.',
                                }),
                                el('div', 'flex flex-wrap items-center gap-3', {
                                    children: [
                                        el('a', 'btn btn-primary btn-lg', {
                                            attrs: { href: '/shop' },
                                            text: 'Shop the pack',
                                        }),
                                        el('a', 'btn btn-neutral btn-outline btn-lg', {
                                            attrs: { href: '/journal' },
                                            text: 'How the giveback works',
                                        }),
                                    ],
                                }),
                                el('p', 'text-base font-semibold text-secondary', {
                                    text: '1 bought = 1 given. Every single time.',
                                }),
                            ],
                        }),
                    ],
                }
            ),
        ],
    });
}

/** The signature color-block category tiles — four full-bleed photo tiles a visitor taps
 *  straight into a part of the shop (the Bombas top-of-page tile strip). Each tile is the
 *  link: a photo with a solid label bar pinned to the bottom, and the four bars run
 *  through the theme's four band colors (marigold / navy / sage / charcoal) so the strip
 *  reads as the joyful picture-book color Bombas is built on. Named utilities throughout. */
function categoryTiles(): Node {
    const tile = (assetId: string, label: string, barCls: string, inkCls: string, alt: string): Node =>
        el('a', 'group relative flex aspect-square flex-col overflow-hidden rounded-box', {
            attrs: { href: '/shop' },
            children: [
                el('img', 'absolute inset-0 h-full w-full object-cover', {
                    attrs: { src: assetUrl(assetId), alt, loading: 'lazy' },
                }),
                el('div', `relative mt-auto w-full px-4 py-3 ${barCls}`, {
                    children: [
                        el('span', `text-lg font-bold tracking-tight ${inkCls}`, { text: label }),
                    ],
                }),
            ],
        });
    return el('section', 'bg-base-100 @container px-6 py-16', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-10', {
                children: [
                    sectionHead(
                        'Everything your best friend needs',
                        'Four corners of the shop, each stocked with the things that make a good life for a dog or a cat.'
                    ),
                    el('div', 'grid grid-cols-2 gap-6 @2xl:grid-cols-4', {
                        children: [
                            tile('tile-beds', 'Beds & blankets', 'bg-primary', 'text-primary-content', 'A puppy settled into a soft round bed'),
                            tile('tile-collars', 'Collars & leads', 'bg-secondary', 'text-secondary-content', 'Several dogs sitting together on their leads'),
                            tile('tile-toys', 'Toys', 'bg-accent', 'text-accent-content', 'A cat playing with a feather wand toy'),
                            tile('tile-treats', 'Treats & bowls', 'bg-neutral', 'text-neutral-content', 'A spaniel gently taking a treat from a hand'),
                        ],
                    }),
                ],
            }),
        ],
    });
}

/** THE mission band — the brand's whole thesis, stated once, big, on a solid marigold
 *  ground (the "ONE PURCHASED = ONE DONATED" headline). A color band this archetype
 *  EARNS: dark ink on the bright primary carries the joyful giveback energy, and there is
 *  deliberately no button — this beat is the turn in the story, not a call to buy. Named
 *  utilities; the ink resolves from `text-primary-content`. */
function missionBand(): Node {
    return el('section', 'bg-primary text-primary-content @container px-6 py-20', {
        children: [
            el('div', 'mx-auto flex w-full max-w-3xl flex-col items-center gap-6 text-center', {
                children: [
                    el('h2', 'text-4xl font-bold leading-tight tracking-tight @3xl:text-5xl', {
                        text: 'Buy one, give one',
                    }),
                    el('p', 'max-w-xl text-lg leading-relaxed', {
                        text: 'It is the simplest promise we could make. Every bed, collar, toy and bag of treats you buy is matched with one we give to a shelter — a warm bed, a full bowl, a toy for a dog or cat still waiting to be someone\u2019s. You shop; they get looked after. No fine print.',
                    }),
                ],
            }),
        ],
    });
}

/** A mid-page editorial band — a full-bleed photograph carrying a range's intro and a
 *  quiet text link into the shop (the `picture_band` shape). Same overlay-panel shape as
 *  the hero so the warm, friendly words stay readable over whatever photo sits behind
 *  them. */
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
                                el('h2', 'text-3xl font-bold leading-tight tracking-tight text-base-content @3xl:text-4xl', {
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

/** The impact band — the proud, celebratory running total, on a solid deep-navy ground
 *  (the marigold "200 MILLION+ DONATIONS" band, recolored navy so the page carries three
 *  distinct band moods, not one). The big number reads as a stat, the copy hands the
 *  credit back to the shopper, and a marigold CTA pops off the navy. White ink resolves
 *  from `text-secondary-content`. */
function impactBand(): Node {
    return el('section', 'bg-secondary text-secondary-content @container px-6 py-20', {
        children: [
            el('div', 'mx-auto flex w-full max-w-3xl flex-col items-center gap-6 text-center', {
                children: [
                    el('p', 'text-5xl font-bold leading-none tracking-tight @3xl:text-7xl', {
                        text: '512,000',
                    }),
                    el('h2', 'text-2xl font-bold tracking-tight @3xl:text-3xl', {
                        text: 'beds, bowls and meals given — and counting',
                    }),
                    el('p', 'max-w-xl text-lg leading-relaxed', {
                        text: 'Every one of those started with someone buying something for their own pet. That is not our number. It is yours. Thank you for making a shelter animal\u2019s day better without doing anything more than treating your own.',
                    }),
                    el('a', 'btn btn-primary btn-lg', {
                        attrs: { href: '/journal' },
                        text: 'Meet the shelters we support',
                    }),
                ],
            }),
        ],
    });
}

/** The sage "the rest of the good life" band — a solid accent ground with a 3-up of cards
 *  for the corners of the shop the carousels above didn't lead with (the "Comfort Beyond
 *  Socks" sage band). Cards sit on the page surface for legibility; the band's dark ink
 *  resolves from `text-accent-content`. */
function beyondBand(): Node {
    const item = (title: string, text: string, cta: string): Node =>
        card(CARD, [
            cardTitle(title),
            body(text),
            el('a', 'font-semibold text-base-content underline underline-offset-4', {
                attrs: { href: '/shop' },
                text: cta,
            }),
        ]);
    return el('section', 'bg-accent text-accent-content @container px-6 py-20', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-10', {
                children: [
                    el('div', 'flex flex-col gap-3', {
                        children: [
                            el('h2', 'text-3xl font-bold tracking-tight @3xl:text-4xl', {
                                text: 'Everything else the good life needs',
                            }),
                            el('p', 'max-w-2xl text-lg leading-relaxed', {
                                text: 'Mealtime, playtime and the road in between — the small things that turn a house into their home.',
                            }),
                        ],
                    }),
                    gridThree([
                        item(
                            'Bowls & feeding',
                            'Slow-feed and stoneware bowls that keep mealtime tidy and gulped dinners a thing of the past.',
                            'Shop feeding'
                        ),
                        item(
                            'Treats',
                            'Grain-free training treats and biscuit bites made from short, real ingredient lists you can actually read.',
                            'Shop treats'
                        ),
                        item(
                            'Out and about',
                            'Reflective leads and travel-ready kit for the walks, the car rides and the big adventures.',
                            'Shop walking'
                        ),
                    ]),
                ],
            }),
        ],
    });
}

/** The giveback thread told plainly — buy one, give one, watch it add up. Three cards, no
 *  step numbers (RULE #2: no `01 / 02 / 03` markers), so the story carries itself. This is
 *  the pledge from the mission band scaled down into a how-it-actually-works beat. */
function howItWorks(): Node {
    return el('section', 'bg-base-100 @container px-6 py-16', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-10', {
                children: [
                    sectionHead(
                        'How one order helps two animals',
                        'The giveback is not a campaign or a round-up at checkout. It is built into the price of everything we sell.'
                    ),
                    gridThree([
                        card(CARD, [
                            cardTitle('You buy something for your pet'),
                            body('A bed, a collar, a toy, a bag of treats — whatever your dog or cat needs. Nothing extra to opt into.'),
                        ]),
                        card(CARD, [
                            cardTitle('We give one to a shelter'),
                            body('For every item, we hand its match to one of our shelter and rescue partners across the country.'),
                        ]),
                        card(CARD, [
                            cardTitle('An animal in need gets it'),
                            body('A dog or cat still waiting for a home gets a warm bed, a full bowl or a toy of their own — because of your order.'),
                        ]),
                    ]),
                ],
            }),
        ],
    });
}

const HOME: Node[] = [
    hero(),
    categoryTiles(),
    productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'New arrivals' }),
    missionBand(),
    editorialBand({
        heading: 'Comfort worth wagging for',
        lead: 'A good bed is where most of a dog\u2019s day actually happens. Ours use orthopedic foam and bolstered sides for the ones who like to lean, in covers that unzip and go straight in the wash — because real life is muddy.',
        assetId: 'band-comfort',
        alt: 'A golden puppy sitting patiently holding a flower',
        cta: 'Shop beds & blankets',
        href: '/shop',
    }),
    productsBlock({ source: 'commerce.category.beds-blankets', layout: 'carousel', heading: 'Beds & blankets' }),
    impactBand(),
    editorialBand({
        heading: 'Built for the zoomies',
        lead: 'Tough rope tugs, catnip kickers and the toys that survive the third round of fetch. Made to be chased, thrown, wrestled and — eventually — replaced, because a well-loved toy is the whole point.',
        assetId: 'band-play',
        alt: 'A chocolate labrador mid-lick, full of energy',
        cta: 'Shop toys',
        href: '/shop',
    }),
    productsBlock({ source: 'commerce.category.toys', layout: 'carousel', heading: 'Toys they will actually play with' }),
    beyondBand(),
    howItWorks(),
    // footer is `columns` (not `newsletter`), so the page carries its own "join the list"
    // capture — a real submitting form, not a decorative one.
    newsletterSignup(),
];

// ── About + Contact (Rally-voiced) ───────────────────────────────────────────────

const ABOUT: Node[] = [
    el('section', 'bg-base-100 @container px-6 py-20', {
        children: [
            el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-6', {
                children: [
                    el('h1', 'text-4xl font-bold tracking-tight text-base-content @2xl:text-5xl', {
                        text: 'About Rally',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'Rally started with a shelter visit and a simple, uncomfortable thought: the aisle of a pet shop is full of good things, and a few miles away a room full of dogs and cats has almost none. So we built a pet brand around closing that gap — make the products people already want to buy, and give one away for every one we sell.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'The giveback is not a marketing add-on we bolt onto a sale. It is the reason the company exists, and it is baked into the price of everything on the site. Buy a bed, and a shelter dog gets a bed. Buy a bag of treats, and a rescue cat eats. There is no round-up box to tick and no upsell — the good is already done by the time your order ships.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'We are a small team of people who could not walk past. We make gear we would put our own animals on — durable, washable, honestly made — and we partner with shelters and rescues across the country to get the matched half where it is needed most. Every wag, on both ends, does some good.',
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
        intro: 'A sizing question, an order, or a shelter that could use a hand? A real person on the Rally team reads every message and writes back — usually the same day, always like a fellow pet person, never from a script.',
        submitLabel: 'Email the team',
    }),
];

// ── Commerce (Rally — 12 SKUs) ───────────────────────────────────────────────────

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
    // The typed product type (docs/143) — every item here is `apparel`, so the PDP's
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

const money = (dollars: number): number => Math.round(dollars * 100);

const PRODUCTS: Product[] = [
    {
        handle: 'orthopedic-bolster-dog-bed',
        title: 'Orthopedic Bolster Dog Bed',
        description:
            'The bed a dog sinks into and does not want to leave. A thick orthopedic foam base takes the pressure off older hips and hard floors, and raised bolster sides give a chin-rester somewhere to lean. The whole cover unzips and machine-washes, because a bed that cannot be cleaned is a bed you end up throwing away. Buy one, and a shelter dog gets a warm bed of their own.',
        status: 'active',
        productType: 'Beds',
        vendor: 'Rally',
        tags: ['bed', 'orthopedic', 'dog', 'washable', 'giveback'],
        categoryHandles: ['beds-blankets'],
        collectionHandles: ['new-arrivals', 'best-sellers', 'beds-blankets', 'giveback'],
        seoTitle: 'Orthopedic Bolster Dog Bed — washable memory-foam dog bed',
        seoDescription: 'A supportive orthopedic foam dog bed with bolstered sides and a fully machine-washable cover.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'A thick orthopedic foam base that takes the pressure off older hips and hard floors, walled by raised bolster sides for a chin-rester to lean into. The whole cover unzips from the foam and goes in the machine — because a bed you cannot clean is a bed you throw away.',
            fit: 'Small, medium and large, sized for the dog who sprawls as much as the one who curls; measure nose to tail and size up between. Roomy enough to stretch out, walled enough to feel safe.',
            care: 'Unzip the cover and machine-wash warm, tumble low; the foam wipes clean and should never go in the machine. Wash the cover monthly, or the week after a muddy season, whichever comes first.',
            materials: [
                { name: 'Recycled polyester cover', percent: '60%' },
                { name: 'Orthopedic foam base', percent: '38%' },
                { name: 'Zip & hardware', percent: '2%' },
            ],
            origin: 'Made in Vietnam',
        },
        options: [
            { name: 'Size', displayType: 'dropdown', values: [{ value: 'Small' }, { value: 'Medium' }, { value: 'Large' }] },
            { name: 'Color', displayType: 'swatch', values: [{ value: 'Oatmeal' }, { value: 'Slate' }, { value: 'Moss' }, { value: 'Clay' }] },
        ],
        variants: [
            { sku: 'RLY-BED-BOL-S', priceCents: money(89), inventoryPolicy: 'continue', optionValues: { Size: 'Small', Color: 'Oatmeal' } },
            { sku: 'RLY-BED-BOL-M', priceCents: money(119), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: 'Medium', Color: 'Oatmeal' } },
            { sku: 'RLY-BED-BOL-L', priceCents: money(149), inventoryPolicy: 'continue', optionValues: { Size: 'Large', Color: 'Oatmeal' } },
        ],
        images: [{ assetId: 'orthopedic-bolster-dog-bed', isPrimary: true, alt: 'The Orthopedic Bolster Dog Bed' }],
    },
    {
        handle: 'calming-donut-cat-bed',
        title: 'Calming Donut Cat Bed',
        description:
            'A deep, plush ring a cat or small dog can burrow into and disappear. The high faux-fur sides feel like a curled-up litter-mate, which is exactly why anxious pets settle so fast in one. Non-slip base, a cover that washes clean, and a shape that survives being kneaded into oblivion. One bought means one donut bed given to a rescue cat who has never had a soft place to sleep.',
        status: 'active',
        productType: 'Beds',
        vendor: 'Rally',
        tags: ['bed', 'cat', 'calming', 'plush', 'giveback'],
        categoryHandles: ['beds-blankets'],
        collectionHandles: ['best-sellers', 'beds-blankets', 'giveback'],
        seoTitle: 'Calming Donut Cat Bed — plush anti-anxiety pet bed',
        seoDescription: 'A deep, plush faux-fur donut bed that helps anxious cats and small dogs settle and sleep.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'A deep, plush faux-fur ring a cat or small dog can burrow into and disappear. The high sides feel like a curled-up litter-mate, which is why anxious pets settle so fast; a non-slip base keeps it from skating across the floor.',
            fit: 'One size, for cats and small dogs up to about ten kilos; the ring gives so a bigger sprawler can flatten it into a mat. Deep enough to sink into, low enough to climb into.',
            care: 'Machine-wash the whole bed cold on a gentle cycle and tumble low to fluff the pile back up — a dryer ball helps. Brush out loose fur between washes to keep the plush lofty.',
            materials: [
                { name: 'Recycled faux-fur plush', percent: '70%' },
                { name: 'Recycled poly fill', percent: '28%' },
                { name: 'Non-slip base', percent: '2%' },
            ],
            origin: 'Made in China',
        },
        options: [
            { name: 'Color', displayType: 'swatch', values: [{ value: 'Cream' }, { value: 'Grey' }, { value: 'Blush' }] },
        ],
        variants: [
            { sku: 'RLY-BED-DON-CRM', priceCents: money(54), isDefault: true, inventoryPolicy: 'continue', optionValues: { Color: 'Cream' } },
            { sku: 'RLY-BED-DON-GRY', priceCents: money(54), inventoryPolicy: 'continue', optionValues: { Color: 'Grey' } },
            { sku: 'RLY-BED-DON-BLS', priceCents: money(54), inventoryPolicy: 'continue', optionValues: { Color: 'Blush' } },
        ],
        images: [{ assetId: 'calming-donut-cat-bed', isPrimary: true, alt: 'The Calming Donut Cat Bed' }],
    },
    {
        handle: 'cozy-fleece-pet-blanket',
        title: 'Cozy Fleece Pet Blanket',
        description:
            'The blanket that saves your sofa and your sanity. A double-sided sherpa fleece that pets love to nest in and hair brushes straight off, sized to drape a bed, a crate or the good armchair they have already claimed. Warm, washable and quietly indestructible. Buy one, give one — a shelter animal gets a blanket that finally smells like theirs.',
        status: 'active',
        productType: 'Blankets',
        vendor: 'Rally',
        tags: ['blanket', 'fleece', 'washable', 'giveback'],
        categoryHandles: ['beds-blankets'],
        collectionHandles: ['beds-blankets'],
        seoTitle: 'Cozy Fleece Pet Blanket — double-sided sherpa pet blanket',
        seoDescription: 'A warm, washable double-sided sherpa fleece blanket for beds, crates and sofas.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'A double-sided sherpa fleece that pets love to nest in and hair brushes straight off, sized to drape a bed, a crate or the good armchair they have already claimed. Warm, washable and quietly indestructible.',
            fit: 'One generous size that folds down for a crate or opens out over a sofa; light enough to travel and warm enough for a cold floor. Big enough to share, small enough to pack.',
            care: 'Machine-wash cold with like colors and tumble low or air-dry; skip fabric softener so the fleece keeps gripping the hair rather than the sofa. Shake it out and it looks new again.',
            materials: [{ name: 'Recycled sherpa fleece', percent: '100%' }],
            origin: 'Made in China',
        },
        options: [
            { name: 'Color', displayType: 'swatch', values: [{ value: 'Oat' }, { value: 'Charcoal' }, { value: 'Rust' }, { value: 'Sage' }] },
        ],
        variants: [
            { sku: 'RLY-BLK-FLC-OAT', priceCents: money(32), isDefault: true, inventoryPolicy: 'continue', optionValues: { Color: 'Oat' } },
            { sku: 'RLY-BLK-FLC-CHR', priceCents: money(32), inventoryPolicy: 'continue', optionValues: { Color: 'Charcoal' } },
            { sku: 'RLY-BLK-FLC-RST', priceCents: money(32), inventoryPolicy: 'continue', optionValues: { Color: 'Rust' } },
            { sku: 'RLY-BLK-FLC-SGE', priceCents: money(32), inventoryPolicy: 'continue', optionValues: { Color: 'Sage' } },
        ],
        images: [{ assetId: 'cozy-fleece-blanket', isPrimary: true, alt: 'The Cozy Fleece Pet Blanket' }],
    },
    {
        handle: 'everyday-webbing-collar',
        title: 'Everyday Webbing Collar (3-Pack)',
        description:
            'The collar you stop thinking about, three times over. Soft-edged recycled webbing that will not chafe, a quick-release buckle that actually holds, and a welded D-ring that has never once let go. Comes as a three-pack so there is a clean one on while the muddy one dries. Every pack bought puts a collar and an ID tag on a shelter dog waiting to be adopted.',
        status: 'active',
        productType: 'Collars',
        vendor: 'Rally',
        tags: ['collar', 'dog', 'recycled', 'multipack', 'giveback'],
        categoryHandles: ['collars-leads'],
        collectionHandles: ['collars-leads', 'giveback'],
        seoTitle: 'Everyday Webbing Collar 3-Pack — recycled dog collars',
        seoDescription: 'A three-pack of soft recycled-webbing dog collars with quick-release buckles and welded D-rings.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'Soft-edged recycled webbing that will not chafe, a quick-release buckle that actually holds, and a welded D-ring that has never once let go. A three-pack, so there is a clean one on while the muddy one dries.',
            fit: 'Small, medium and large, each fully adjustable across a wide range; measure the neck and leave two fingers of room. Three collars in mixed colors per pack.',
            care: 'Machine-wash in a laundry bag or scrub by hand and air-dry; the webbing shrugs off mud, rain and the occasional swim. Check the stitching and the D-ring now and then, as you would any collar.',
            materials: [
                { name: 'Recycled PET webbing', percent: '88%' },
                { name: 'Metal hardware', percent: '10%' },
                { name: 'Buckle', percent: '2%' },
            ],
            origin: 'Made in Vietnam',
        },
        options: [
            { name: 'Size', displayType: 'dropdown', values: [{ value: 'Small' }, { value: 'Medium' }, { value: 'Large' }] },
        ],
        variants: [
            { sku: 'RLY-COL-EVR-S', priceCents: money(38), inventoryPolicy: 'continue', optionValues: { Size: 'Small' } },
            { sku: 'RLY-COL-EVR-M', priceCents: money(38), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: 'Medium' } },
            { sku: 'RLY-COL-EVR-L', priceCents: money(38), inventoryPolicy: 'continue', optionValues: { Size: 'Large' } },
        ],
        images: [{ assetId: 'everyday-webbing-collar', isPrimary: true, alt: 'The Everyday Webbing Collar 3-Pack' }],
    },
    {
        handle: 'no-pull-adjustable-harness',
        title: 'No-Pull Adjustable Harness',
        description:
            'Walks that stop being a tug-of-war. A front-clip design gently turns a lunging dog back toward you instead of letting them haul, and five points of adjustment mean it actually fits the dog you have — deep-chested, barrel-bodied or somewhere in between. Padded where it presses, breathable where it counts, reflective for the dark mornings. One sold, one given to a rescue dog learning to walk on a lead for the first time.',
        status: 'active',
        productType: 'Harnesses',
        vendor: 'Rally',
        tags: ['harness', 'no-pull', 'dog', 'reflective', 'giveback'],
        categoryHandles: ['collars-leads'],
        collectionHandles: ['new-arrivals', 'best-sellers', 'collars-leads'],
        seoTitle: 'No-Pull Adjustable Harness — front-clip dog harness',
        seoDescription: 'A padded front-clip no-pull dog harness with five-point adjustment and reflective trim.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'A front-clip design that gently turns a lunging dog back toward you instead of letting them haul, padded where it presses and breathable where it counts, with reflective trim for the dark mornings.',
            fit: 'XS through XL with five points of adjustment, so it fits the deep-chested, the barrel-bodied and everything between; measure the chest at its widest. Snug enough not to twist, loose enough for two fingers.',
            care: 'Machine-wash cold in a laundry bag and air-dry; do not tumble, which can warp the buckles over time. Rinse off salt and sand after a beach day so the hardware stays smooth.',
            materials: [
                { name: 'Recycled polyester', percent: '74%' },
                { name: 'Foam padding', percent: '20%' },
                { name: 'Reflective trim & hardware', percent: '6%' },
            ],
            origin: 'Made in Vietnam',
        },
        options: [
            { name: 'Size', displayType: 'dropdown', values: [{ value: 'XS' }, { value: 'S' }, { value: 'M' }, { value: 'L' }, { value: 'XL' }] },
        ],
        variants: [
            { sku: 'RLY-HAR-NPL-XS', priceCents: money(46), inventoryPolicy: 'continue', optionValues: { Size: 'XS' } },
            { sku: 'RLY-HAR-NPL-S', priceCents: money(46), inventoryPolicy: 'continue', optionValues: { Size: 'S' } },
            { sku: 'RLY-HAR-NPL-M', priceCents: money(46), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: 'M' } },
            { sku: 'RLY-HAR-NPL-L', priceCents: money(46), inventoryPolicy: 'continue', optionValues: { Size: 'L' } },
            { sku: 'RLY-HAR-NPL-XL', priceCents: money(46), inventoryPolicy: 'continue', optionValues: { Size: 'XL' } },
        ],
        images: [{ assetId: 'no-pull-harness', isPrimary: true, alt: 'The No-Pull Adjustable Harness' }],
    },
    {
        handle: 'reflective-city-lead',
        title: 'Reflective City Lead',
        description:
            'A lead built for real streets. A full reflective weave lights up in headlights the whole length, a padded neoprene handle saves your hand on the pullier days, and an extra traffic handle down low pulls a dog in close at a crossing. Rated well past the weight of the dog on the end of it. Buy one, and a shelter gets a lead to walk a dog who rarely gets to go outside.',
        status: 'active',
        productType: 'Leads',
        vendor: 'Rally',
        tags: ['lead', 'leash', 'reflective', 'dog', 'giveback'],
        categoryHandles: ['collars-leads'],
        collectionHandles: ['new-arrivals', 'collars-leads'],
        seoTitle: 'Reflective City Lead — padded reflective dog leash',
        seoDescription: 'A fully reflective dog lead with a padded handle and a low traffic handle for busy streets.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'A full reflective weave that lights up in headlights the whole length, a padded neoprene handle that saves your hand on the pullier days, and an extra traffic handle down low to pull a dog in close at a crossing. Rated well past the weight of the dog on the end of it.',
            fit: 'A standard walking length with two handles — one at the end, one at the collar — for street control; the trigger clip suits any collar or harness ring. Long enough to relax, short enough to hold.',
            care: 'Machine-wash in a bag or scrub by hand and hang to dry; the reflective weave keeps its shine through years of walks. Wipe the clip and check the stitching at the handle from time to time.',
            materials: [
                { name: 'Reflective nylon webbing', percent: '82%' },
                { name: 'Neoprene handle', percent: '14%' },
                { name: 'Metal clip', percent: '4%' },
            ],
            origin: 'Made in Vietnam',
        },
        options: [
            { name: 'Color', displayType: 'swatch', values: [{ value: 'Marigold' }, { value: 'Navy' }, { value: 'Sage' }, { value: 'Coral' }, { value: 'Charcoal' }] },
        ],
        variants: [
            { sku: 'RLY-LED-REF-MAR', priceCents: money(29), isDefault: true, inventoryPolicy: 'continue', optionValues: { Color: 'Marigold' } },
            { sku: 'RLY-LED-REF-NVY', priceCents: money(29), inventoryPolicy: 'continue', optionValues: { Color: 'Navy' } },
            { sku: 'RLY-LED-REF-SGE', priceCents: money(29), inventoryPolicy: 'continue', optionValues: { Color: 'Sage' } },
            { sku: 'RLY-LED-REF-CRL', priceCents: money(29), inventoryPolicy: 'continue', optionValues: { Color: 'Coral' } },
            { sku: 'RLY-LED-REF-CHR', priceCents: money(29), inventoryPolicy: 'continue', optionValues: { Color: 'Charcoal' } },
        ],
        images: [{ assetId: 'reflective-city-lead', isPrimary: true, alt: 'The Reflective City Lead' }],
    },
    {
        handle: 'stainless-slow-feed-bowl',
        title: 'Stainless Slow-Feed Bowl',
        description:
            'For the dog who inhales dinner in nine seconds flat. A maze of stainless ridges turns a gulped meal into a ten-minute puzzle, which is easier on the stomach and a lot easier on your carpet afterwards. One piece of food-grade steel — no plastic to scratch and harbour, no dishwasher it cannot handle. Every one bought feeds a shelter animal from a matching bowl.',
        status: 'active',
        productType: 'Bowls',
        vendor: 'Rally',
        tags: ['bowl', 'slow-feed', 'stainless', 'giveback'],
        categoryHandles: ['bowls-feeding'],
        collectionHandles: ['giveback'],
        seoTitle: 'Stainless Slow-Feed Bowl — anti-gulp dog bowl',
        seoDescription: 'A one-piece stainless steel slow-feed bowl that turns a gulped meal into a ten-minute puzzle.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'One piece of food-grade stainless steel pressed into a maze of ridges that turns a gulped meal into a ten-minute puzzle — easier on the stomach and a lot easier on your carpet. No plastic to scratch and harbour, no coating to wear off.',
            fit: 'A single bowl sized for a medium dog and a full meal; the ridges suit dry food best. Sits low and wide so it does not tip when an eager eater goes at it.',
            care: 'Top-rack dishwasher-safe, or a quick scrub in hot soapy water; stainless will not stain, hold odour or leach. Dry it after washing to keep it spot-free — that is the only upkeep it asks.',
            materials: [{ name: 'Food-grade stainless steel', percent: '100%' }],
            origin: 'Made in China',
        },
        variants: [{ sku: 'RLY-BWL-SLW', priceCents: money(24), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'stainless-slow-feed-bowl', isPrimary: true, alt: 'The Stainless Slow-Feed Bowl' }],
    },
    {
        handle: 'ceramic-bowl-set',
        title: 'Stoneware Bowl Set (2)',
        description:
            'The bowls you would actually leave out on the kitchen floor. A pair of hand-glazed stoneware dishes — one for food, one for water — heavy enough that a determined eater cannot skate them across the tiles, with a reactive glaze that means no two sets are quite the same. Dishwasher-safe and built to outlast a few enthusiastic dinners a day. One set bought, one given to a rescue.',
        status: 'active',
        productType: 'Bowls',
        vendor: 'Rally',
        tags: ['bowl', 'ceramic', 'stoneware', 'set', 'giveback'],
        categoryHandles: ['bowls-feeding'],
        collectionHandles: ['giveback'],
        seoTitle: 'Stoneware Bowl Set — hand-glazed ceramic pet bowls',
        seoDescription: 'A weighted, hand-glazed stoneware pet bowl set — one for food, one for water — dishwasher-safe.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'A pair of hand-glazed stoneware dishes — one for food, one for water — heavy enough that a determined eater cannot skate them across the tiles, with a reactive glaze that means no two sets are quite the same.',
            fit: 'Two matching bowls sized for everyday feeding of a small-to-medium pet; the weight is the point, so they stay put. Wide and shallow, kind to a flat-faced breed.',
            care: 'Dishwasher-safe and built to outlast a few enthusiastic dinners a day; a hand-wash keeps the reactive glaze at its brightest. Check the rim for chips over the years, as with any ceramic.',
            materials: [
                { name: 'Stoneware clay', percent: '90%' },
                { name: 'Reactive glaze', percent: '10%' },
            ],
            origin: 'Made in Portugal',
        },
        options: [
            { name: 'Color', displayType: 'swatch', values: [{ value: 'Marigold' }, { value: 'Sage' }, { value: 'Speckled Cream' }] },
        ],
        variants: [
            { sku: 'RLY-BWL-SET-MAR', priceCents: money(42), isDefault: true, inventoryPolicy: 'continue', optionValues: { Color: 'Marigold' } },
            { sku: 'RLY-BWL-SET-SGE', priceCents: money(42), inventoryPolicy: 'continue', optionValues: { Color: 'Sage' } },
            { sku: 'RLY-BWL-SET-CRM', priceCents: money(42), inventoryPolicy: 'continue', optionValues: { Color: 'Speckled Cream' } },
        ],
        images: [{ assetId: 'ceramic-bowl-set', isPrimary: true, alt: 'The Stoneware Bowl Set' }],
    },
    {
        handle: 'rope-tug-toy',
        title: 'Rope Tug Toy (3-Pack)',
        description:
            'The toy that survives the game it was made for. Thick, tightly-braided cotton rope in three shapes for three moods — a straight tug, a knotted ball, a ring for two dogs to argue over — and the loose fibres actually help floss teeth as they chew. Washable, and when one finally gives up there are two more in the pack. Buy one, give one to a shelter dog with nothing to play with.',
        status: 'active',
        productType: 'Toys',
        vendor: 'Rally',
        tags: ['toy', 'rope', 'tug', 'dog', 'multipack', 'giveback'],
        categoryHandles: ['toys'],
        collectionHandles: ['toys', 'giveback'],
        seoTitle: 'Rope Tug Toy 3-Pack — braided cotton dog rope toys',
        seoDescription: 'A three-pack of tough braided cotton rope tug toys that help floss teeth as dogs chew.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'Thick, tightly-braided cotton rope in three shapes for three moods — a straight tug, a knotted ball, a ring for two dogs to argue over — and the loose fibres actually help floss teeth as they chew. Washable, with two more in the pack when one gives up.',
            fit: 'A three-pack sized for medium-to-large dogs and proper tug-of-war; supervise a heavy chewer, as no rope is truly indestructible. Long enough for two-handed tug, chunky enough to grip.',
            care: 'Machine-wash the rope in a bag and air-dry, or wet it and freeze it for a teething puppy; trim any long frays before they get swallowed. Retire a toy once it is chewed down to a nub.',
            materials: [{ name: 'Cotton rope', percent: '100%' }],
            origin: 'Made in China',
        },
        variants: [{ sku: 'RLY-TOY-ROP', priceCents: money(19), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'rope-tug-toy', isPrimary: true, alt: 'The Rope Tug Toy 3-Pack' }],
    },
    {
        handle: 'catnip-kicker-toy',
        title: 'Catnip Kicker Toy (2-Pack)',
        description:
            'The one cat toy that actually gets used. A long, huggable kicker a cat can wrap all four legs around and bunny-kick to their heart\u2019s content, stuffed with potent, single-origin catnip that keeps its kick. Tough double-stitched seams for the serious wrestlers, and two in every pack because one always ends up under the sofa. One bought means one given to a shelter cat who needs the enrichment most.',
        status: 'active',
        productType: 'Toys',
        vendor: 'Rally',
        tags: ['toy', 'cat', 'catnip', 'kicker', 'multipack', 'giveback'],
        categoryHandles: ['toys'],
        collectionHandles: ['new-arrivals', 'toys'],
        seoTitle: 'Catnip Kicker Toy 2-Pack — cat kicker toys with catnip',
        seoDescription: 'A two-pack of double-stitched catnip kicker toys built for serious bunny-kicking cats.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'A long, huggable kicker a cat can wrap all four legs around and bunny-kick with the back feet, stuffed with potent single-origin catnip that keeps its kick. Tough double-stitched seams for the serious wrestlers.',
            fit: 'A two-pack, because one always ends up under the sofa; sized for a cat to grab, hug and kick. Long enough for the back legs to get to work, light enough to bat across a room.',
            care: 'Spot-clean with a damp cloth and refresh the kick by scrunching the toy; the seams take a wash in a bag if it gets grubby. Store it away between play sessions so the catnip stays potent.',
            materials: [
                { name: 'Cotton canvas shell', percent: '62%' },
                { name: 'Recycled poly fill', percent: '30%' },
                { name: 'Dried catnip', percent: '8%' },
            ],
            origin: 'Made in Canada',
        },
        variants: [{ sku: 'RLY-TOY-KIK', priceCents: money(16), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'catnip-kicker-toy', isPrimary: true, alt: 'The Catnip Kicker Toy 2-Pack' }],
    },
    {
        handle: 'grain-free-training-treats',
        title: 'Grain-Free Training Treats',
        description:
            'The treats you can hand out all session without a second thought. Small, soft, low-calorie morsels a dog will work hard for, made from a short list of real ingredients — a named meat first, no grain, no fillers you cannot pronounce. Sized for fast, repeatable rewards so a training session stays a training session. Every bag bought feeds a shelter animal too.',
        status: 'active',
        productType: 'Treats',
        vendor: 'Rally',
        tags: ['treats', 'training', 'grain-free', 'dog', 'giveback'],
        categoryHandles: ['treats'],
        collectionHandles: ['new-arrivals', 'giveback'],
        seoTitle: 'Grain-Free Training Treats — soft low-calorie dog treats',
        seoDescription: 'Small, soft, grain-free training treats made from a short real-ingredient list, meat first.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'Small, soft, low-calorie morsels a dog will work hard for, made from a short list of real ingredients — a named meat first, no grain, no fillers you cannot pronounce. Sized for fast, repeatable rewards so a session stays a session.',
            fit: 'Bite-sized and soft enough to tear smaller for a puppy; suits all life stages as a training reward rather than a meal. Feed as part of the daily ration, not on top of it.',
            care: 'Reseal the bag after each session and store somewhere cool and dry; use within the date on the pack once opened. Keep out of a hot car, where any soft treat sweats and spoils.',
            materials: [
                { name: 'Named meat', percent: '72%' },
                { name: 'Vegetables & pulses', percent: '22%' },
                { name: 'Natural binders', percent: '6%' },
            ],
            origin: 'Made in the USA',
        },
        options: [
            { name: 'Flavour', displayType: 'dropdown', values: [{ value: 'Chicken' }, { value: 'Salmon' }, { value: 'Beef' }] },
        ],
        variants: [
            { sku: 'RLY-TRT-TRN-CHK', priceCents: money(14), isDefault: true, inventoryPolicy: 'continue', optionValues: { Flavour: 'Chicken' } },
            { sku: 'RLY-TRT-TRN-SAL', priceCents: money(14), inventoryPolicy: 'continue', optionValues: { Flavour: 'Salmon' } },
            { sku: 'RLY-TRT-TRN-BEF', priceCents: money(14), inventoryPolicy: 'continue', optionValues: { Flavour: 'Beef' } },
        ],
        images: [{ assetId: 'grain-free-training-treats', isPrimary: true, alt: 'The Grain-Free Training Treats' }],
    },
    {
        handle: 'peanut-butter-biscuit-bites',
        title: 'Peanut Butter Biscuit Bites',
        description:
            'A proper baked biscuit for the big moments — coming when called, sitting for a stranger, surviving a bath. Oven-baked in small batches with real peanut butter and pumpkin, no xylitol, no mystery. Crunchy enough to be a treat a dog takes seriously, and honestly good enough that you will want to know what is in them (it is on the bag). One bag bought, one given to a rescue.',
        status: 'active',
        productType: 'Treats',
        vendor: 'Rally',
        tags: ['treats', 'biscuit', 'baked', 'dog', 'giveback'],
        categoryHandles: ['treats'],
        collectionHandles: ['giveback'],
        seoTitle: 'Peanut Butter Biscuit Bites — baked peanut butter dog biscuits',
        seoDescription: 'Small-batch oven-baked peanut butter and pumpkin dog biscuits, no xylitol, no fillers.',
        productTypeKey: 'apparel',
        attributes: {
            fabric:
                'A proper baked biscuit for the big moments — oven-baked in small batches with real peanut butter and pumpkin, no xylitol, no mystery. Crunchy enough that a dog takes it seriously, and honestly good enough that you will want to read the label (it is on the bag).',
            fit: 'A crunchy bite for a real reward rather than rapid-fire training; snappable in half for a small dog. An occasional treat, fed within the daily calorie budget.',
            care: 'Keep the bag sealed in a cool, dry cupboard so the biscuits stay crisp — they soften if left open. Use within the best-before date, and toss any that lose their snap.',
            materials: [
                { name: 'Wholegrain oats & flour', percent: '60%' },
                { name: 'Peanut butter', percent: '26%' },
                { name: 'Pumpkin & egg', percent: '14%' },
            ],
            origin: 'Made in the USA',
        },
        variants: [{ sku: 'RLY-TRT-BIS', priceCents: money(12), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'peanut-butter-biscuit-bites', isPrimary: true, alt: 'The Peanut Butter Biscuit Bites' }],
    },
];

const COMMERCE = {
    categories: [
        { handle: 'beds-blankets', name: 'Beds & Blankets', description: 'Orthopedic beds, calming donuts and washable blankets.', featured: true },
        { handle: 'collars-leads', name: 'Collars & Leads', description: 'Collars, no-pull harnesses and reflective leads.', featured: true },
        { handle: 'toys', name: 'Toys', description: 'Rope tugs, catnip kickers and the toys that survive.', featured: true },
        { handle: 'bowls-feeding', name: 'Bowls & Feeding', description: 'Slow-feed and stoneware bowls for tidier mealtimes.', featured: false },
        { handle: 'treats', name: 'Treats', description: 'Grain-free training treats and baked biscuit bites.', featured: false },
    ],
    collections: [
        {
            handle: 'new-arrivals',
            name: 'New Arrivals',
            description: 'The latest additions to the pack.',
            type: 'manual',
            featured: true,
            productHandles: ['orthopedic-bolster-dog-bed', 'no-pull-adjustable-harness', 'reflective-city-lead', 'catnip-kicker-toy', 'grain-free-training-treats'],
        },
        {
            handle: 'best-sellers',
            name: 'Best Sellers',
            description: 'The ones that keep tails wagging.',
            type: 'manual',
            featured: false,
            productHandles: ['orthopedic-bolster-dog-bed', 'calming-donut-cat-bed', 'no-pull-adjustable-harness', 'grain-free-training-treats'],
        },
        {
            handle: 'beds-blankets',
            name: 'Beds & Blankets',
            description: 'Somewhere soft to land, for pets on both ends of the giveback.',
            type: 'manual',
            featured: false,
            productHandles: ['orthopedic-bolster-dog-bed', 'calming-donut-cat-bed', 'cozy-fleece-pet-blanket'],
        },
        {
            handle: 'collars-leads',
            name: 'Collars & Leads',
            description: 'The kit that gets a dog out the door and home again.',
            type: 'manual',
            featured: false,
            productHandles: ['everyday-webbing-collar', 'no-pull-adjustable-harness', 'reflective-city-lead'],
        },
        {
            handle: 'toys',
            name: 'Toys',
            description: 'Built to be chased, thrown and wrestled.',
            type: 'manual',
            featured: false,
            productHandles: ['rope-tug-toy', 'catnip-kicker-toy'],
        },
        {
            handle: 'giveback',
            name: 'The Giveback Edit',
            description: 'The pieces that put the most into a shelter with every order.',
            type: 'manual',
            featured: false,
            productHandles: ['orthopedic-bolster-dog-bed', 'calming-donut-cat-bed', 'everyday-webbing-collar', 'stainless-slow-feed-bowl', 'ceramic-bowl-set', 'rope-tug-toy', 'grain-free-training-treats', 'peanut-butter-biscuit-bites'],
        },
    ],
    products: PRODUCTS,
};

// ── Content (the Rally Journal) ──────────────────────────────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });

const CONTENT = [
    {
        typeKey: 'blog_post',
        slug: 'how-your-order-feeds-a-shelter',
        status: 'published',
        body: {
            title: 'How your order actually feeds a shelter',
            excerpt: 'Buy one, give one is easy to say on a banner. Here is what really happens between your checkout and a shelter dog getting a bed.',
            featuredImage: { $asset: 'post-shelter' },
            body: {
                type: 'doc',
                content: [
                    para('When you buy something from Rally, a second, identical item is set aside that same day. Not a donation to a fund, not a percentage of profit that gets calculated at the end of the quarter — the actual product, matched one for one, ready to go where it is needed.'),
                    h2('The match leaves with the delivery'),
                    para('We batch the given half by region and send it out on the same freight runs that restock the shops and shelters near you. A bed you buy in March is a bed a shelter dog is sleeping on by April — the giveback moves at the speed of the business, not on a once-a-year cheque presentation.'),
                    h2('Shelters tell us what they need'),
                    para('We do not guess. Our partner shelters and rescues send us their actual shortlists — more medium beds this month, always more blankets, kitten toys before the spring litters arrive — and we match the giving to the need instead of dumping whatever we have spare. It is less tidy for us and far more useful for them.'),
                    para('So the next time you order a collar for your own dog, know that the story does not end at your door. It ends at a kennel a few counties over, where a dog waiting to be adopted just got a collar of their own.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'choosing-the-right-bed-size',
        status: 'published',
        body: {
            title: 'Choosing the right bed size for your dog',
            excerpt: 'A bed that is too small gets ignored and a bed that is too big never feels safe. A quick, honest guide to getting it right the first time.',
            featuredImage: { $asset: 'post-bed-size' },
            body: {
                type: 'doc',
                content: [
                    para('The single most common reason a dog snubs a perfectly good bed is that it does not fit the way they actually sleep — and dogs are surprisingly particular about it. A minute of watching your dog nap tells you almost everything you need to know before you buy.'),
                    h2('Measure the sleep, not just the dog'),
                    para('Watch how your dog settles. A curler — nose to tail in a tight spiral — wants a round donut bed with high sides to lean into. A sprawler who flops out flat needs a rectangular mat with room to stretch a leg off every edge. Measure them nose to tail-base while they lie in their favourite position, then add about a foot for a bed that fits the shape they make, not the dog standing up.'),
                    h2('When in doubt, size up'),
                    para('A bed a size too big is a minor waste of floor space. A bed a size too small is a bed your dog quietly decides is not for them, and no amount of coaxing changes their mind. If your dog is between sizes, or still a growing puppy, take the larger one — they will grow into it and settle into it either way.'),
                    para('Get the fit right and a bed stops being decor you tripped over and becomes the place your dog chooses to spend half their life. That is the whole point of buying a good one.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'meet-the-shelters-we-support',
        status: 'published',
        body: {
            title: 'Meet the shelters we support',
            excerpt: 'The giveback only works because of the people on the other end of it. A look at the partners who turn your orders into warm beds and full bowls.',
            featuredImage: { $asset: 'post-partners' },
            body: {
                type: 'doc',
                content: [
                    para('It is easy to talk about "shelters" as one big abstract cause. In reality the giveback lands with a specific, hard-working handful of them — small municipal pounds, breed-specific rescues, a foster network run out of somebody\u2019s spare room — and every one of them is why the promise is more than a slogan.'),
                    h2('We choose partners who need the help, not the ones who look good'),
                    para('The shelters we work with are rarely the ones with the slick websites and the big donor lists. They are the underfunded county facilities and the volunteer rescues doing enormous work on almost nothing. That is deliberate: a donated bed matters far more in a kennel that could not otherwise afford one.'),
                    h2('Every partner is a real, named place'),
                    para('We publish who they are and, roughly, what has gone to each — so many beds, so many bags of food, so many toys — because a giveback you cannot audit is just marketing. Our partners hold us to the promise, and we would rather you could too.'),
                    para('When you shop, you are not giving to Rally. You are giving through us, to them. They do the hard part; your order just makes it possible.'),
                ],
            },
        },
    },
];

// ── Product detail (the giveback PDP) + Shop ─────────────────────────────────────
// Bombas' PDP pairs the product with the pledge: a big image beside a warm buy column
// (breadcrumb, heavy title, price, description, Add-to-Cart) with the "N bought = N
// donated" giveback microline pinned directly under the button, then friendly
// give-back / features / materials & care / shipping detail blocks (DESIGN §4 PDP
// anatomy + §6 mapping). Ported to Rally in the bright `romp` theme: the same two-column
// spread, dark-ink-on-marigold carrying the giveback energy the way the mission band
// does. Bound fields come from the shared PDP kit (correct `repeat('product')` scope +
// `item.*` binds); the layout + static brand copy are ours.
//
// CONTRAST NOTE. Marigold `primary` is a FILL color on this theme — as TEXT on the cream
// page it goes pale (the trap this bundle already hit once). So the giveback emphasis is
// carried by a SOLID marigold callout whose ink resolves from `text-primary-content` (dark
// ink, AA-clear), never `text-primary` prose; every readable line stays on `text-base-content`.

/** The signature giveback microline — Bombas' "N bought = N donated" beat, pinned under
 *  Add-to-Cart. A solid marigold callout so the pledge pops off the cream buy column; its
 *  ink resolves from `text-primary-content` (dark-on-gold, AA-clear), the readable-fill way
 *  to carry brand energy without pale `text-primary` prose. */
function givebackMicroline(): Node {
    return el('div', 'flex flex-col gap-1 rounded-box bg-primary px-5 py-4 text-primary-content', {
        children: [
            el('p', 'text-lg font-bold tracking-tight', { text: '1 bought = 1 given' }),
            el('p', 'text-base leading-relaxed', {
                text: 'Add this to your cart and its match is already on its way to a shelter — a warm bed, a full bowl, a toy of their own for an animal still waiting for a home. No box to tick, no round-up at checkout. The good is done the moment you buy.',
            }),
        ],
    });
}

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the big product image on a soft cream tile. Right: the warm buy column — breadcrumb,
 *  the page's one `<h1>`, price, description, Add-to-Cart, the giveback microline, then the
 *  give-back / features / materials & care / shipping detail stack. */
function pdpBuyRegion(): Node {
    return el('section', 'bg-base-100 @container px-6 py-12 @3xl:py-16', {
        children: [
            el('div', 'mx-auto grid w-full max-w-6xl gap-10 @3xl:grid-cols-2 @3xl:gap-16', {
                children: [
                    // The big product image (one bound primary — the storefront fills it per product).
                    pdpImage('aspect-square w-full rounded-box border border-base-300 bg-base-200 object-cover'),
                    // The warm buy column.
                    el('div', 'flex flex-col gap-6 @3xl:py-4', {
                        children: [
                            el('div', 'flex flex-col gap-3', {
                                children: [
                                    // Breadcrumb/label above the title — a plain <p>, so the product title stays
                                    // the page's one <h1>.
                                    el('p', 'text-sm font-semibold uppercase tracking-widest text-base-content', {
                                        text: 'Rally · Buy one, give one',
                                    }),
                                    pdpTitle(
                                        'h1',
                                        'text-4xl font-bold leading-tight tracking-tight text-base-content @3xl:text-5xl'
                                    ),
                                    pdpPriceRow({
                                        priceClass: 'text-2xl font-bold text-base-content',
                                        compareClass: 'text-lg text-base-content line-through',
                                        rowClass: 'flex items-baseline gap-4',
                                    }),
                                    // A real low-stock signal on the navy secondary chip (kept distinct from the
                                    // marigold giveback callout below) — shown only when the routed product is
                                    // genuinely running low, never fabricated scarcity.
                                    pdpStockBadge({
                                        className:
                                            'inline-flex w-fit items-center gap-2 rounded-box bg-secondary px-3 py-1 text-sm font-bold tracking-tight text-secondary-content',
                                        label: 'Low stock',
                                    }),
                                ],
                            }),
                            pdpDescription('text-lg leading-relaxed text-base-content'),
                            // Qty + Add to cart — the real form (Add-to-Cart rides secondary navy in `romp`).
                            addToCartForm(),
                            // The Bombas giveback microline, pinned straight under the button.
                            givebackMicroline(),
                            // The product's OWN typed attributes (fabric / fit / care / materials / origin),
                            // repeated from `attributeSections` — real per-product copy, not a hardcoded stack.
                            // (The giveback is carried once, above, by the marigold microline.)
                            pdpAttributes({
                                containerClass: 'mt-2 flex flex-col gap-5',
                                sectionClass: 'flex flex-col gap-2 border-t border-base-300 pt-5',
                                labelTag: 'h2',
                                labelClass: 'text-lg font-bold tracking-tight text-base-content',
                                valueClass: 'text-base leading-relaxed text-base-content',
                                rowClass:
                                    'flex items-baseline justify-between gap-4 border-b border-base-200 pb-1',
                                rowLabelClass: 'text-base font-semibold text-base-content',
                                rowValueClass: 'text-base text-base-content',
                            }),
                            // Shipping & returns — LINKS to the shop's real legal pages, never reprinted copy.
                            pdpPolicyLinks({
                                className:
                                    'flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-base-300 pt-5 text-base font-bold tracking-tight text-base-content',
                                linkClass: 'underline underline-offset-4',
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });
}

/** The full giveback PDP — the buy region above a warm "More from the pack" carousel of
 *  same-collection products (`commerce.related`, the shared kit's default cross-sell). */
const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'More from the pack' });

/** The Shop page's own header, shown ABOVE the faceted PLP core the harness appends. A warm
 *  cream intro — a heavy playful title + a single friendly line — with the giveback stated
 *  once as a solid marigold callout (readable-fill, `text-primary-content` ink), the way the
 *  home page paces its color bands. In place of the generic "Shop / Everything we have". */
const SHOP: Node[] = [
    el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-5', {
                children: [
                    el(
                        'h1',
                        'text-4xl font-bold leading-tight tracking-tight text-base-content @3xl:text-6xl',
                        { text: 'Shop the whole pack' }
                    ),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Beds, collars, harnesses, toys, bowls and treats — the good stuff for dogs and cats, filtered and sorted however you like. Made to last, made to be used, and matched one-for-one to a shelter animal with every order.',
                    }),
                    el('div', 'flex w-fit flex-col gap-1 rounded-box bg-primary px-5 py-4 text-primary-content', {
                        children: [
                            el('p', 'text-lg font-bold tracking-tight', { text: '1 bought = 1 given' }),
                            el('p', 'text-base leading-relaxed', {
                                text: 'Every single thing on this page sends its match to a shelter — no fine print, no upsell.',
                            }),
                        ],
                    }),
                ],
            }),
        ],
    }),
];

// ── The remaining functional pages (bespoke framing over the shared cores) ───────
// Collections / Cart / Search each get Rally's own warm masthead above the pinned,
// shoppable core the harness appends; the Journal index gets its own masthead over the
// shared linkable post grid. Same bright cream-ground voice as the rest of the site —
// heavy playful title over one friendly line — with the give-one thread carried on a
// SOLID marigold callout (readable `text-primary-content` ink) wherever it earns a beat,
// never pale `text-primary` prose.

/** A plain page masthead — an `<h1>` + one intro line on the warm cream ground. Used for
 *  Collections / Search / Journal, which each want a friendly header over their core. */
function pageMasthead(heading: string, lead: string): Node {
    return el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
                children: [
                    el(
                        'h1',
                        'text-4xl font-bold leading-tight tracking-tight text-base-content @3xl:text-6xl',
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
        'Shop the pack',
        'Every corner of the shop, grouped the way you actually shop for a pet — beds and blankets, collars and leads, toys, and the giveback edit that puts the most into a shelter with every order. Pick a pack and dive in.'
    ),
];

const SEARCH: Node[] = [
    pageMasthead(
        'Find it fast',
        'After a specific size, a color, a treat your dog goes daft for? Search the whole shop and the Journal below — and remember, whatever you turn up, buying it sends a match to a shelter animal too.'
    ),
];

const JOURNAL: Node[] = [
    el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-20', {
        children: [
            el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-4', {
                children: [
                    el(
                        'h1',
                        'text-4xl font-bold leading-tight tracking-tight text-base-content @3xl:text-6xl',
                        { text: 'Tails & tips' }
                    ),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'The Rally Journal — how the giveback actually reaches a shelter, honest advice for living with a dog or a cat, and the rescue partners who turn your orders into warm beds and full bowls.',
                    }),
                ],
            }),
        ],
    }),
];

/** The Cart page's own header — a warm reassurance band above the pinned cart core, in
 *  place of the generic "Your cart" heading. Free returns and free shipping first, then the
 *  give-one thread on a solid marigold callout (readable `text-primary-content` ink) — the
 *  reminder that a shopper's checkout does double duty, stated once where it lands hardest. */
const CART: Node[] = [
    el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-5', {
                children: [
                    el(
                        'h1',
                        'text-4xl font-bold leading-tight tracking-tight text-base-content @3xl:text-5xl',
                        { text: 'Your cart' }
                    ),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Free carbon-neutral shipping over $50 and 60 days to change your mind — take your time. Everything here is made to be used hard and washed often, and we would put every piece on our own animals.',
                    }),
                    el('div', 'flex w-fit flex-col gap-1 rounded-box bg-primary px-5 py-4 text-primary-content', {
                        children: [
                            el('p', 'text-lg font-bold tracking-tight', {
                                text: 'Every item here gives one to a shelter',
                            }),
                            el('p', 'text-base leading-relaxed', {
                                text: 'The moment you check out, a matching bed, bowl, collar or toy is on its way to an animal still waiting for a home. No box to tick, no round-up — the good is already done.',
                            }),
                        ],
                    }),
                ],
            }),
        ],
    }),
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
    slug: 'playful-mission',
    key: 'sparx-playful-mission',
    name: 'Playful Mission',
    summary:
        'A playful, colorful, mission-driven DTC storefront for a give-back brand — a warm-cream page broken up by saturated color bands (a marigold buy-one-give-one band, a navy impact stat, a sage "the rest" band) over a rhythm of shoppable carousels, in a bright `romp` theme. Modelled on the playful give-back DTC archetype; shipped as Rally, a pet-supplies brand that gives one item to a shelter for every one sold.',
    tagline: 'A bright, warm template for playful, mission-driven brands with a give-back at their heart.',
    vertical: 'retail',
    industry: 'Pet supplies with giveback',
    requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
    sortWeight: 75,
    brand: {
        businessName: 'Rally',
        tagline: 'Every wag does some good.',
    },
    // Bombas chrome: a strong brand-left wordmark with a filled SHOP call to action in the
    // bar (`brandLeft` + `showCta: true`), and the friendly three-column footer with a legal
    // bar (`columns`) — so the home page carries its own newsletter capture (footer ≠
    // newsletter).
    chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
    seo: {
        home: {
            title: 'Rally — pet supplies that give back, one for one',
            description:
                'Rally makes the good stuff for dogs and cats — beds, collars, toys and treats — and for every item you buy, one is given to a shelter animal still waiting for a home.',
        },
        about: {
            title: 'About Rally',
            description:
                'Why Rally gives one to a shelter for every item bought, and the rescue partners we work with across the country.',
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
