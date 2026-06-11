// An apparel boutique blueprint (docs/54 §12, sibling of retail-store-blog.ts):
// a small, considered clothing label — "Linen & Lark" — with a tight catalog of
// wardrobe pieces sold by Colour × Size, two lookbook journal entries, marketing
// emails, and a soft, editorial Linen & Lark theme. It exercises builder +
// commerce + cms + email. Everything installs to DRAFT (docs/54 D4); the tenant
// reviews, customizes, and goes live.
//
// Authoring notes:
//   · Trees are real @sparx/builder-schemas nodes (same JSON the editor emits)
//     and bind via tokens, so they re-theme to whatever tenant installs them.
//   · Colour options carry a swatchHex; size options are a segmented control.
//   · Static imagery in trees hot-links a raw URL (box.backgroundImage); imagery
//     bound to records (products, posts) comes from the seeded assets.

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
const rid = (t: string): string => `apl-${t}-${(nid += 1)}`;

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

// ── Page trees ─────────────────────────────────────────────────────────────────

function homeTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Home', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      // HERO — soft full-bleed editorial photo with a light scrim + light text.
      node('Section', {
        box: {
          name: 'Hero',
          height: 'lg',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
          backgroundImage: pic('linenlark-hero-editorial', 2000, 1100),
          overlay: 'dark',
          textTone: 'light',
        },
        layout: { direction: 'stack', gap: 'sm', justify: 'center', alignItems: 'center' },
        children: [
          node('Heading', { props: { level: 'h1', text: 'Slow clothes for the everyday.' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'A small wardrobe of natural-fibre pieces, cut to last and made in considered runs — the opposite of fast fashion.',
            },
          }),
          node('Button', {
            props: { label: 'Shop the edit', style: 'primary', href: '/products' },
          }),
        ],
      }),

      // SHOP — Commerce as one section; iterates products.
      node('Section', {
        box: { name: 'Shop', surface: 'subtle', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'The edit' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'A tight collection of pieces that work together — choose your colour and size on each one.',
            },
          }),
          node('Grid', {
            box: { name: 'Products grid', padding: 'none' },
            layout: { direction: 'grid', columns: 4, gap: 'lg' },
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

      // ETHOS band — a static photo beside the maker's note.
      node('Section', {
        box: { name: 'Ethos', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'row', gap: 'lg', alignItems: 'center' },
        children: [
          node('Section', {
            box: {
              name: 'Workshop photo',
              height: 'lg',
              backgroundWidth: 'full',
              contentWidth: 'full',
              padding: 'none',
              backgroundImage: pic('linenlark-workshop', 800, 1000),
            },
          }),
          node('Stack', {
            box: { name: 'Ethos copy', padding: 'none' },
            layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
            children: [
              node('Heading', { props: { level: 'h2', text: 'Fewer, better, kept for years' } }),
              node('Text', {
                props: {
                  variant: 'body',
                  text: 'We work in natural fibres — linen, organic cotton, wool — and make in small batches so nothing is overproduced or thrown at a landfill.',
                },
              }),
              node('Text', {
                props: {
                  variant: 'body',
                  text: 'Every piece is designed to be worn for years and mended rather than replaced. Buy one thing you love, and keep it.',
                },
              }),
            ],
          }),
        ],
      }),

      // LOOKBOOK — CMS as another section; iterates posts.
      node('Section', {
        box: { name: 'Lookbook', surface: 'subtle', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'The lookbook' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Seasonal stories and styling notes — how the pieces come together.',
            },
          }),
          node('Grid', {
            box: { name: 'Posts grid', padding: 'none' },
            layout: { direction: 'grid', columns: 2, gap: 'lg' },
            bind: 'cms.blog_post',
            children: [
              node('Card', {
                box: { name: 'Article card', surface: 'none', padding: 'sm' },
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

      // NEWSLETTER — centered band, bound to a CRM list.
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
          node('Heading', { props: { level: 'h2', text: 'First look, first dibs' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'New pieces, restocks, and seasonal stories — about once a month, never noisy.',
            },
          }),
          node('Signup', { props: { cta: 'Subscribe' }, bind: 'crm.list' }),
        ],
      }),
    ],
  });
}

function blogIndexTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Lookbook', padding: 'lg', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'The lookbook' } }),
      node('Text', {
        props: { variant: 'body', text: 'Seasonal stories and styling notes.' },
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
              node('Heading', { props: { level: 'h3', text: 'Linen & Lark' } }),
            ],
          }),
          node('NavMenu', {
            props: {
              orientation: 'row',
              links: [
                { label: 'Shop', href: '/products' },
                { label: 'Lookbook', href: '/lookbook' },
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
          node('Text', { props: { variant: 'meta', text: '© Linen & Lark' } }),
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
      node('Heading', { props: { level: 'h1', text: 'Welcome to Linen & Lark' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: "Thank you for joining us. We'll share new pieces, restocks, and the thinking behind how we make — slowly, and in small runs.",
        },
      }),
      node('Button', { props: { label: 'Shop the edit', href: '' }, box: { align: 'start' } }),
      node('Divider'),
      node('Text', { props: { variant: 'meta', text: 'Questions about fit or fabric? Just reply to this email.' } }),
    ],
  });
}

function newArrivalsEmailTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'New pieces, just landed' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'A few new wardrobe staples in fresh seasonal colours, plus a couple of favourites back in stock — made in small runs, so they go quietly.',
        },
      }),
      node('Button', { props: { label: 'See what’s new', href: '' }, box: { align: 'start' } }),
      node('Divider'),
      node('Text', {
        props: {
          variant: 'meta',
          text: "You're receiving this because you subscribed at Linen & Lark.",
        },
      }),
    ],
  });
}

// ── The manifest ───────────────────────────────────────────────────────────────

const manifest = {
  key: 'apparel-boutique',
  version: '1.0.0',
  name: 'Apparel Boutique',
  summary:
    'A small, considered clothing label with a tight catalog of natural-fibre wardrobe pieces sold by colour and size, a seasonal lookbook, marketing emails, and the soft editorial Linen & Lark theme — everything themed and ready to review.',
  vertical: 'retail',
  requiresModules: ['builder', 'commerce', 'cms', 'email'],

  brand: {
    businessName: 'Linen & Lark',
    tagline: 'Slow clothes for the everyday.',
    colors: {
      primary: '#44403c',
      primaryForeground: '#FFFFFF',
      accent: '#a8755a',
      secondary: '#1C1A17',
    },
    fonts: { heading: 'Libre Baskerville', body: 'Inter' },
    logoLightAssetId: 'logo',
  },

  // The NEW theme this blueprint ships (docs/54 D5): a named SiteTheme over the
  // `drift` preset — soft, warm and editorial to match the label identity above.
  theme: {
    name: 'Linen & Lark',
    basePresetKey: 'drift',
    presentation: { v: 2, containerWidth: '1140px' },
    brand: {
      colorPrimary: '#44403c',
      colorPrimaryForeground: '#FFFFFF',
      colorAccent: '#a8755a',
      fontHeading: 'Libre Baskerville',
      fontBody: 'Inter',
      tokens: { radiusBase: '8px' },
    },
    apply: true,
  },

  assets: [
    {
      id: 'logo',
      url: 'https://ui-avatars.com/api/?name=Linen+Lark&background=44403c&color=FFFFFF&bold=true&size=128&format=svg',
      alt: 'Linen & Lark',
    },
    // Lookbook featured images.
    { id: 'look-spring-img', url: pic('linenlark-look-spring', 800, 600), alt: 'Spring lookbook styling' },
    { id: 'look-layering-img', url: pic('linenlark-look-layering', 800, 600), alt: 'Layering staples flatlay' },
    // Product imagery.
    { id: 'prod-shirt', url: pic('linenlark-prod-shirt', 1000, 1000), alt: 'Linen shirt' },
    { id: 'prod-shirt-sand', url: pic('linenlark-prod-shirt-sand', 1000, 1000), alt: 'Linen shirt in sand' },
    { id: 'prod-shirt-slate', url: pic('linenlark-prod-shirt-slate', 1000, 1000), alt: 'Linen shirt in slate' },
    { id: 'prod-trouser', url: pic('linenlark-prod-trouser', 1000, 1000), alt: 'Wide-leg trouser' },
    { id: 'prod-trouser-black', url: pic('linenlark-prod-trouser-black', 1000, 1000), alt: 'Wide-leg trouser in black' },
    { id: 'prod-dress', url: pic('linenlark-prod-dress', 1000, 1000), alt: 'Tiered linen dress' },
    { id: 'prod-knit', url: pic('linenlark-prod-knit', 1000, 1000), alt: 'Merino crew knit' },
    { id: 'prod-tee', url: pic('linenlark-prod-tee', 1000, 1000), alt: 'Organic cotton tee' },
    // Category heroes.
    { id: 'cat-tops-hero', url: pic('linenlark-cat-tops'), alt: 'Tops' },
    { id: 'cat-bottoms-hero', url: pic('linenlark-cat-bottoms'), alt: 'Bottoms' },
    { id: 'cat-dresses-hero', url: pic('linenlark-cat-dresses'), alt: 'Dresses' },
  ],

  // Lean on built-in content types (page, blog_post) — no custom types in v1.
  contentTypes: [],

  content: [
    {
      typeKey: 'blog_post',
      slug: 'spring-in-three-pieces',
      body: {
        title: 'Spring in three pieces',
        excerpt: 'How the new-season linens layer into a whole wardrobe from just a handful of staples.',
        body: doc(
          'A good spring wardrobe does not need to be large; it needs to work together. This season we built everything around three pieces — the linen shirt, the wide-leg trouser, and the tiered dress.',
          'Start with the shirt: open over the dress on warm days, tucked into the trouser when the morning is cool. One colour, three silhouettes.',
          'The point of a small edit is that nothing is stranded. Every piece earns its place by pairing with the others, so getting dressed becomes a pleasure rather than a decision.'
        ),
        featuredImage: assetRef('look-spring-img'),
      },
    },
    {
      typeKey: 'blog_post',
      slug: 'the-art-of-layering',
      body: {
        title: 'The art of layering',
        excerpt: 'Natural fibres, neutral tones, and the quiet trick to dressing for an unpredictable day.',
        body: doc(
          'Layering is how a small wardrobe stretches across the seasons. The key is to stay within a tonal family so everything reads as one outfit rather than a pile of separates.',
          'We build from the skin out: a cotton tee, a linen shirt, then a merino knit for when the temperature drops. Each layer is light on its own, so the whole stays comfortable.',
          'Keep the colours close — sand, slate, oat — and the proportions varied. A boxy knit over a longer shirt, a wide trouser under a cropped layer. Simple parts, considered together.'
        ),
        featuredImage: assetRef('look-layering-img'),
      },
    },
    {
      typeKey: 'page',
      slug: 'about',
      body: {
        title: 'About Linen & Lark',
        excerpt: 'A small clothing label making slow, natural-fibre wardrobe pieces.',
        body: doc(
          'Linen & Lark started with a frustration: too many clothes made too quickly, in fabrics that pill, fade, and end up in a bin within a year.',
          'So we made the opposite. A tight collection of natural-fibre pieces — linen, organic cotton, merino — produced in small runs and designed to be worn, washed, and mended for years.',
          'We would rather sell you one thing you love than ten you forget. Fewer, better, kept — that is the whole idea.'
        ),
      },
    },
    {
      typeKey: 'page',
      slug: 'contact',
      body: {
        title: 'Contact & care',
        excerpt: 'Questions on fit, fabric, returns, or wholesale — we’d love to hear from you.',
        body: doc(
          'Email hello@linenandlark.example and a real person will reply within a business day. For fit and sizing questions, tell us your usual size and we will point you the right way.',
          'Returns are easy: unworn pieces with tags can come back within 30 days for a refund or exchange. We include a prepaid label with every order.',
          'For stockist and wholesale enquiries, reach out the same way with a little about your shop and we will route you to the right person.'
        ),
      },
    },
  ],

  commerce: {
    categories: [
      { handle: 'tops', name: 'Tops', position: 0, featured: true, heroAssetId: 'cat-tops-hero' },
      {
        handle: 'bottoms',
        name: 'Bottoms',
        position: 1,
        featured: true,
        heroAssetId: 'cat-bottoms-hero',
      },
      {
        handle: 'dresses',
        name: 'Dresses',
        position: 2,
        featured: true,
        heroAssetId: 'cat-dresses-hero',
      },
    ],
    collections: [
      {
        handle: 'the-edit',
        name: 'The Edit',
        type: 'manual',
        featured: true,
        productHandles: [
          'linen-shirt',
          'wide-leg-trouser',
          'tiered-linen-dress',
          'merino-crew-knit',
          'organic-cotton-tee',
        ],
      },
    ],
    products: [
      {
        handle: 'linen-shirt',
        title: 'Linen Shirt',
        description:
          '<p>A relaxed, breathable European-linen shirt that softens with every wash. The everyday hero of the edit.</p>',
        productType: 'Apparel',
        vendor: 'Linen & Lark',
        tags: ['shirt', 'linen', 'staple'],
        categoryHandles: ['tops'],
        collectionHandles: ['the-edit'],
        options: [
          {
            name: 'Color',
            displayType: 'swatch',
            position: 0,
            values: [
              { value: 'Oat', swatchHex: '#E7DDC9', position: 0 },
              { value: 'Sand', swatchHex: '#C8A97E', position: 1 },
              { value: 'Slate', swatchHex: '#5B6670', position: 2 },
            ],
          },
          {
            name: 'Size',
            displayType: 'segmented',
            position: 1,
            values: [
              { value: 'S', position: 0 },
              { value: 'M', position: 1 },
              { value: 'L', position: 2 },
            ],
          },
        ],
        variants: [
          { sku: 'SHIRT-OAT-S', optionValues: { Color: 'Oat', Size: 'S' }, priceCents: 9800, isDefault: true, position: 0 },
          { sku: 'SHIRT-OAT-M', optionValues: { Color: 'Oat', Size: 'M' }, priceCents: 9800, position: 1 },
          { sku: 'SHIRT-OAT-L', optionValues: { Color: 'Oat', Size: 'L' }, priceCents: 9800, position: 2 },
          { sku: 'SHIRT-SND-S', optionValues: { Color: 'Sand', Size: 'S' }, priceCents: 9800, position: 3 },
          { sku: 'SHIRT-SND-M', optionValues: { Color: 'Sand', Size: 'M' }, priceCents: 9800, position: 4 },
          { sku: 'SHIRT-SND-L', optionValues: { Color: 'Sand', Size: 'L' }, priceCents: 9800, position: 5 },
          { sku: 'SHIRT-SLT-S', optionValues: { Color: 'Slate', Size: 'S' }, priceCents: 9800, position: 6 },
          { sku: 'SHIRT-SLT-M', optionValues: { Color: 'Slate', Size: 'M' }, priceCents: 9800, position: 7 },
          { sku: 'SHIRT-SLT-L', optionValues: { Color: 'Slate', Size: 'L' }, priceCents: 9800, position: 8 },
        ],
        images: [
          { assetId: 'prod-shirt', isPrimary: true, position: 0 },
          { assetId: 'prod-shirt-sand', optionValues: { Color: 'Sand' }, position: 1 },
          { assetId: 'prod-shirt-slate', optionValues: { Color: 'Slate' }, position: 2 },
        ],
      },
      {
        handle: 'wide-leg-trouser',
        title: 'Wide-Leg Trouser',
        description:
          '<p>A high-waisted, fluid trouser in a heavyweight linen-cotton blend. Tailored enough for work, easy enough for the weekend.</p>',
        productType: 'Apparel',
        vendor: 'Linen & Lark',
        tags: ['trouser', 'bottoms'],
        categoryHandles: ['bottoms'],
        collectionHandles: ['the-edit'],
        options: [
          {
            name: 'Color',
            displayType: 'swatch',
            position: 0,
            values: [
              { value: 'Stone', swatchHex: '#B7AC9A', position: 0 },
              { value: 'Black', swatchHex: '#1C1A17', position: 1 },
            ],
          },
          {
            name: 'Size',
            displayType: 'segmented',
            position: 1,
            values: [
              { value: 'S', position: 0 },
              { value: 'M', position: 1 },
              { value: 'L', position: 2 },
            ],
          },
        ],
        variants: [
          { sku: 'TRS-STN-S', optionValues: { Color: 'Stone', Size: 'S' }, priceCents: 12800, isDefault: true, position: 0 },
          { sku: 'TRS-STN-M', optionValues: { Color: 'Stone', Size: 'M' }, priceCents: 12800, position: 1 },
          { sku: 'TRS-STN-L', optionValues: { Color: 'Stone', Size: 'L' }, priceCents: 12800, position: 2 },
          { sku: 'TRS-BLK-S', optionValues: { Color: 'Black', Size: 'S' }, priceCents: 12800, position: 3 },
          { sku: 'TRS-BLK-M', optionValues: { Color: 'Black', Size: 'M' }, priceCents: 12800, position: 4 },
          { sku: 'TRS-BLK-L', optionValues: { Color: 'Black', Size: 'L' }, priceCents: 12800, position: 5 },
        ],
        images: [
          { assetId: 'prod-trouser', isPrimary: true, position: 0 },
          { assetId: 'prod-trouser-black', optionValues: { Color: 'Black' }, position: 1 },
        ],
      },
      {
        handle: 'tiered-linen-dress',
        title: 'Tiered Linen Dress',
        description:
          '<p>An easy, tiered midi dress in airy washed linen — throw it on and go. Pockets, naturally.</p>',
        productType: 'Apparel',
        vendor: 'Linen & Lark',
        tags: ['dress', 'linen'],
        categoryHandles: ['dresses'],
        collectionHandles: ['the-edit'],
        options: [
          {
            name: 'Color',
            displayType: 'swatch',
            position: 0,
            values: [
              { value: 'Ecru', swatchHex: '#EDE6D6', position: 0 },
              { value: 'Olive', swatchHex: '#6B6B47', position: 1 },
            ],
          },
          {
            name: 'Size',
            displayType: 'segmented',
            position: 1,
            values: [
              { value: 'S', position: 0 },
              { value: 'M', position: 1 },
              { value: 'L', position: 2 },
            ],
          },
        ],
        variants: [
          { sku: 'DRS-ECR-S', optionValues: { Color: 'Ecru', Size: 'S' }, priceCents: 14800, isDefault: true, position: 0 },
          { sku: 'DRS-ECR-M', optionValues: { Color: 'Ecru', Size: 'M' }, priceCents: 14800, position: 1 },
          { sku: 'DRS-ECR-L', optionValues: { Color: 'Ecru', Size: 'L' }, priceCents: 14800, position: 2 },
          { sku: 'DRS-OLV-S', optionValues: { Color: 'Olive', Size: 'S' }, priceCents: 14800, position: 3 },
          { sku: 'DRS-OLV-M', optionValues: { Color: 'Olive', Size: 'M' }, priceCents: 14800, position: 4 },
          { sku: 'DRS-OLV-L', optionValues: { Color: 'Olive', Size: 'L' }, priceCents: 14800, position: 5 },
        ],
        images: [{ assetId: 'prod-dress', isPrimary: true, position: 0 }],
      },
      {
        handle: 'merino-crew-knit',
        title: 'Merino Crew Knit',
        description:
          '<p>A fine-gauge merino crewneck — lightweight, breathable, and warm without bulk. The layer the whole edit leans on.</p>',
        productType: 'Apparel',
        vendor: 'Linen & Lark',
        tags: ['knit', 'merino', 'tops'],
        categoryHandles: ['tops'],
        collectionHandles: ['the-edit'],
        options: [
          {
            name: 'Color',
            displayType: 'swatch',
            position: 0,
            values: [
              { value: 'Oat', swatchHex: '#E7DDC9', position: 0 },
              { value: 'Charcoal', swatchHex: '#36332F', position: 1 },
            ],
          },
          {
            name: 'Size',
            displayType: 'segmented',
            position: 1,
            values: [
              { value: 'S', position: 0 },
              { value: 'M', position: 1 },
              { value: 'L', position: 2 },
            ],
          },
        ],
        variants: [
          { sku: 'KNT-OAT-S', optionValues: { Color: 'Oat', Size: 'S' }, priceCents: 11800, isDefault: true, position: 0 },
          { sku: 'KNT-OAT-M', optionValues: { Color: 'Oat', Size: 'M' }, priceCents: 11800, position: 1 },
          { sku: 'KNT-OAT-L', optionValues: { Color: 'Oat', Size: 'L' }, priceCents: 11800, position: 2 },
          { sku: 'KNT-CHR-S', optionValues: { Color: 'Charcoal', Size: 'S' }, priceCents: 11800, position: 3 },
          { sku: 'KNT-CHR-M', optionValues: { Color: 'Charcoal', Size: 'M' }, priceCents: 11800, position: 4 },
          { sku: 'KNT-CHR-L', optionValues: { Color: 'Charcoal', Size: 'L' }, priceCents: 11800, position: 5 },
        ],
        images: [{ assetId: 'prod-knit', isPrimary: true, position: 0 }],
      },
      {
        handle: 'organic-cotton-tee',
        title: 'Organic Cotton Tee',
        description:
          '<p>A midweight organic-cotton tee with a clean, boxy cut — the foundation layer for everything else.</p>',
        productType: 'Apparel',
        vendor: 'Linen & Lark',
        tags: ['tee', 'cotton', 'tops'],
        categoryHandles: ['tops'],
        collectionHandles: ['the-edit'],
        options: [
          {
            name: 'Color',
            displayType: 'swatch',
            position: 0,
            values: [
              { value: 'White', swatchHex: '#F5F3EE', position: 0 },
              { value: 'Black', swatchHex: '#1C1A17', position: 1 },
              { value: 'Sage', swatchHex: '#9CA68C', position: 2 },
            ],
          },
          {
            name: 'Size',
            displayType: 'segmented',
            position: 1,
            values: [
              { value: 'S', position: 0 },
              { value: 'M', position: 1 },
              { value: 'L', position: 2 },
            ],
          },
        ],
        variants: [
          { sku: 'TEE-WHT-S', optionValues: { Color: 'White', Size: 'S' }, priceCents: 4800, isDefault: true, position: 0 },
          { sku: 'TEE-WHT-M', optionValues: { Color: 'White', Size: 'M' }, priceCents: 4800, position: 1 },
          { sku: 'TEE-WHT-L', optionValues: { Color: 'White', Size: 'L' }, priceCents: 4800, position: 2 },
          { sku: 'TEE-BLK-S', optionValues: { Color: 'Black', Size: 'S' }, priceCents: 4800, position: 3 },
          { sku: 'TEE-BLK-M', optionValues: { Color: 'Black', Size: 'M' }, priceCents: 4800, position: 4 },
          { sku: 'TEE-BLK-L', optionValues: { Color: 'Black', Size: 'L' }, priceCents: 4800, position: 5 },
          { sku: 'TEE-SGE-S', optionValues: { Color: 'Sage', Size: 'S' }, priceCents: 4800, position: 6 },
          { sku: 'TEE-SGE-M', optionValues: { Color: 'Sage', Size: 'M' }, priceCents: 4800, position: 7 },
          { sku: 'TEE-SGE-L', optionValues: { Color: 'Sage', Size: 'L' }, priceCents: 4800, position: 8 },
        ],
        images: [{ assetId: 'prod-tee', isPrimary: true, position: 0 }],
      },
    ],
  },

  components: [],

  layout: { name: 'Linen & Lark layout', tree: siteLayoutTree(), makeActive: true },

  pages: [
    { name: 'Home', kind: 'singleton', tree: homeTree(), seoTitle: 'Linen & Lark' },
    { name: 'Lookbook', kind: 'singleton', slug: 'lookbook', tree: blogIndexTree() },
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
      subject: 'Welcome to Linen & Lark',
      preheader: 'You’re on the list — fewer, better, kept for years.',
      tree: welcomeEmailTree(),
    },
    {
      name: 'New arrivals',
      subject: 'New pieces, just landed',
      preheader: 'Fresh seasonal colours and a couple of restocks, in small runs.',
      tree: newArrivalsEmailTree(),
    },
  ],
};

export const apparelBoutique: Blueprint = parseBlueprint(manifest);
