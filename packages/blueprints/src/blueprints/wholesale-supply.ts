// A wholesale industrial-supply blueprint ("Ironline Supply Co.") — a no-nonsense,
// data-dense B2B catalog storefront. Sibling of auto-parts.ts: it exercises
// Builder, Commerce, CMS, and Email (NOT the b2b module — per the brief,
// requiresModules deliberately omits 'b2b'; the catalog stands on its own and
// the tenant can switch the b2b module on later). Each item is a single-variant
// product with an integer-cents wholesale price and a part number. Everything
// installs to DRAFT (docs/54 D4); the tenant reviews, customizes, and goes live.
//
// Authoring notes (mirror retail-store-blog.ts / auto-parts.ts):
//   · Trees are real @sparx/builder-schemas nodes (same JSON the editor emits)
//     and bind via tokens, so they re-theme to whatever tenant installs them.
//   · Static imagery in trees hot-links a raw URL (box.backgroundImage); imagery
//     bound to records (products, posts) comes from the seeded assets.
//   · Placeholder images hot-link picsum.photos — swap for owned media when the
//     install path moves to copy-into-tenant-media (docs/54 §6 deferred).

import {
  seedNode,
  type BoxStyle,
  type BuilderNode,
  type LayoutStyle,
} from '@sparx/builder-schemas';

import type { Blueprint } from '../manifest';
import { assetRef } from '../refs';
import { parseBlueprint } from '../validate';

// ── Tree authoring helpers (mirror builder-schemas/starters.ts) ────────────────

let nid = 0;
const rid = (t: string): string => `whl-${t}-${(nid += 1)}`;

function node(
  type: string,
  opts: {
    box?: BoxStyle;
    layout?: LayoutStyle;
    props?: Record<string, unknown>;
    bind?: string;
    /** Extra verbatim classes (e.g. an archetype/recipe seed). */
    cls?: string;
    children?: BuilderNode[];
  } = {}
): BuilderNode {
  return seedNode(rid(type), type, opts);
}

/** A minimal TipTap rich-text doc from plain paragraphs (content_entries.body). */
const doc = (...paragraphs: string[]): Record<string, unknown> => ({
  type: 'doc',
  content: paragraphs.map((t) => ({ type: 'paragraph', content: [{ type: 'text', text: t }] })),
});

/** A deterministic placeholder image URL (hot-linked; docs/54 §6 D3). */
const pic = (seed: string, w = 1200, h = 900): string =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;

/** A static shop-by-category tile: a background photo with a dark scrim + label. */
function categoryTile(seed: string, label: string): BuilderNode {
  return node('Card', {
    box: {
      name: label,
      height: 'sm',
      surface: 'none',
      padding: 'md',
      align: 'start',
      backgroundImage: pic(seed, 600, 360),
      overlay: 'dark',
      textTone: 'light',
    },
    layout: { direction: 'stack', gap: 'none', justify: 'end', alignItems: 'start' },
    children: [node('Heading', { props: { level: 'h3', text: label } })],
  });
}

/** A static value card: a heading + a line of supporting copy. */
function valueCard(heading: string, body: string): BuilderNode {
  return node('Card', {
    box: { name: heading, surface: 'none', padding: 'md' },
    layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
    children: [
      node('Heading', { props: { level: 'h3', text: heading } }),
      node('Text', { props: { variant: 'body', text: body } }),
    ],
  });
}

// ── Page trees ─────────────────────────────────────────────────────────────────

function homeTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Home', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      // HERO — full-bleed warehouse photo, dark scrim, light text. Two CTAs.
      node('Section', {
        box: {
          name: 'Hero',
          height: 'lg',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'start',
          padding: 'xl',
          backgroundImage: pic('ironline-warehouse', 2000, 1100),
          overlay: 'dark',
          textTone: 'light',
        },
        layout: { direction: 'stack', gap: 'sm', justify: 'center', alignItems: 'start' },
        children: [
          node('Heading', {
            props: { level: 'h1', text: 'Industrial supply, stocked deep and shipped fast.' },
          }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Fasteners, abrasives, safety gear, and shop consumables in case and pallet quantities — real wholesale pricing, full spec sheets, and same-day shipping from three regional warehouses.',
            },
          }),
          node('Stack', {
            box: { name: 'Hero actions', padding: 'none' },
            layout: { direction: 'row', gap: 'sm', alignItems: 'center' },
            children: [
              node('Button', {
                props: { label: 'Browse the catalog', style: 'primary', href: '/collections/featured' },
              }),
              node('Button', {
                props: { label: 'Request a quote', style: 'soft', href: '/quotes' },
              }),
            ],
          }),
        ],
      }),

      // SHOP BY CATEGORY — static category tiles.
      node('Section', {
        box: { name: 'Shop by category', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'Shop by category' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Every department stocked to depth — search by part number or drill in by category.',
            },
          }),
          node('Grid', {
            box: { name: 'Category grid', padding: 'none' },
            layout: { direction: 'grid', columns: 3, gap: 'md' },
            children: [
              categoryTile('il-fasteners', 'Fasteners'),
              categoryTile('il-abrasives', 'Abrasives'),
              categoryTile('il-safety', 'Safety & PPE'),
              categoryTile('il-adhesives', 'Adhesives & Sealants'),
              categoryTile('il-material', 'Material Handling'),
              categoryTile('il-shop', 'Shop Supplies'),
            ],
          }),
        ],
      }),

      // FEATURED — Commerce as one section; data-dense product cards (part #, pack, price).
      node('Section', {
        box: { name: 'Featured', surface: 'subtle', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'Top reorders this quarter.' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Fast-moving stock our trade accounts reorder most. Prices shown are list — sign in for your account pricing and volume breaks.',
            },
          }),
          node('Grid', {
            box: { name: 'Products grid', padding: 'none' },
            layout: { direction: 'grid', columns: 4, gap: 'md' },
            bind: 'commerce.product',
            children: [
              node('Card', {
                box: { name: 'Product card', surface: 'none', padding: 'sm' },
                layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
                children: [
                  node('ImageDisplay', { props: { ratio: 'square' }, bind: 'item.images' }),
                  node('Heading', { props: { level: 'h3' }, bind: 'item.title' }),
                  // Data-dense leaves: SKU / part number and short spec line.
                  node('Text', { props: { variant: 'meta' }, bind: 'item.sku' }),
                  node('Text', { props: { variant: 'meta' }, bind: 'item.vendor' }),
                  node('PriceTag', { bind: 'item.price' }),
                  node('Button', { props: { label: 'Add to order', style: 'primary' } }),
                ],
              }),
            ],
          }),
        ],
      }),

      // TRADE VALUE BAND — inverse band, static value cards.
      node('Section', {
        box: {
          name: 'Trade value',
          surface: 'inverse',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          padding: 'xl',
        },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'Built for the purchasing desk.' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Specs on the page, stock you can count on, and a counter that picks up — wholesale done the way a buyer actually works.',
            },
          }),
          node('Grid', {
            box: { name: 'Value grid', padding: 'none' },
            layout: { direction: 'grid', columns: 4, gap: 'md' },
            children: [
              valueCard(
                'Volume pricing',
                'Case, carton, and pallet price breaks listed on every product — and your negotiated rates apply automatically once you sign in.'
              ),
              valueCard(
                'Three warehouses',
                'East, central, and west distribution centers ship most orders the same day, so lead times stay short no matter where your shop is.'
              ),
              valueCard(
                'Full spec sheets',
                'Material grade, thread pitch, load rating, and a downloadable datasheet on every line — no calling to confirm what fits.'
              ),
              valueCard(
                'Quotes & reorder',
                'Drop a part-number list for a quote, save standing reorder lists, and pull your full order history any time.'
              ),
            ],
          }),
          node('Button', {
            props: { label: 'Request a quote', style: 'primary', href: '/quotes' },
            box: { align: 'start' },
          }),
        ],
      }),

      // FROM THE FLOOR — CMS as a section; iterates posts.
      node('Section', {
        box: { name: 'From the floor', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'From the floor' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Spec guides, sourcing notes, and buying tips from people who move pallets for a living.',
            },
          }),
          node('Grid', {
            box: { name: 'Posts grid', padding: 'none' },
            layout: { direction: 'grid', columns: 2, gap: 'lg' },
            bind: 'cms.blog_post',
            children: [
              node('Card', {
                box: { name: 'Article card', surface: 'subtle', padding: 'md' },
                layout: { direction: 'stack', gap: 'sm' },
                children: [
                  node('ImageDisplay', { props: { ratio: 'wide' }, bind: 'item.featuredImage' }),
                  node('Heading', { props: { level: 'h3' }, bind: 'item.title' }),
                  node('Text', { props: { variant: 'body' }, bind: 'item.excerpt' }),
                ],
              }),
            ],
          }),
        ],
      }),

      // CONVERSION BAND — centered inverse band with a signup form.
      node('Section', {
        box: {
          name: 'Open an account',
          surface: 'inverse',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
        },
        layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'center' },
        bind: 'crm.list',
        children: [
          node('Heading', { props: { level: 'h2', text: 'Set up a trade account today.' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Your pricing, volume breaks, and a dedicated account rep — most accounts are live the same day. No card required to apply.',
            },
          }),
          node('Button', { props: { label: 'Request a quote', style: 'primary', href: '/quotes' } }),
          node('Signup', { props: { cta: 'Get the catalog & pricing' }, bind: 'crm.list' }),
        ],
      }),
    ],
  });
}

function journalIndexTree(): BuilderNode {
  return node('Section', {
    box: { name: 'From the floor', padding: 'lg', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'From the floor' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'Spec guides, sourcing notes, and buying tips from people who move pallets for a living.',
        },
      }),
      node('Grid', {
        box: { name: 'Posts grid', padding: 'none' },
        layout: { direction: 'grid', columns: 2, gap: 'lg' },
        bind: 'cms.blog_post',
        children: [
          node('Card', {
            box: { name: 'Article card', surface: 'subtle', padding: 'md' },
            layout: { direction: 'stack', gap: 'sm' },
            children: [
              node('ImageDisplay', { props: { ratio: 'wide' }, bind: 'item.featuredImage' }),
              node('Heading', { props: { level: 'h3' }, bind: 'item.title' }),
              node('Text', { props: { variant: 'body' }, bind: 'item.excerpt' }),
            ],
          }),
        ],
      }),
    ],
  });
}

function blogPostTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Blog post', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      node('Section', {
        box: {
          name: 'Header',
          height: 'md',
          surface: 'inverse',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
        },
        layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'center' },
        children: [
          node('Heading', { props: { level: 'h1' }, bind: 'blog_post.title' }),
          node('Text', { props: { variant: 'body' }, bind: 'blog_post.excerpt' }),
        ],
      }),
      node('Section', {
        box: { name: 'Body', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('ImageDisplay', { props: { ratio: 'wide' }, bind: 'blog_post.featuredImage' }),
          node('Text', { props: { variant: 'body' }, bind: 'blog_post.body' }),
        ],
      }),
    ],
  });
}

function productTree(): BuilderNode {
  return node('Section', {
    box: {
      name: 'Product page',
      padding: 'lg',
      backgroundWidth: 'full',
      contentWidth: 'contained',
    },
    layout: { direction: 'stack', gap: 'lg' },
    children: [
      node('Section', {
        box: { name: 'Product', padding: 'none', contentWidth: 'full' },
        layout: { direction: 'row', gap: 'lg', alignItems: 'start' },
        children: [
          node('ImageDisplay', { props: { ratio: 'square' }, bind: 'product.images' }),
          node('Stack', {
            box: { name: 'Buy', padding: 'none' },
            layout: { direction: 'stack', gap: 'md' },
            children: [
              node('Heading', { props: { level: 'h1' }, bind: 'product.title' }),
              // Data-dense detail: part number + manufacturer above the price.
              node('Text', { props: { variant: 'meta' }, bind: 'product.sku' }),
              node('Text', { props: { variant: 'meta' }, bind: 'product.vendor' }),
              node('PriceTag', { bind: 'product.price' }),
              node('Text', { props: { variant: 'body' }, bind: 'product.description' }),
              node('Button', { props: { label: 'Add to order', style: 'primary' } }),
            ],
          }),
        ],
      }),
    ],
  });
}

// A `cms.page` template (Quotes, Shipping, …) — binds the page entry's fields.
function pageTemplateTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Page', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      node('Section', {
        box: {
          name: 'Header',
          height: 'sm',
          surface: 'inverse',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
        },
        layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'center' },
        children: [node('Heading', { props: { level: 'h1' }, bind: 'page.title' })],
      }),
      node('Section', {
        box: { name: 'Body', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [node('Text', { props: { variant: 'body' }, bind: 'page.body' })],
      }),
    ],
  });
}

function siteLayoutTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Site layout', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      node('Section', {
        box: {
          name: 'Header',
          surface: 'none',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          padding: 'md',
        },
        layout: { direction: 'row', collapse: false, justify: 'between', alignItems: 'center' },
        children: [
          node('Stack', {
            box: { padding: 'none' },
            layout: { direction: 'row', collapse: false, gap: 'sm', alignItems: 'center' },
            children: [
              node('Wordmark', { bind: 'site.identity' }),
              node('Heading', { props: { level: 'h3', text: 'Ironline Supply Co.' } }),
            ],
          }),
          node('NavMenu', {
            props: {
              orientation: 'row',
              links: [
                { label: 'Catalog', href: '/products' },
                { label: 'Request a quote', href: '/quotes' },
                { label: 'From the floor', href: '/journal' },
                { label: 'Shipping', href: '/shipping' },
              ],
            },
          }),
        ],
      }),
      node('Outlet', { box: { padding: 'none', backgroundWidth: 'full', contentWidth: 'full' } }),
      node('Section', {
        box: {
          name: 'Footer',
          surface: 'inverse',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          padding: 'lg',
        },
        layout: { direction: 'stack', gap: 'md', alignItems: 'start' },
        children: [
          node('NavMenu', {
            props: {
              orientation: 'row',
              links: [
                { label: 'Catalog', href: '/products' },
                { label: 'Request a quote', href: '/quotes' },
                { label: 'Shipping', href: '/shipping' },
              ],
            },
          }),
          node('SocialLinks', { bind: 'site.social' }),
          node('Text', { props: { variant: 'meta', text: '© Ironline Supply Co.' } }),
        ],
      }),
    ],
  });
}

// ── Email trees ────────────────────────────────────────────────────────────────

function welcomeEmailTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'Welcome to Ironline Supply Co.' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'Thanks for joining — the full catalog, spec sheets, and same-day shipping are at your fingertips. Set up a trade account for your pricing and volume breaks.',
        },
      }),
      node('Button', { props: { label: 'Browse the catalog', href: '' }, box: { align: 'start' } }),
      node('Divider'),
      node('Text', {
        props: {
          variant: 'meta',
          text: 'Need a quote on a part-number list? Reply with your sheet and we’ll price it back.',
        },
      }),
    ],
  });
}

function restockEmailTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'Restock & price breaks' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'This month’s fast-movers are back in depth, with fresh pallet price breaks and a sourcing tip from the floor — everything to keep your shop stocked.',
        },
      }),
      node('Button', { props: { label: 'See this month’s deals', href: '' }, box: { align: 'start' } }),
      node('Divider'),
      node('Text', {
        props: {
          variant: 'meta',
          text: 'You’re receiving this because you subscribed at Ironline Supply Co.',
        },
      }),
    ],
  });
}

// ── The manifest ───────────────────────────────────────────────────────────────

const manifest = {
  key: 'wholesale-supply',
  version: '1.0.0',
  name: 'Wholesale Supply',
  summary:
    'A no-nonsense, data-dense catalog storefront for an industrial wholesale supplier — fasteners, abrasives, safety gear and shop consumables with part numbers, spec sheets, volume pricing, and quote/reorder flows — themed and ready to review.',
  vertical: 'b2b',
  // Deliberately omits the b2b module: the catalog stands on its own; the tenant
  // can switch b2b on later for account pricing and net terms.
  requiresModules: ['builder', 'commerce', 'cms', 'email'],

  brand: {
    businessName: 'Ironline Supply Co.',
    tagline: 'Industrial supply, stocked deep.',
    colors: {
      primary: '#1e3a8a',
      primaryForeground: '#FFFFFF',
      accent: '#0ea5e9',
      secondary: '#0f172a',
    },
    fonts: { heading: 'Manrope', body: 'Inter' },
    logoLightAssetId: 'logo',
  },

  // The NEW theme this blueprint ships (docs/54 D5): a named SiteTheme over the
  // `fleet` preset — a solid industrial navy with a bright cyan accent.
  theme: {
    name: 'Ironline',
    basePresetKey: 'fleet',
    presentation: { v: 2, containerWidth: '1140px' },
    brand: {
      colorPrimary: '#1e3a8a',
      colorPrimaryForeground: '#FFFFFF',
      colorAccent: '#0ea5e9',
      fontHeading: 'Manrope',
      fontBody: 'Inter',
      tokens: { radiusBase: '8px' },
    },
    apply: true,
  },

  assets: [
    {
      id: 'logo',
      url: 'https://ui-avatars.com/api/?name=Ironline+Supply&background=1e3a8a&color=FFFFFF&bold=true&size=128&format=svg',
      alt: 'Ironline Supply Co.',
    },
    // Shop-by-category heroes.
    { id: 'cat-fasteners-hero', url: pic('il-fasteners', 600, 360), alt: 'Fasteners' },
    { id: 'cat-abrasives-hero', url: pic('il-abrasives', 600, 360), alt: 'Abrasives' },
    { id: 'cat-safety-hero', url: pic('il-safety', 600, 360), alt: 'Safety & PPE' },
    { id: 'cat-adhesives-hero', url: pic('il-adhesives', 600, 360), alt: 'Adhesives & sealants' },
    { id: 'cat-material-hero', url: pic('il-material', 600, 360), alt: 'Material handling' },
    { id: 'cat-shop-hero', url: pic('il-shop', 600, 360), alt: 'Shop supplies' },
    // Product images (one each).
    { id: 'capscrew-img', url: pic('il-capscrew', 1000, 1000), alt: 'Grade 8 hex cap screws' },
    { id: 'flapdisc-img', url: pic('il-flapdisc', 1000, 1000), alt: 'Zirconia flap discs' },
    { id: 'gloves-img', url: pic('il-gloves', 1000, 1000), alt: 'Cut-resistant work gloves' },
    { id: 'epoxy-img', url: pic('il-epoxy', 1000, 1000), alt: 'Industrial epoxy adhesive' },
    { id: 'straps-img', url: pic('il-straps', 1000, 1000), alt: 'Ratchet tie-down straps' },
    // From-the-floor featured images.
    { id: 'post-grade-img', url: pic('il-art-grade'), alt: 'Bolt-head grade markings' },
    { id: 'post-abrasive-img', url: pic('il-art-abrasive'), alt: 'Choosing the right abrasive grit' },
  ],

  // Lean on built-in content types (page, blog_post) — no custom types here.
  contentTypes: [],

  content: [
    {
      typeKey: 'blog_post',
      slug: 'reading-bolt-grade-markings',
      body: {
        title: 'Reading bolt-grade markings (and why they matter)',
        excerpt:
          'The radial lines on a bolt head aren’t decoration — they tell you the tensile strength your assembly is actually rated for.',
        body: doc(
          'Grab a handful of bolts from a mixed bin and you’ll see different patterns stamped on the heads — and those marks are the difference between a joint that holds and one that shears. On SAE fasteners, the radial lines tell the grade: three lines is Grade 5, six lines is Grade 8, and no lines is the low-strength Grade 2.',
          'Grade 8 is roughly 50% stronger in tensile strength than Grade 5, which is why it shows up in suspension, drivetrain, and structural work. But stronger isn’t always better — a higher-grade bolt is also more brittle, so spec to the engineer’s callout rather than just reaching for the toughest thing in the drawer.',
          'Metric fasteners use a stamped number instead — 8.8, 10.9, 12.9 — where the figure encodes the same tensile information. When you reorder, match the grade marking exactly; substituting down is a failure waiting to happen, and substituting up can be just as wrong.'
        ),
        featuredImage: assetRef('post-grade-img'),
      },
    },
    {
      typeKey: 'blog_post',
      slug: 'choosing-the-right-abrasive-grit',
      body: {
        title: 'Choosing the right abrasive grit for the job',
        excerpt:
          'Grind too coarse and you gouge; finish too fine and you glaze. A quick field guide to grit, backing, and material.',
        body: doc(
          'The fastest way to ruin a part — or burn through a box of discs — is using the wrong abrasive. Grit number is the headline: lower numbers (24–40) hog material fast for weld knockdown and heavy stock removal, mid grits (60–80) blend and shape, and higher grits (120+) finish and prep for paint.',
          'Backing and material matter just as much. Zirconia alumina cuts cooler and lasts longer on steel and stainless than standard aluminum oxide, and ceramic grain goes further still on hard alloys. Match the disc to the metal or you’ll either glaze the abrasive or load it up and lose your cut.',
          'Buy a step ladder of grits, not a single magic number — you almost always want to progress through two or three to get a clean result without chasing scratches. Stocking a working range by the case keeps the right disc on the shelf when the job hits the bench.'
        ),
        featuredImage: assetRef('post-abrasive-img'),
      },
    },
    {
      typeKey: 'page',
      slug: 'quotes',
      body: {
        title: 'Request a quote',
        excerpt: 'Send a part-number list and we’ll price it back — fast.',
        body: doc(
          'For anything beyond a single carton, a quote almost always beats list pricing. Send us a part-number list with the quantities you need and our team will price it back with your volume breaks, availability across all three warehouses, and a firm lead time — usually within one business day.',
          'Have a recurring order? We’ll set up a saved quote and standing reorder list so the next PO is a single click. Drop a PO number at checkout and we’ll route it to the right cost center; the invoice follows on your terms once a trade account is set up.',
          'To get started, email quotes@ironline.example with your list, or call a sourcing specialist at (555) 555-0144. No card is required to request a quote or apply for an account.'
        ),
      },
    },
    {
      typeKey: 'page',
      slug: 'shipping',
      body: {
        title: 'Shipping & lead times',
        excerpt: 'Same-day shipping from three regional warehouses, with freight for the heavy stuff.',
        body: doc(
          'We ship from three distribution centers — East, Central, and West — so most in-stock orders placed by 2pm local time go out the same day on a small-parcel carrier, and reach the majority of the country in one to three business days.',
          'Pallet and oversize orders move by LTL freight; we’ll quote the freight cost and lead time with your order and can arrange liftgate or inside delivery where you need it. Will-call pickup is available at each warehouse with an hour’s notice.',
          'Tracking is emailed automatically the moment a label is created, and trade-account customers can pull live order status and full shipment history any time from their account.'
        ),
      },
    },
  ],

  commerce: {
    categories: [
      { handle: 'fasteners', name: 'Fasteners', position: 0, featured: true, heroAssetId: 'cat-fasteners-hero' },
      { handle: 'abrasives', name: 'Abrasives', position: 1, featured: true, heroAssetId: 'cat-abrasives-hero' },
      { handle: 'safety', name: 'Safety & PPE', position: 2, heroAssetId: 'cat-safety-hero' },
      { handle: 'adhesives', name: 'Adhesives & Sealants', position: 3, heroAssetId: 'cat-adhesives-hero' },
      { handle: 'material-handling', name: 'Material Handling', position: 4, heroAssetId: 'cat-material-hero' },
      { handle: 'shop-supplies', name: 'Shop Supplies', position: 5, heroAssetId: 'cat-shop-hero' },
    ],
    collections: [
      {
        handle: 'featured',
        name: 'Top reorders',
        type: 'manual',
        featured: true,
        productHandles: [
          'grade-8-hex-cap-screws',
          'zirconia-flap-discs',
          'cut-resistant-gloves',
          'two-part-epoxy',
        ],
      },
    ],
    products: [
      {
        handle: 'grade-8-hex-cap-screws',
        title: 'Grade 8 Hex Cap Screws (1/2"-13 × 2", box of 50)',
        description:
          '<p>Grade 8 zinc-yellow hex cap screws for high-strength structural and drivetrain assembly.</p><p><strong>Spec:</strong> 1/2"-13 UNC × 2", SAE Grade 8 (150,000 PSI tensile), yellow zinc plating. <strong>Pack:</strong> box of 50. <strong>Std pack / case:</strong> 10 boxes.</p>',
        productType: 'Fasteners',
        vendor: 'Brighton-Best',
        tags: ['fastener', 'grade-8', 'hex-cap', 'box-of-50'],
        categoryHandles: ['fasteners'],
        collectionHandles: ['featured'],
        variants: [{ sku: 'FAS-G8-050213', priceCents: 4275, isDefault: true, position: 0 }],
        images: [{ assetId: 'capscrew-img', isPrimary: true, position: 0 }],
      },
      {
        handle: 'zirconia-flap-discs',
        title: 'Zirconia Flap Discs 4.5" 40-Grit (10-pack)',
        description:
          '<p>Zirconia alumina flap discs that cut cooler and last longer than aluminum oxide on steel and stainless.</p><p><strong>Spec:</strong> 4.5" × 7/8" arbor, Type 29 conical, 40 grit, max 13,300 RPM. <strong>Pack:</strong> 10 discs. <strong>Case:</strong> 20 packs.</p>',
        productType: 'Abrasives',
        vendor: 'Pferd',
        tags: ['abrasive', 'flap-disc', 'zirconia', '40-grit', '10-pack'],
        categoryHandles: ['abrasives'],
        collectionHandles: ['featured'],
        variants: [{ sku: 'ABR-FLZ-4540', priceCents: 3190, isDefault: true, position: 0 }],
        images: [{ assetId: 'flapdisc-img', isPrimary: true, position: 0 }],
      },
      {
        handle: 'cut-resistant-gloves',
        title: 'Cut-Resistant Work Gloves ANSI A4 (12 pairs)',
        description:
          '<p>Nitrile-coated, cut-resistant gloves for sheet metal, glass, and general fabrication handling.</p><p><strong>Spec:</strong> ANSI/ISEA cut level A4, foam-nitrile palm coating, size Large. <strong>Pack:</strong> 12 pairs. <strong>Case:</strong> 12 dozen.</p>',
        productType: 'Safety & PPE',
        vendor: 'Ironclad',
        tags: ['ppe', 'gloves', 'cut-resistant', 'ansi-a4', '12-pairs'],
        categoryHandles: ['safety'],
        collectionHandles: ['featured'],
        variants: [{ sku: 'PPE-CR-A4-LG', priceCents: 5460, isDefault: true, position: 0 }],
        images: [{ assetId: 'gloves-img', isPrimary: true, position: 0 }],
      },
      {
        handle: 'two-part-epoxy',
        title: 'Two-Part Structural Epoxy 50ml (12-pack)',
        description:
          '<p>High-strength two-part structural epoxy for metal, concrete, and composite bonding.</p><p><strong>Spec:</strong> 50ml dual cartridge, 1:1 mix, 5-minute work time, 3,000 PSI shear. <strong>Pack:</strong> 12 cartridges. <strong>Case:</strong> 6 packs. Static mixers included.</p>',
        productType: 'Adhesives & Sealants',
        vendor: '3M',
        tags: ['adhesive', 'epoxy', 'structural', '12-pack'],
        categoryHandles: ['adhesives'],
        collectionHandles: ['featured'],
        variants: [{ sku: 'ADH-EP2K-50', priceCents: 8930, isDefault: true, position: 0 }],
        images: [{ assetId: 'epoxy-img', isPrimary: true, position: 0 }],
      },
      {
        handle: 'ratchet-tie-down-straps',
        title: 'Ratchet Tie-Down Straps 2" × 27\' (4-pack)',
        description:
          '<p>Heavy-duty ratchet straps with flat hooks for securing equipment and pallets on flatbeds and trailers.</p><p><strong>Spec:</strong> 2" × 27\', 3,333 lb working load limit, 10,000 lb break strength, flat snap hooks. <strong>Pack:</strong> 4 straps. <strong>Case:</strong> 5 packs.</p>',
        productType: 'Material Handling',
        vendor: 'Erickson',
        tags: ['material-handling', 'tie-down', 'ratchet-strap', '4-pack'],
        categoryHandles: ['material-handling'],
        variants: [{ sku: 'MH-RTS-2027', priceCents: 6720, isDefault: true, position: 0 }],
        images: [{ assetId: 'straps-img', isPrimary: true, position: 0 }],
      },
    ],
  },

  components: [],

  layout: { name: 'Ironline layout', tree: siteLayoutTree(), makeActive: true },

  pages: [
    { name: 'Home', kind: 'singleton', tree: homeTree(), seoTitle: 'Ironline Supply Co. — Wholesale Industrial Supply' },
    { name: 'From the floor', kind: 'singleton', slug: 'journal', tree: journalIndexTree() },
    {
      name: 'Blog post',
      kind: 'collection',
      recordType: 'cms.blog_post',
      isDefault: true,
      tree: blogPostTree(),
    },
    {
      name: 'Product page',
      kind: 'collection',
      recordType: 'commerce.product',
      isDefault: true,
      tree: productTree(),
    },
    {
      name: 'Page',
      kind: 'collection',
      recordType: 'cms.page',
      isDefault: true,
      tree: pageTemplateTree(),
    },
  ],

  emails: [
    {
      name: 'Welcome',
      subject: 'Welcome to Ironline Supply Co.',
      preheader: 'The full catalog, spec sheets, and same-day shipping.',
      tree: welcomeEmailTree(),
    },
    {
      name: 'Restock & price breaks',
      subject: 'Restock & price breaks',
      preheader: 'Fast-movers back in depth, fresh pallet pricing, and a tip from the floor.',
      tree: restockEmailTree(),
    },
  ],
};

/** The wholesale industrial-supply blueprint, parsed + integrity-checked at module
 *  load so an invalid edit fails fast (and `defaults` are applied). */
export const wholesaleSupply: Blueprint = parseBlueprint(manifest);
