// The flagship blueprint (docs/54 §12): a general retail store + blog that
// exercises every module — brand + a NEW shipped theme, CMS content types/items,
// a commerce catalog with a variant product, builder pages + the site layout, a
// tenant component, and marketing emails. Everything installs to DRAFT (docs/54
// D4); the tenant reviews, customizes, and goes live.
//
// Authoring notes:
//   · Trees are real @sparx/builder-schemas nodes (same JSON the editor emits)
//     and bind via tokens, so they re-theme to whatever tenant installs them.
//   · Static imagery in trees hot-links a raw URL (box.backgroundImage); imagery
//     bound to records (products, posts) comes from the seeded assets.
//   · Placeholder images hot-link picsum.photos — swap for owned media when the
//     install path moves to copy-into-tenant-media (docs/54 §6 deferred).

import {
  customType,
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
const rid = (t: string): string => `rsb-${t}-${(nid += 1)}`;

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

// ── Tenant component: a branded promo banner (docs/53) ─────────────────────────
// Parameterized via propSpec slots; placed on the home page below. Publish-time
// expansion turns the `custom:promo_banner` placement into primitives.

function promoBannerTree(): BuilderNode {
  return node('Section', {
    box: {
      name: 'Promo banner',
      surface: 'inverse',
      backgroundWidth: 'full',
      contentWidth: 'contained',
      align: 'center',
      padding: 'xl',
    },
    layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'center' },
    children: [
      node('Heading', { props: { level: 'h2', text: { $prop: 'heading' } } }),
      node('Text', { props: { variant: 'body', text: { $prop: 'body' } } }),
      node('Button', {
        props: { label: { $prop: 'buttonLabel' }, href: { $prop: 'buttonHref' }, style: 'soft' },
      }),
    ],
  });
}

// ── Page trees ─────────────────────────────────────────────────────────────────

function homeTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Home', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      // HERO — static full-bleed photo (hot-linked) with a dark scrim + light text.
      node('Section', {
        box: {
          name: 'Hero',
          height: 'lg',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
          backgroundImage: pic('driftwood-hero', 2000, 1100),
          overlay: 'dark',
          textTone: 'light',
        },
        layout: { direction: 'stack', gap: 'sm', justify: 'center', alignItems: 'center' },
        children: [
          node('Heading', { props: { level: 'h1', text: 'Everyday goods, built to last' } }),
          node('Text', {
            props: { variant: 'body', text: 'Considered staples for home and wardrobe.' },
          }),
          node('Button', {
            props: {
              label: 'Shop the collection',
              style: 'primary',
              href: '/collections/featured',
            },
          }),
        ],
      }),

      // PROMO — a tenant component placement (pinned to v1; instance values here).
      node(customType('promo_banner'), {
        props: {
          $ref: { version: 1 },
          heading: 'Spring refresh — 20% off',
          body: 'New-season staples, priced to move.',
          buttonLabel: 'Shop the sale',
          buttonHref: '/collections/featured',
        },
      }),

      // SHOP — Commerce as one section; iterates products.
      node('Section', {
        box: { name: 'Featured', surface: 'subtle', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'Featured goods' } }),
          node('Grid', {
            box: { name: 'Products grid', padding: 'none' },
            layout: { direction: 'grid', columns: 3, gap: 'lg' },
            bind: 'commerce.product',
            children: [
              node('Card', {
                box: { name: 'Product card', surface: 'none', padding: 'sm' },
                layout: { direction: 'stack', gap: 'sm' },
                children: [
                  node('ImageDisplay', { props: { ratio: 'square' }, bind: 'item.images' }),
                  node('Heading', { props: { level: 'h3' }, bind: 'item.title' }),
                  node('PriceTag', { bind: 'item.price' }),
                  node('Button', { props: { label: 'View', style: 'soft' } }),
                ],
              }),
            ],
          }),
        ],
      }),

      // WRITING — CMS as another section; iterates posts.
      node('Section', {
        box: { name: 'Journal', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'From the journal' } }),
          node('Grid', {
            box: { name: 'Posts grid', padding: 'none' },
            layout: { direction: 'grid', columns: 3, gap: 'lg' },
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

      // NEWSLETTER — centered band, bound to a CRM list (sets scope).
      node('Section', {
        box: {
          name: 'Newsletter',
          surface: 'inverse',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
        },
        layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'center' },
        bind: 'crm.list',
        children: [
          node('Heading', { props: { level: 'h2', text: 'Join the list' } }),
          node('Text', {
            props: { variant: 'body', text: 'Early access and the occasional good read.' },
          }),
          node('Signup', { props: { cta: 'Subscribe' }, bind: 'crm.list' }),
        ],
      }),
    ],
  });
}

function blogIndexTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Journal', padding: 'lg', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'The journal' } }),
      node('Text', {
        props: { variant: 'body', text: 'Notes on materials, makers, and the long game.' },
      }),
      node('Grid', {
        box: { name: 'Posts grid', padding: 'none' },
        layout: { direction: 'grid', columns: 3, gap: 'lg' },
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
          surface: 'muted',
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
              node('PriceTag', { bind: 'product.price' }),
              node('Text', { props: { variant: 'body' }, bind: 'product.description' }),
              node('Button', { props: { label: 'Add to cart', style: 'primary' } }),
            ],
          }),
        ],
      }),
    ],
  });
}

// A `cms.page` template (About, Contact, …) — binds the page entry's fields.
function pageTemplateTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Page', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      node('Section', {
        box: {
          name: 'Header',
          height: 'sm',
          surface: 'subtle',
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
              node('Heading', { props: { level: 'h3', text: 'Driftwood Supply Co.' } }),
            ],
          }),
          node('NavMenu', {
            props: {
              orientation: 'row',
              links: [
                { label: 'Shop', href: '/products' },
                { label: 'Journal', href: '/blog' },
                { label: 'About', href: '/about' },
                { label: 'Contact', href: '/contact' },
              ],
            },
          }),
        ],
      }),
      node('Outlet', { box: { padding: 'none', backgroundWidth: 'full', contentWidth: 'full' } }),
      node('Section', {
        box: {
          name: 'Footer',
          surface: 'muted',
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
                { label: 'Shop', href: '/products' },
                { label: 'About', href: '/about' },
                { label: 'Contact', href: '/contact' },
              ],
            },
          }),
          node('SocialLinks', { bind: 'site.social' }),
          node('Text', { props: { variant: 'meta', text: '© Driftwood Supply Co.' } }),
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
      node('Heading', { props: { level: 'h1', text: 'Welcome to Driftwood 👋' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: "Thanks for joining — here's a look at what we make and why.",
        },
      }),
      node('Button', { props: { label: 'Shop new arrivals', href: '' }, box: { align: 'start' } }),
      node('Divider'),
      node('Text', { props: { variant: 'meta', text: 'Questions? Just reply to this email.' } }),
    ],
  });
}

function dispatchEmailTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'Fresh picks this week' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'A few new things we think you’ll like, plus a note from the workshop.',
        },
      }),
      node('Button', { props: { label: 'See what’s new', href: '' }, box: { align: 'start' } }),
      node('Divider'),
      node('Text', {
        props: {
          variant: 'meta',
          text: 'You’re receiving this because you subscribed at driftwood.',
        },
      }),
    ],
  });
}

// ── The manifest ───────────────────────────────────────────────────────────────

const manifest = {
  key: 'retail-store-blog',
  version: '0.1.0',
  name: 'Retail Store + Blog',
  summary:
    'A clean direct-to-consumer storefront with a small catalog, a journal/blog, marketing emails, and the Driftwood theme — everything themed and ready to review.',
  vertical: 'retail',
  // Marketplace preview — a screenshot of the installed Driftwood home, served
  // from the dashboard's public/ (apps/dashboard/public/blueprint-previews/).
  preview: '/blueprint-previews/retail-store-blog.png',
  requiresModules: ['builder', 'commerce', 'cms', 'email'],

  brand: {
    businessName: 'Driftwood Supply Co.',
    tagline: 'Everyday goods, built to last.',
    colors: {
      primary: '#3F6212',
      primaryForeground: '#FFFFFF',
      accent: '#B45309',
      secondary: '#1C1917',
    },
    fonts: { heading: 'Fraunces', body: 'Inter' },
    logoLightAssetId: 'logo',
  },

  // The NEW theme the blueprint ships (docs/54 D5): a named SiteTheme over the
  // `market` preset, with a brand look that matches the identity colors above.
  theme: {
    name: 'Driftwood',
    basePresetKey: 'market',
    presentation: { v: 2, containerWidth: '1200px' },
    brand: {
      colorPrimary: '#3F6212',
      colorPrimaryForeground: '#FFFFFF',
      colorAccent: '#B45309',
      fontHeading: 'Fraunces',
      fontBody: 'Inter',
      tokens: { radiusBase: '8px' },
    },
    apply: true,
  },

  assets: [
    {
      id: 'logo',
      url: 'https://ui-avatars.com/api/?name=Driftwood+Supply&background=3F6212&color=FFFFFF&bold=true&size=128&format=svg',
      alt: 'Driftwood Supply Co.',
    },
    { id: 'blog-1-img', url: pic('post-materials'), alt: 'Raw materials on a workbench' },
    { id: 'blog-2-img', url: pic('post-care'), alt: 'Folded garments' },
    { id: 'blog-3-img', url: pic('post-makers'), alt: 'A maker at work' },
    { id: 'tee-front', url: pic('tee-front', 1000, 1000), alt: 'Classic tee, front' },
    { id: 'tee-black', url: pic('tee-black', 1000, 1000), alt: 'Classic tee in black' },
    { id: 'tee-white', url: pic('tee-white', 1000, 1000), alt: 'Classic tee in white' },
    { id: 'tote-img', url: pic('canvas-tote', 1000, 1000), alt: 'Canvas tote bag' },
    { id: 'mug-img', url: pic('enamel-mug', 1000, 1000), alt: 'Enamel mug' },
    { id: 'beanie-img', url: pic('wool-beanie', 1000, 1000), alt: 'Wool beanie' },
    { id: 'jacket-img', url: pic('denim-jacket', 1000, 1000), alt: 'Denim jacket' },
    { id: 'cat-tops-hero', url: pic('cat-tops'), alt: 'Tops & tees' },
    { id: 'cat-acc-hero', url: pic('cat-accessories'), alt: 'Accessories' },
  ],

  // Lean on built-in content types (page, blog_post) — no custom types in v1.
  contentTypes: [],

  content: [
    {
      typeKey: 'blog_post',
      slug: 'made-to-last',
      body: {
        title: 'Made to last',
        excerpt: 'Why we obsess over materials — and what “durable” really means.',
        body: doc(
          'Durability is a series of small decisions: the weight of a fabric, the density of a stitch, the way a seam is finished.',
          'We start every product from the material up, then design around what it can actually do over years of use.'
        ),
        featuredImage: assetRef('blog-1-img'),
      },
    },
    {
      typeKey: 'blog_post',
      slug: 'care-guide',
      body: {
        title: 'A simple care guide',
        excerpt: 'Keep your goods going for years with a few easy habits.',
        body: doc(
          'Most wear comes from how we wash, not how we use. Cooler water, gentler cycles, and air drying do most of the work.',
          'A little care up front means a lot less landfill later — and a product that ages the way it should.'
        ),
        featuredImage: assetRef('blog-2-img'),
      },
    },
    {
      typeKey: 'blog_post',
      slug: 'meet-the-makers',
      body: {
        title: 'Meet the makers',
        excerpt: 'The people and small workshops behind the things we sell.',
        body: doc(
          'We work with a short list of makers we trust, and we visit when we can. Knowing the hands behind a product changes how it’s made.',
          'This is the first in a series of profiles from the workshop floor.'
        ),
        featuredImage: assetRef('blog-3-img'),
      },
    },
    {
      typeKey: 'page',
      slug: 'about',
      body: {
        title: 'About Driftwood',
        excerpt: 'A small shop for well-made everyday goods.',
        body: doc(
          'Driftwood Supply Co. started with a simple idea: buy fewer, better things and keep them longer.',
          'We design and source a tight catalog of staples for home and wardrobe, and we write about the choices behind them.'
        ),
      },
    },
    {
      typeKey: 'page',
      slug: 'contact',
      body: {
        title: 'Contact us',
        excerpt: 'Questions, wholesale, or press — we’d love to hear from you.',
        body: doc(
          'Email hello@driftwood.example and we’ll get back within a business day.',
          'For wholesale and press, include a few details and we’ll route you to the right person.'
        ),
      },
    },
  ],

  commerce: {
    categories: [
      { handle: 'apparel', name: 'Apparel', position: 0, featured: true },
      {
        handle: 'tops',
        name: 'Tops & Tees',
        parentHandle: 'apparel',
        position: 0,
        heroAssetId: 'cat-tops-hero',
      },
      {
        handle: 'accessories',
        name: 'Accessories',
        position: 1,
        featured: true,
        heroAssetId: 'cat-acc-hero',
      },
    ],
    collections: [
      {
        handle: 'featured',
        name: 'Featured',
        type: 'manual',
        featured: true,
        productHandles: ['classic-tee', 'denim-jacket', 'wool-beanie'],
      },
    ],
    products: [
      {
        handle: 'classic-tee',
        title: 'Classic Tee',
        description: '<p>A midweight everyday tee in soft combed cotton.</p>',
        productType: 'Apparel',
        vendor: 'Driftwood',
        tags: ['tee', 'staple'],
        categoryHandles: ['tops'],
        collectionHandles: ['featured'],
        options: [
          {
            name: 'Color',
            displayType: 'swatch',
            position: 0,
            values: [
              { value: 'Black', swatchHex: '#1C1917', position: 0 },
              { value: 'White', swatchHex: '#FFFFFF', position: 1 },
            ],
          },
          {
            name: 'Size',
            displayType: 'segmented',
            position: 1,
            values: [
              { value: 'S', position: 0 },
              { value: 'M', position: 1 },
            ],
          },
        ],
        variants: [
          {
            sku: 'TEE-BLK-S',
            optionValues: { Color: 'Black', Size: 'S' },
            priceCents: 2400,
            isDefault: true,
            position: 0,
          },
          {
            sku: 'TEE-BLK-M',
            optionValues: { Color: 'Black', Size: 'M' },
            priceCents: 2400,
            position: 1,
          },
          {
            sku: 'TEE-WHT-S',
            optionValues: { Color: 'White', Size: 'S' },
            priceCents: 2400,
            position: 2,
          },
          {
            sku: 'TEE-WHT-M',
            optionValues: { Color: 'White', Size: 'M' },
            priceCents: 2400,
            position: 3,
          },
        ],
        images: [
          { assetId: 'tee-front', isPrimary: true, position: 0 },
          { assetId: 'tee-black', optionValues: { Color: 'Black' }, position: 1 },
          { assetId: 'tee-white', optionValues: { Color: 'White' }, position: 2 },
        ],
      },
      {
        handle: 'denim-jacket',
        title: 'Denim Jacket',
        description: '<p>A rigid selvedge denim jacket that breaks in over time.</p>',
        productType: 'Apparel',
        vendor: 'Driftwood',
        tags: ['denim', 'outerwear'],
        categoryHandles: ['tops'],
        collectionHandles: ['featured'],
        variants: [
          {
            sku: 'JKT-IND',
            priceCents: 8900,
            compareAtPriceCents: 11900,
            isDefault: true,
            position: 0,
          },
        ],
        images: [{ assetId: 'jacket-img', isPrimary: true, position: 0 }],
      },
      {
        handle: 'wool-beanie',
        title: 'Wool Beanie',
        description: '<p>A warm ribbed beanie in a soft merino blend.</p>',
        productType: 'Accessories',
        vendor: 'Driftwood',
        tags: ['hat', 'winter'],
        categoryHandles: ['accessories'],
        collectionHandles: ['featured'],
        variants: [{ sku: 'BEANIE-CHR', priceCents: 2800, isDefault: true, position: 0 }],
        images: [{ assetId: 'beanie-img', isPrimary: true, position: 0 }],
      },
      {
        handle: 'canvas-tote',
        title: 'Canvas Tote',
        description: '<p>A heavyweight cotton-canvas tote for the daily haul.</p>',
        productType: 'Accessories',
        vendor: 'Driftwood',
        tags: ['bag'],
        categoryHandles: ['accessories'],
        variants: [{ sku: 'TOTE-NAT', priceCents: 1800, isDefault: true, position: 0 }],
        images: [{ assetId: 'tote-img', isPrimary: true, position: 0 }],
      },
      {
        handle: 'enamel-mug',
        title: 'Enamel Mug',
        description: '<p>A classic camp-style enamel mug, 12oz.</p>',
        productType: 'Accessories',
        vendor: 'Driftwood',
        tags: ['kitchen'],
        categoryHandles: ['accessories'],
        variants: [{ sku: 'MUG-WHT', priceCents: 1400, isDefault: true, position: 0 }],
        images: [{ assetId: 'mug-img', isPrimary: true, position: 0 }],
      },
    ],
  },

  components: [
    {
      key: 'promo_banner',
      name: 'Promo banner',
      group: 'content',
      icon: 'megaphone',
      description: 'A full-width call-to-action band with a heading, body, and button.',
      surfaces: ['page'],
      tree: promoBannerTree(),
      propSpec: [
        { key: 'heading', label: 'Heading', kind: 'text', default: 'Big news' },
        { key: 'body', label: 'Body', kind: 'text' },
        { key: 'buttonLabel', label: 'Button label', kind: 'text', default: 'Learn more' },
        { key: 'buttonHref', label: 'Button link', kind: 'url' },
      ],
    },
  ],

  layout: { name: 'Driftwood layout', tree: siteLayoutTree(), makeActive: true },

  pages: [
    { name: 'Home', kind: 'singleton', tree: homeTree(), seoTitle: 'Driftwood Supply Co.' },
    { name: 'Journal', kind: 'singleton', slug: 'blog', tree: blogIndexTree() },
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
      subject: 'Welcome to Driftwood 👋',
      preheader: 'You’re in — here’s what we’re about.',
      tree: welcomeEmailTree(),
    },
    {
      name: 'Monthly dispatch',
      subject: 'Fresh picks this week',
      preheader: 'New arrivals and a note from the workshop.',
      tree: dispatchEmailTree(),
    },
  ],
};

/** The flagship blueprint, parsed + integrity-checked at module load so an
 *  invalid edit fails fast (and `defaults` are applied). */
export const retailStoreBlog: Blueprint = parseBlueprint(manifest);
