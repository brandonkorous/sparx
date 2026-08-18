// sparx-glossy-fashion — a reference-driven CONTENT site template
// (docs/templates/content/vogue). The image-first, editorial-luxury pole of the content
// set: where the news feed optimises for scan-speed and the literary front for reading
// measure, this one optimises for desire and taste — full-bleed art-directed imagery, a
// thin high-contrast serif display used large and sparse, and acres of whitespace.
//
// The high-fashion glossy archetype, translated to sparx: a single commanding cover story
// (full-bleed image, type set in a solid panel — never floated on the photo), an editorial
// story grid, a lookbook of looks, image-led department tiles, and a light "Shop the Edit"
// so the CMS spine demos content AND commerce without ever becoming a store. Ported to a
// style & design magazine — Mode & Object, "Style, looked at closely." Dressed in the
// bespoke `runway` theme (pure black-and-white editorial luxury, a Didone-lineage Playfair
// display over clean Inter body, zero radius — the photograph supplies every color).
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts` (content-theme resolution + the `article` slot); the article
// DATA plumbing lives in the shared `template-sites/article.ts` kit. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-template-glossy-fashion.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-glossy-fashion/**" \
//     "marketplace-catalog/_gen/gen-template-glossy-fashion.ts"
//   pnpm --filter @wizeworks/api-rest marketplace:self-register
//
// A CONTENT template still ships the full 9-page superset (author complete; the installer
// writes the tenant's enabled slices) — so it carries a LIGHT commerce slice (a design
// object edit) that doubles as the content+commerce demo. The bespoke effort goes where a
// publisher lives: the cover story and the article page.
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
// Royalty-free Unsplash photographs, hot-linked (also registered in `assets`).
const U = (id: string): string => `https://images.unsplash.com/photo-${id}?w=1600&q=80`;

const IMG = {
    // Cover + editorial
    cover: '1490481651871-ab68de25d43d',
    // Lookbook looks
    look1: '1509631179647-0177331693ae',
    look2: '1515886657613-9f3515b0c78f',
    look3: '1469334031218-e382a71b716b',
    look4: '1483985988355-763728e1935b',
    look5: '1524504388940-b1c1722653e1',
    look6: '1487222477894-8943e31ef7b2',
    // Department tiles
    deptFashion: '1441984904996-e0b6ba687e04',
    deptBeauty: '1512496015851-a90fb38ba796',
    deptRunway: '1509319117193-57bab727e09d',
    deptCulture: '1513519245088-0e12902e35ca',
    // Author portraits
    authorPrevost: '1494790108377-be9c29b29330',
    authorOkonkwo: '1573497019940-1c28c88b4f3e',
    authorHart: '1500648767791-00dcc994a43e',
    // Story lead imagery
    postWardrobe: '1487412720507-e7ab37603c6f',
    postSkin: '1522338242992-e1a54906a8da',
    postResort: '1469334031218-e382a71b716b',
    postObject: '1531913764164-f85c52e6e654',
    postFragrance: '1541643600914-78b084683601',
    // Store imagery (the object edit)
    scarf: '1601924994987-69e26d50dc26',
    carafe: '1578985545062-69928b1d9587',
    sunglasses: '1511499767150-a48a237f0083',
    print: '1513475382585-d06e58bcb0e0',
} as const;

interface Asset {
    id: string;
    url: string;
    alt: string;
}

const ASSETS: Asset[] = [
    { id: 'cover-story', url: U(IMG.cover), alt: 'A model in a tailored coat against a plain wall' },
    { id: 'look-1', url: U(IMG.look1), alt: 'A look in soft neutral tailoring' },
    { id: 'look-2', url: U(IMG.look2), alt: 'A studio portrait of a single garment' },
    { id: 'look-3', url: U(IMG.look3), alt: 'A full-length look on a seamless ground' },
    { id: 'look-4', url: U(IMG.look4), alt: 'An accessory styled on a plain surface' },
    { id: 'look-5', url: U(IMG.look5), alt: 'A close crop of draped fabric' },
    { id: 'look-6', url: U(IMG.look6), alt: 'A look photographed in low, even light' },
    { id: 'dept-fashion', url: U(IMG.deptFashion), alt: 'A rack of considered clothing in a studio' },
    { id: 'dept-beauty', url: U(IMG.deptBeauty), alt: 'A clean beauty portrait in daylight' },
    { id: 'dept-runway', url: U(IMG.deptRunway), alt: 'A look moving down a bare runway' },
    { id: 'dept-culture', url: U(IMG.deptCulture), alt: 'A ceramic object on a plinth' },
    { id: 'author-prevost', url: U(IMG.authorPrevost), alt: 'Portrait of Elena Prévost' },
    { id: 'author-okonkwo', url: U(IMG.authorOkonkwo), alt: 'Portrait of Nadia Okonkwo' },
    { id: 'author-hart', url: U(IMG.authorHart), alt: 'Portrait of Julian Hart' },
    { id: 'post-wardrobe', url: U(IMG.postWardrobe), alt: 'A considered wardrobe laid out flat' },
    { id: 'post-skin', url: U(IMG.postSkin), alt: 'A bare-skin beauty portrait' },
    { id: 'post-resort', url: U(IMG.postResort), alt: 'A resort collection look on a plain ground' },
    { id: 'post-object', url: U(IMG.postObject), alt: 'A single designed object in the light' },
    { id: 'post-fragrance', url: U(IMG.postFragrance), alt: 'A fragrance bottle on a stone surface' },
    { id: 'product-scarf', url: U(IMG.scarf), alt: 'A folded silk scarf' },
    { id: 'product-carafe', url: U(IMG.carafe), alt: 'A hand-thrown ceramic carafe' },
    { id: 'product-sunglasses', url: U(IMG.sunglasses), alt: 'A pair of acetate sunglasses' },
    { id: 'product-print', url: U(IMG.print), alt: 'A framed studio print' },
];

const assetUrl = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-glossy-fashion: unknown asset "${id}"`);
    return a.url;
};

// ── Home page bands (the curated issue) ──────────────────────────────────────────

/** The COVER STORY — a single full-bleed art-directed image opening the issue like a
 *  magazine cover, with the rubric + serif headline + byline set in a SOLID panel over
 *  the photo (never floated on it — type on a raw photo is unreadable on the next crop).
 *  The home page's one `<h1>`. */
function coverStory(): Node {
    return el('section', 'bg-base-100 @container', {
        children: [
            el('div', 'relative w-full', {
                children: [
                    el('img', 'aspect-video w-full bg-base-200 object-cover', {
                        attrs: {
                            src: assetUrl('cover-story'),
                            alt: 'A model in a tailored coat against a plain wall',
                            loading: 'eager',
                        },
                    }),
                    el('div', 'absolute inset-0 flex items-end p-6 @2xl:p-10 @4xl:p-16', {
                        children: [
                            el(
                                'div',
                                'flex w-full max-w-md flex-col gap-4 bg-base-100 p-6 @2xl:max-w-lg @2xl:p-10',
                                {
                                    children: [
                                        el('span', 'text-sm font-semibold uppercase tracking-widest text-base-content', {
                                            text: 'The Cover · Fashion',
                                        }),
                                        el(
                                            'h1',
                                            'text-4xl font-normal leading-tight tracking-tight text-base-content @2xl:text-5xl @4xl:text-6xl',
                                            { text: 'The Return of the Considered Wardrobe' },
                                        ),
                                        el('p', 'text-lg leading-relaxed text-base-content', {
                                            text: 'A season away from the trend cycle, and the clothes that were left standing when it passed. On dressing with intention, and buying almost nothing.',
                                        }),
                                        el('p', 'text-sm text-base-content', {
                                            text: 'By Elena Prévost · Photography Iris Blum',
                                        }),
                                        el('a', 'btn btn-primary btn-lg w-fit', {
                                            attrs: { href: '/journal' },
                                            text: 'Read the story',
                                        }),
                                    ],
                                },
                            ),
                        ],
                    }),
                ],
            }),
        ],
    });
}

/** A plain section heading band — the small-caps label + serif title over a bound feed. */
function headingBand(kicker: string, heading: string, lead: string): Node {
    return el('section', 'bg-base-100 @container px-6 pt-16 pb-2', {
        children: [
            el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-3', {
                children: [
                    el('span', 'text-sm font-semibold uppercase tracking-widest text-base-content', {
                        text: kicker,
                    }),
                    el(
                        'h2',
                        'text-3xl font-normal tracking-tight text-base-content @3xl:text-4xl',
                        { text: heading },
                    ),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', { text: lead }),
                ],
            }),
        ],
    });
}

/** The LOOKBOOK — a dense uniform grid of looks, the signature fashion surface. Each tile
 *  is an edge-to-edge portrait crop with a wide-tracked caption beneath (a caption, not a
 *  headline — the picture is the statement). */
function lookbookBand(): Node {
    const look = (assetId: string, alt: string, label: string, season: string): Node =>
        el('a', 'group flex flex-col gap-3', {
            attrs: { href: '/journal' },
            children: [
                el('img', 'aspect-square w-full border border-base-300 bg-base-200 object-cover', {
                    attrs: { src: assetUrl(assetId), alt, loading: 'lazy' },
                }),
                el('div', 'flex flex-col gap-1', {
                    children: [
                        el('span', 'text-sm font-semibold uppercase tracking-widest text-base-content', {
                            text: label,
                        }),
                        el('span', 'text-sm text-base-content', { text: season }),
                    ],
                }),
            ],
        });
    return el('section', 'bg-base-100 @container px-6 py-16', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-8', {
                children: [
                    el('div', 'flex flex-col gap-3', {
                        children: [
                            el('span', 'text-sm font-semibold uppercase tracking-widest text-base-content', {
                                text: 'The Lookbook',
                            }),
                            el(
                                'h2',
                                'text-3xl font-normal tracking-tight text-base-content @3xl:text-4xl',
                                { text: 'Resort 2027, in Forty Looks' },
                            ),
                        ],
                    }),
                    el('div', 'grid grid-cols-2 gap-4 @2xl:grid-cols-3 @4xl:grid-cols-6', {
                        children: [
                            look('look-1', 'A look in soft neutral tailoring', 'Look 01', 'The overcoat'),
                            look('look-2', 'A studio portrait of a single garment', 'Look 02', 'The slip'),
                            look('look-3', 'A full-length look on a seamless ground', 'Look 03', 'The suit'),
                            look('look-4', 'An accessory styled on a plain surface', 'Look 04', 'The bag'),
                            look('look-5', 'A close crop of draped fabric', 'Look 05', 'The drape'),
                            look('look-6', 'A look photographed in low, even light', 'Look 06', 'The knit'),
                        ],
                    }),
                    el('a', 'btn btn-neutral btn-outline btn-lg w-fit', {
                        attrs: { href: '/journal' },
                        text: 'See the full collection',
                    }),
                ],
            }),
        ],
    });
}

/** DEPARTMENT tiles — the four sections of the magazine as image-led cards. The name sits
 *  in a solid strip beneath the photo (a peer of the feed's h2 headings become h3 here). */
function departmentsBand(): Node {
    const dept = (assetId: string, alt: string, name: string, blurb: string): Node =>
        el('a', 'group flex flex-col border border-base-300 bg-base-100', {
            attrs: { href: '/journal' },
            children: [
                el('img', 'aspect-video w-full bg-base-200 object-cover', {
                    attrs: { src: assetUrl(assetId), alt, loading: 'lazy' },
                }),
                el('div', 'flex flex-col gap-2 p-5', {
                    children: [
                        el('h3', 'text-2xl font-normal tracking-tight text-base-content', { text: name }),
                        el('p', 'text-base leading-relaxed text-base-content', { text: blurb }),
                    ],
                }),
            ],
        });
    return el('section', 'bg-base-200 @container px-6 py-16', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-8', {
                children: [
                    el('div', 'flex flex-col gap-3', {
                        children: [
                            el('span', 'text-sm font-semibold uppercase tracking-widest text-base-content', {
                                text: 'The Departments',
                            }),
                            el(
                                'h2',
                                'text-3xl font-normal tracking-tight text-base-content @3xl:text-4xl',
                                { text: 'Where the Issue Lives' },
                            ),
                        ],
                    }),
                    el('div', 'grid grid-cols-1 gap-6 @2xl:grid-cols-2 @4xl:grid-cols-4', {
                        children: [
                            dept('dept-fashion', 'A rack of considered clothing in a studio', 'Fashion', 'The wardrobe, edited — what to keep, what to let go.'),
                            dept('dept-beauty', 'A clean beauty portrait in daylight', 'Beauty', 'Skin, scent and the case for doing less.'),
                            dept('dept-runway', 'A look moving down a bare runway', 'Runway', 'The collections that mattered, read closely.'),
                            dept('dept-culture', 'A ceramic object on a plinth', 'Culture', 'The made world — objects, interiors, the design of desire.'),
                        ],
                    }),
                ],
            }),
        ],
    });
}

const HOME: Node[] = [
    coverStory(),
    headingBand('From the Desk', 'The Latest', 'New writing across fashion, beauty, runway and culture — the issue as it fills in.'),
    blogPostGrid(),
    lookbookBand(),
    departmentsBand(),
    // The content→commerce bridge: shop-the-look, surfaced as editorial — a live carousel.
    productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'The Edit' }),
];

// ── The bespoke article page (the glossy's signature surface) ─────────────────────
// The photo-story reading page: the department rubric over a large thin-serif headline,
// a real byline (author + date), the full-bleed featured image, the serif body, and an
// author card at the foot. Every bound field resolves against the routed post (the
// `article.ts` kit's `repeat('blog_post')` scope); the byline lights up from the
// storefront's projection — a post with no author renders no byline, never a blank line.

/** The article MASTHEAD — authored UNSCOPED; `articlePage` wraps it in `repeat('blog_post')`. */
function articleMasthead(): Node {
    return el('section', 'bg-base-100 @container px-6 pt-16 pb-10 @2xl:pt-20', {
        children: [
            el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-5', {
                children: [
                    el('a', 'inline-flex w-fit items-center gap-2 text-sm font-semibold uppercase tracking-widest text-base-content', {
                        attrs: { href: '/journal' },
                        children: [el('span', undefined, { text: '←' }), el('span', undefined, { text: 'The Journal' })],
                    }),
                    // The department rubric — the small-caps editorial label, bound to the category.
                    articleRubric('text-sm font-semibold uppercase tracking-widest text-base-content'),
                    articleTitle(
                        'h1',
                        'text-4xl font-normal leading-tight tracking-tight text-base-content @2xl:text-6xl',
                    ),
                    articleStandfirst('max-w-2xl text-xl leading-relaxed text-base-content'),
                    // The byline row — author portrait, name, and date.
                    el('div', 'mt-2 flex items-center gap-3', {
                        children: [
                            articleAuthorAvatar('h-11 w-11 border border-base-300 object-cover'),
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

/** The featured image — full-bleed, edge to edge, the way a glossy opens a story. */
function articleImageBand(): Node {
    return el('section', 'bg-base-100 @container', {
        children: [
            articleFeaturedImage('aspect-video w-full bg-base-200 object-cover'),
        ],
    });
}

/** The author card at the foot — portrait, name, bio. Gated on the author bio, so it
 *  appears only when there is genuinely something to say about who wrote the piece. */
function articleFoot(): Node {
    return el('section', 'bg-base-100 @container px-6 pb-20', {
        children: [
            el('div', 'mx-auto w-full max-w-3xl', {
                children: [
                    articleAuthorCard({
                        cardClass:
                            'flex flex-col gap-4 border-t border-base-300 pt-8 @2xl:flex-row @2xl:items-center',
                        avatarClass: 'h-16 w-16 border border-base-300 object-cover',
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
    el('section', 'bg-base-100 @container px-6 py-20 @3xl:py-24', {
        children: [
            el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-4', {
                children: [
                    el('span', 'text-sm font-semibold uppercase tracking-widest text-base-content', {
                        text: 'Mode & Object',
                    }),
                    el(
                        'h1',
                        'text-5xl font-normal leading-tight tracking-tight text-base-content @3xl:text-7xl',
                        { text: 'The Journal' },
                    ),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Fashion, beauty, runway and the made world — looked at closely, and photographed the way it deserves. Newest first.',
                    }),
                ],
            }),
        ],
    }),
];

// ── About + Contact (Mode & Object–voiced) ───────────────────────────────────────

const ABOUT: Node[] = [
    el('section', 'bg-base-100 @container px-6 py-20', {
        children: [
            el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-6', {
                children: [
                    el('h1', 'text-5xl font-normal tracking-tight text-base-content @2xl:text-6xl', {
                        text: 'About Mode & Object',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'Mode & Object is a style and design magazine about the things people choose to keep. We write about fashion, beauty, the runway and the made world with the same attention — not as trends to chase, but as decisions made by real people with taste and a point of view.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'The photograph is the story here, and the writing is the caption. We commission original work, we credit every image, and we would rather run one considered piece than ten filed to fill a feed.',
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
        heading: 'Get in Touch',
        intro: 'A story to pitch, a collection to show us, or a correction to make? The editors read everything, and we answer the good ones. For press and stockist enquiries, the same address reaches the desk.',
        submitLabel: 'Email the editors',
    }),
];

// ── Light commerce (The Edit — a small object & accessory edit) ───────────────────

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
        handle: 'the-everyday-scarf',
        title: 'The Everyday Scarf',
        description:
            'A generous square of heavyweight silk twill, hand-rolled at the edge, in a single quiet color. The one accessory the wardrobe story kept coming back to — it finishes a coat and asks for nothing.',
        status: 'active',
        productType: 'Accessory',
        vendor: 'Mode & Object',
        tags: ['accessory', 'silk', 'the-edit'],
        categoryHandles: ['accessories'],
        collectionHandles: ['featured'],
        seoTitle: 'The Everyday Scarf — hand-rolled silk twill | Mode & Object',
        seoDescription: 'A heavyweight silk twill scarf in a single quiet color, hand-rolled at the edge.',
        variants: [{ sku: 'MO-ACC-SCARF', priceCents: money(120), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'product-scarf', isPrimary: true, alt: 'A folded silk scarf' }],
    },
    {
        handle: 'studio-carafe',
        title: 'The Studio Carafe',
        description:
            'A hand-thrown stoneware carafe from the atelier we visited this issue — matte, off-white, a little uneven on purpose. Made in small runs, so no two are quite the same. Water, wine, or a single stem.',
        status: 'active',
        productType: 'Object',
        vendor: 'Mode & Object',
        tags: ['object', 'ceramic', 'the-edit'],
        categoryHandles: ['objects'],
        collectionHandles: ['featured'],
        seoTitle: 'The Studio Carafe — hand-thrown stoneware | Mode & Object',
        seoDescription: 'A hand-thrown matte stoneware carafe, made in small runs — no two the same.',
        variants: [{ sku: 'MO-OBJ-CARAFE', priceCents: money(88), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'product-carafe', isPrimary: true, alt: 'A hand-thrown ceramic carafe' }],
    },
    {
        handle: 'acetate-sunglasses',
        title: 'The Acetate Sunglasses',
        description:
            'A rounded acetate frame in a warm tortoise, cut from a single sheet and polished by hand. The shape the beauty desk keeps recommending because it flatters almost everyone and dates almost never.',
        status: 'active',
        productType: 'Accessory',
        vendor: 'Mode & Object',
        tags: ['accessory', 'eyewear', 'the-edit'],
        categoryHandles: ['accessories'],
        collectionHandles: ['featured'],
        seoTitle: 'The Acetate Sunglasses — hand-polished frame | Mode & Object',
        seoDescription: 'A rounded acetate sunglass frame in warm tortoise, cut and polished by hand.',
        variants: [{ sku: 'MO-ACC-SUN', priceCents: money(165), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'product-sunglasses', isPrimary: true, alt: 'A pair of acetate sunglasses' }],
    },
    {
        handle: 'studio-print-no-4',
        title: 'Studio Print No. 4',
        description:
            'An archival giclée print from our contributing photographer Iris Blum — a still life from the design portfolio, editioned and signed. Ships flat, unframed, in a run of one hundred.',
        status: 'active',
        productType: 'Print',
        vendor: 'Mode & Object',
        tags: ['print', 'photography'],
        categoryHandles: ['prints'],
        collectionHandles: [],
        seoTitle: 'Studio Print No. 4 — signed archival giclée | Mode & Object',
        seoDescription: 'A signed, editioned archival giclée still life by Iris Blum, in a run of one hundred.',
        variants: [{ sku: 'MO-PRINT-04', priceCents: money(220), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'product-print', isPrimary: true, alt: 'A framed studio print' }],
    },
];

const COMMERCE = {
    categories: [
        { handle: 'objects', name: 'Objects', description: 'For the made world.', featured: true },
        { handle: 'accessories', name: 'Accessories', description: 'The finishing pieces.', featured: true },
        { handle: 'prints', name: 'Prints', description: 'From the portfolio.', featured: false },
    ],
    collections: [
        {
            handle: 'featured',
            name: 'The Edit',
            description: 'What the desk is pointing at this issue — shop the look.',
            type: 'manual',
            featured: true,
            productHandles: ['the-everyday-scarf', 'studio-carafe', 'acetate-sunglasses'],
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
        slug: 'elena-prevost',
        displayName: 'Elena Prévost',
        bio: 'Elena Prévost is the fashion director of Mode & Object. She writes about how people actually get dressed — the editing, the keeping, and the case against buying more.',
        avatarAssetId: 'author-prevost',
    },
    {
        slug: 'nadia-okonkwo',
        displayName: 'Nadia Okonkwo',
        bio: 'Nadia Okonkwo directs beauty coverage at Mode & Object. Her subject is restraint — skin, scent and the discipline of doing less, reported from the chair and the lab.',
        avatarAssetId: 'author-okonkwo',
    },
    {
        slug: 'julian-hart',
        displayName: 'Julian Hart',
        bio: 'Julian Hart is the runway critic of Mode & Object. He reads collections the way others read books, and files from the front row on what a season was actually saying.',
        avatarAssetId: 'author-hart',
    },
];

// ── Content (the Mode & Object reporting) ─────────────────────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });

const CONTENT = [
    {
        typeKey: 'blog_post',
        slug: 'the-considered-wardrobe',
        status: 'published',
        authorSlug: 'elena-prevost',
        categories: ['Fashion'],
        tags: ['The Edit'],
        body: {
            title: 'The Return of the Considered Wardrobe',
            excerpt:
                'A season away from the trend cycle, and the clothes that were left standing when it passed. On dressing with intention, and buying almost nothing.',
            featuredImage: { $asset: 'post-wardrobe' },
            body: {
                type: 'doc',
                content: [
                    para('The most interesting wardrobes I saw this season did not belong to people chasing anything. They belonged to people who had stopped — who had, at some point, decided what they liked and then simply kept wearing it until it wore out and was replaced with the same thing, a little better made.'),
                    h2('The end of the churn'),
                    para('For a decade the industry sold newness as a virtue in itself. What is quietly replacing it is not minimalism, exactly — the closets are not empty — but a kind of editing. Fewer things, chosen slowly, kept for years. A coat is a ten-year decision again, not a nine-week one.'),
                    h2('What survives the cull'),
                    para('When you strip a wardrobe back to what a person actually reaches for, the same shapes appear across every closet: a good coat, a real shirt, one pair of trousers that fit, a shoe that can be resoled. The trend was never the point. The point was the editing, and the editing is a skill.'),
                    para('If there is a look this season, it is the look of someone who has already decided. That is the hardest thing in fashion to fake, and the only thing worth photographing.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'skin-as-the-only-statement',
        status: 'published',
        authorSlug: 'nadia-okonkwo',
        categories: ['Beauty'],
        tags: ['The Beauty Edit'],
        body: {
            title: 'Skin as the Only Statement',
            excerpt:
                'The most talked-about beauty look of the season is barely a look at all. On the long, expensive road back to doing almost nothing.',
            featuredImage: { $asset: 'post-skin' },
            body: {
                type: 'doc',
                content: [
                    para('Backstage this season the instruction to the artists was the same everywhere, in three or four languages: less. Less product, less color, less of the face doing the work the clothes were supposed to do. The result reads, from the front row, as skin — and almost nothing else.'),
                    h2('The paradox of the bare face'),
                    para('None of this is actually bare, of course. The undone face is one of the most worked-on effects in beauty, the product of skincare that starts weeks before the show and a hand light enough to be invisible. Doing nothing well is the most expensive kind of doing something.'),
                    h2('Why now'),
                    para('There is a fatigue in it — a reaction against a decade of the sculpted, filtered, fully-built face. When everyone can look like anyone, looking like yourself becomes the statement. The skin you actually have, lit well, is the last thing a filter cannot sell you.'),
                    para('The kindest reading is that the industry is finally selling maintenance instead of transformation. The honest one is that maintenance, done properly, costs more than transformation ever did.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'resort-2027-collections-that-mattered',
        status: 'published',
        authorSlug: 'julian-hart',
        categories: ['Runway'],
        tags: ['Resort 2027'],
        body: {
            title: 'Resort 2027: The Collections That Mattered',
            excerpt:
                'A resort season with less spectacle and more clothes. The shows that said something, and the ones that only made noise.',
            featuredImage: { $asset: 'post-resort' },
            body: {
                type: 'doc',
                content: [
                    para('Resort is the season where fashion admits what it is for. There is no myth to sell, no theatre to build — just the clothes people will actually buy and wear, shown in a hotel courtyard to a room that has seen everything. It is the most honest week on the calendar, and this year it was unusually good.'),
                    h2('Restraint as a position'),
                    para('The best collections did not shout. They proposed a way of dressing and then argued it, look after look, without a single gimmick to distract from whether the argument held. When it did, you left wanting to wear it. When it did not, no amount of set design could hide the gap.'),
                    h2('The debuts'),
                    para('Three houses showed new hands this season, and the difference between a designer with a point of view and one with only a mood board was visible within five looks. Taste cannot be hired in for a season; it shows up in the hem, the button, the decision to leave something out.'),
                    para('If resort is where fashion tells the truth, this year the truth was encouraging: the clothes came first, and the ones that mattered will still look right in a decade.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'the-object-that-outlives-the-trend',
        status: 'published',
        authorSlug: 'elena-prevost',
        categories: ['Culture'],
        tags: ['Studio Visit'],
        body: {
            title: 'The Object That Outlives the Trend',
            excerpt:
                'A studio visit with a ceramicist who has made the same carafe for twenty years. On design that refuses to be new, and is better for it.',
            featuredImage: { $asset: 'post-object' },
            body: {
                type: 'doc',
                content: [
                    para('The carafe on the shelf has not changed since the studio opened. Same proportion, same matte glaze, same slightly heavy base that means it does not tip when it is full. The maker has been asked, more than once, to update it. She has, more than once, declined.'),
                    h2('Against the new'),
                    para('"A good object does not have a season," she tells me, turning one on the wheel while we talk. "If I redesign it every year, I am telling you the old one was wrong. It was not wrong. It was right, and it is still right." The shelves behind her are proof — twenty years of the same shape, each one a little more assured.'),
                    h2('The long life of a thing'),
                    para('There is a version of design culture that treats permanence as a failure of imagination. The studio argues the opposite: that making one thing well and then defending it against the pressure to change is the harder, rarer discipline. The trend is easy. The object that outlives it is the achievement.'),
                    para('You can buy the carafe, still, for less than a season’s worth of the things it will outlast. That, she says, is the whole point.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'fragrance-and-the-memory-of-a-room',
        status: 'published',
        authorSlug: 'nadia-okonkwo',
        categories: ['Beauty'],
        tags: ['The Beauty Edit'],
        body: {
            title: 'Fragrance, and the Memory of a Room',
            excerpt:
                'Why the scents that last are the ones that remember a place. A conversation with a perfumer about smell, memory and restraint.',
            featuredImage: { $asset: 'post-fragrance' },
            body: {
                type: 'doc',
                content: [
                    para('Ask people about the perfumes they have loved and almost no one describes a smell. They describe a room — a grandmother’s coat, a hallway in summer, a person long gone. Fragrance is the one part of beauty that works on memory directly, and the perfumers who understand that build differently.'),
                    h2('The trap of the loud scent'),
                    para('The easiest fragrance to sell is the one you can smell across a room. It is also the one that empties fastest, because it announces itself and then has nothing else to say. The scents that stay in rotation for years tend to be quieter — a thing you notice on yourself at the end of the day and are glad to still be wearing.'),
                    h2('Building for the long wear'),
                    para('"I am not trying to be noticed," the perfumer says. "I am trying to be remembered." The distinction sounds small until you live with a bottle for a year. Restraint, again — the same lesson the beauty desk keeps arriving at from every direction this season.'),
                    para('The best compliment a fragrance can earn is not that someone loved it, but that it reminded them, unaccountably, of somewhere they used to be.'),
                ],
            },
        },
    },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
    slug: 'glossy-fashion',
    key: 'sparx-glossy-fashion',
    name: 'Glossy Fashion',
    summary:
        'An image-first, editorial-luxury template for a style & design magazine — a full-bleed cover story, an editorial feed, a lookbook of looks, image-led department tiles and a bespoke photo-story article page, in a pure black-and-white serif theme where the photograph supplies every color. Modelled on the high-fashion glossy archetype; shipped as Mode & Object. Ships a light object edit (accessories, ceramics, a print) to demonstrate content + commerce together.',
    tagline: 'An image-first editorial template for a magazine of style and taste.',
    vertical: 'content',
    industry: 'Style, fashion & design',
    requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
    sortWeight: 100,
    brand: {
        businessName: 'Mode & Object',
        tagline: 'Style, looked at closely.',
    },
    // A centered serif wordmark masthead over the newsletter footer (subscription is the
    // conversion for a glossy) — no filled header CTA, so nothing crowds the cover.
    chrome: { navbar: 'centerLogo', footer: 'newsletter', showCta: false },
    seo: {
        home: {
            title: 'Mode & Object — a magazine of style and the made world',
            description:
                'Mode & Object is a style and design magazine covering fashion, beauty, the runway and the made world — image-first, credited, and looked at closely.',
        },
        about: {
            title: 'About Mode & Object — a style & design magazine',
            description:
                'Who Mode & Object is and how it works — original photography, credited images, and one considered piece over ten filed to fill a feed.',
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
