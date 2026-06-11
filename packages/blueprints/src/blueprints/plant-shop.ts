// A houseplant shop blueprint ("Fern & Stone") — a fresh, botanical storefront
// for a plant studio. Sibling of retail-store-blog.ts: it exercises the same
// modules (brand + a NEW shipped theme over `market`, CMS content, a commerce
// catalog, builder pages + the site layout, marketing emails). Each plant is
// sold in three pot sizes via a single segmented "Size" option, so this is the
// example that declares an option lattice. Everything installs to DRAFT
// (docs/54 D4); the tenant reviews, customizes, and goes live.
//
// Authoring notes (mirror retail-store-blog.ts):
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
const rid = (t: string): string => `plt-${t}-${(nid += 1)}`;

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

/** The single size option, reused on every plant (declared BEFORE variants). */
const sizeOption = {
  name: 'Size',
  displayType: 'segmented' as const,
  position: 0,
  values: [
    { value: 'Small', position: 0 },
    { value: 'Medium', position: 1 },
    { value: 'Large', position: 2 },
  ],
};

/** Build the three size variants for a plant, given a SKU stem and base price.
 *  Medium is the default; Large adds 40%, Small subtracts 30% (rounded to cents). */
function sizeVariants(
  stem: string,
  mediumCents: number
): {
  sku: string;
  optionValues: Record<string, string>;
  priceCents: number;
  isDefault?: boolean;
  position: number;
}[] {
  const small = Math.round(mediumCents * 0.7);
  const large = Math.round(mediumCents * 1.4);
  return [
    {
      sku: `${stem}-SM`,
      optionValues: { Size: 'Small' },
      priceCents: small,
      position: 0,
    },
    {
      sku: `${stem}-MD`,
      optionValues: { Size: 'Medium' },
      priceCents: mediumCents,
      isDefault: true,
      position: 1,
    },
    {
      sku: `${stem}-LG`,
      optionValues: { Size: 'Large' },
      priceCents: large,
      position: 2,
    },
  ];
}

// ── Page trees ─────────────────────────────────────────────────────────────────

function homeTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Home', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      // HERO — full-bleed greenhouse photo, soft dark scrim + light text.
      node('Section', {
        box: {
          name: 'Hero',
          height: 'lg',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
          backgroundImage: pic('fern-hero-greenhouse', 2000, 1100),
          overlay: 'dark',
          textTone: 'light',
        },
        layout: { direction: 'stack', gap: 'sm', justify: 'center', alignItems: 'center' },
        children: [
          node('Heading', {
            props: { level: 'h1', text: 'Plants that are easy to keep alive.' },
          }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Studio-grown houseplants chosen for real homes — hardy, healthy, and shipped in their nursery pot with a care card. Pick your size and we’ll do the rest.',
            },
          }),
          node('Button', {
            props: {
              label: 'Shop the plants',
              style: 'primary',
              href: '/collections/featured',
            },
          }),
        ],
      }),

      // SHOP — Commerce as one section; iterates products.
      node('Section', {
        box: { name: 'Featured', surface: 'subtle', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'This week’s healthiest.' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Every plant is hand-picked off the bench the morning it ships. Choose Small, Medium, or Large at checkout.',
            },
          }),
          node('Grid', {
            box: { name: 'Plants grid', padding: 'none' },
            layout: { direction: 'grid', columns: 3, gap: 'lg' },
            bind: 'commerce.product',
            children: [
              node('Card', {
                box: { name: 'Plant card', surface: 'none', padding: 'sm' },
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

      // CARE PROMISE — about band, photo beside copy (static photo via box.backgroundImage).
      node('Section', {
        box: { name: 'Care promise', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'row', gap: 'lg', alignItems: 'center' },
        children: [
          node('Card', {
            box: {
              name: 'Studio photo',
              height: 'lg',
              padding: 'none',
              backgroundImage: pic('fern-studio', 800, 960),
            },
            layout: { direction: 'stack', gap: 'none' },
          }),
          node('Stack', {
            box: { name: 'Care copy', padding: 'none' },
            layout: { direction: 'stack', gap: 'sm' },
            children: [
              node('Heading', {
                props: { level: 'h2', text: 'Grown slowly, shipped happy.' },
              }),
              node('Text', {
                props: {
                  variant: 'body',
                  text: 'We grow on in our own studio so every plant is acclimated to indoor light before it leaves us. Each one ships double-boxed with a plain-language care card and a 30-day healthy-arrival promise.',
                },
              }),
              node('Button', {
                box: { align: 'start' },
                props: { label: 'How we ship', style: 'soft', href: '/about' },
              }),
            ],
          }),
        ],
      }),

      // CARE GUIDES — CMS as a section; iterates posts.
      node('Section', {
        box: { name: 'Care guides', surface: 'muted', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'Plant care, plainly.' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Short, honest guides for keeping your plants thriving — no jargon, no guilt.',
            },
          }),
          node('Grid', {
            box: { name: 'Posts grid', padding: 'none' },
            layout: { direction: 'grid', columns: 3, gap: 'lg' },
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

      // CONVERSION BAND — centered inverse band with the newsletter signup.
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
          node('Heading', { props: { level: 'h2', text: 'New drops and care tips, monthly.' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'One friendly email a month: fresh plants off the bench and a seasonal care tip. That’s it.',
            },
          }),
          node('Signup', { props: { cta: 'Subscribe' }, bind: 'crm.list' }),
        ],
      }),
    ],
  });
}

function guideIndexTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Care guides', padding: 'lg', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'Care guides' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'Short, honest guides for keeping your plants thriving — no jargon, no guilt.',
        },
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
    box: { name: 'Care guide', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
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
      name: 'Plant page',
      padding: 'lg',
      backgroundWidth: 'full',
      contentWidth: 'contained',
    },
    layout: { direction: 'stack', gap: 'lg' },
    children: [
      node('Section', {
        box: { name: 'Plant', padding: 'none', contentWidth: 'full' },
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
              node('Heading', { props: { level: 'h3', text: 'Fern & Stone' } }),
            ],
          }),
          node('NavMenu', {
            props: {
              orientation: 'row',
              links: [
                { label: 'Shop', href: '/products' },
                { label: 'Care guides', href: '/guides' },
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
                { label: 'Care guides', href: '/guides' },
                { label: 'Contact', href: '/contact' },
              ],
            },
          }),
          node('SocialLinks', { bind: 'site.social' }),
          node('Text', { props: { variant: 'meta', text: '© Fern & Stone' } }),
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
      node('Heading', { props: { level: 'h1', text: 'Welcome to Fern & Stone 🌿' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'Thanks for joining — here’s a little welcome from the studio. Once a month we send fresh plants off the bench and a seasonal care tip.',
        },
      }),
      node('Button', { props: { label: 'Shop the plants', href: '' }, box: { align: 'start' } }),
      node('Divider'),
      node('Text', {
        props: { variant: 'meta', text: 'New to plants? Just reply — we love an easy question.' },
      }),
    ],
  });
}

function dropEmailTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'Fresh off the bench' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'This month’s healthiest plants are ready to ship, plus a quick seasonal tip to keep yours thriving.',
        },
      }),
      node('Button', { props: { label: 'See what’s new', href: '' }, box: { align: 'start' } }),
      node('Divider'),
      node('Text', {
        props: {
          variant: 'meta',
          text: 'You’re receiving this because you subscribed at Fern & Stone.',
        },
      }),
    ],
  });
}

// ── The manifest ───────────────────────────────────────────────────────────────

const manifest = {
  key: 'plant-shop',
  version: '1.0.0',
  name: 'Plant Shop',
  summary:
    'A fresh, botanical storefront for a houseplant studio — hardy studio-grown plants in three pot sizes, a healthy-arrival promise, and plain-language care guides — themed and ready to review.',
  vertical: 'retail',
  requiresModules: ['builder', 'commerce', 'cms', 'email'],

  brand: {
    businessName: 'Fern & Stone',
    tagline: 'Plants that are easy to keep alive.',
    colors: {
      primary: '#4d7c5a',
      primaryForeground: '#FFFFFF',
      accent: '#a3b18a',
      secondary: '#2f3e34',
    },
    fonts: { heading: 'Fraunces', body: 'Nunito Sans' },
    logoLightAssetId: 'logo',
  },

  // The NEW theme this blueprint ships (docs/54 D5): a named SiteTheme over the
  // `market` preset — a calm garden green with a soft sage accent.
  theme: {
    name: 'Fern',
    basePresetKey: 'market',
    presentation: { v: 2, containerWidth: '1140px' },
    brand: {
      colorPrimary: '#4d7c5a',
      colorPrimaryForeground: '#FFFFFF',
      colorAccent: '#a3b18a',
      fontHeading: 'Fraunces',
      fontBody: 'Nunito Sans',
      tokens: { radiusBase: '8px' },
    },
    apply: true,
  },

  assets: [
    {
      id: 'logo',
      url: 'https://ui-avatars.com/api/?name=Fern+Stone&background=4d7c5a&color=FFFFFF&bold=true&size=128&format=svg',
      alt: 'Fern & Stone',
    },
    // Care-guide featured images.
    {
      id: 'guide-water-img',
      url: pic('fern-guide-water', 1200, 750),
      alt: 'Watering a houseplant',
    },
    {
      id: 'guide-light-img',
      url: pic('fern-guide-light', 1200, 750),
      alt: 'A plant on a sunny windowsill',
    },
    {
      id: 'guide-repot-img',
      url: pic('fern-guide-repot', 1200, 750),
      alt: 'Repotting a plant with fresh soil',
    },
    // Plant images (one each).
    { id: 'monstera-img', url: pic('fern-monstera', 1000, 1000), alt: 'Monstera deliciosa' },
    { id: 'snake-img', url: pic('fern-snake', 1000, 1000), alt: 'Snake plant' },
    { id: 'pothos-img', url: pic('fern-pothos', 1000, 1000), alt: 'Golden pothos' },
    { id: 'zz-img', url: pic('fern-zz', 1000, 1000), alt: 'ZZ plant' },
    { id: 'figleaf-img', url: pic('fern-figleaf', 1000, 1000), alt: 'Fiddle-leaf fig' },
  ],

  // Lean on built-in content types (page, blog_post) — no custom types.
  contentTypes: [],

  content: [
    {
      typeKey: 'blog_post',
      slug: 'how-much-to-water',
      body: {
        title: 'How much to water (less than you think)',
        excerpt:
          'More houseplants die from kindness than neglect. Here’s the simple finger-test that ends overwatering for good.',
        body: doc(
          'Overwatering is the number-one way a healthy houseplant goes downhill, and it almost always comes from good intentions — a splash every day "just in case." Most plants would much rather you forgot them for a week.',
          'The test is your finger: push it two knuckles into the soil. If it comes out with damp soil clinging to it, wait. If it’s dry, water thoroughly until it runs from the drainage holes, then empty the saucer.',
          'Water deeply and infrequently, not little and often. Roots that have to reach for water grow stronger; roots that sit in it rot.'
        ),
        featuredImage: assetRef('guide-water-img'),
      },
    },
    {
      typeKey: 'blog_post',
      slug: 'reading-the-light-in-your-home',
      body: {
        title: 'Reading the light in your home',
        excerpt:
          '“Bright indirect light” means something specific. Here’s how to find it without a light meter.',
        body: doc(
          'Almost every care tag says "bright, indirect light," but that phrase only helps if you can spot it. The trick: hold your hand a foot above the spot at midday and look at the shadow. A crisp, hard-edged shadow is direct sun; a soft, fuzzy shadow is the bright indirect light most houseplants want.',
          'East windows give gentle morning sun that suits almost everything. South windows are the brightest and can scorch tender leaves — pull the plant back a few feet or filter it with a sheer curtain. North windows are low-light: reserve them for the tough survivors.',
          'When in doubt, watch the plant. Leggy, stretching growth means it wants more light; pale or scorched patches mean it wants less.'
        ),
        featuredImage: assetRef('guide-light-img'),
      },
    },
    {
      typeKey: 'blog_post',
      slug: 'when-and-how-to-repot',
      body: {
        title: 'When (and how) to repot',
        excerpt:
          'Roots circling the pot, water running straight through, growth stalling — the three signs it’s time, and the five-minute fix.',
        body: doc(
          'A plant tells you when it’s ready to move up: roots spiralling at the bottom of the pot, water that pours straight through without soaking in, or growth that has simply stopped. Spring is the ideal time, when the plant is waking up and can recover fast.',
          'Go up just one pot size — too big a jump leaves soil sitting wet around the roots. Loosen the root ball gently, set the plant at the same depth it was before, and backfill with fresh potting mix, firming lightly as you go.',
          'Water it in, then leave it somewhere stable for a week or two. A little droop right after repotting is normal; it’ll settle as the roots find the new soil.'
        ),
        featuredImage: assetRef('guide-repot-img'),
      },
    },
    {
      typeKey: 'page',
      slug: 'about',
      body: {
        title: 'About Fern & Stone',
        excerpt: 'A small studio growing healthy, beginner-friendly houseplants.',
        body: doc(
          'Fern & Stone is a small plant studio. We grow on every plant in our own space so it’s acclimated to indoor light before it ever ships — which is most of why our plants settle in so well.',
          'We choose varieties that forgive a missed watering and a less-than-perfect window, because a plant you can actually keep alive is the only plant worth buying. Every order ships double-boxed with a plain-language care card and our 30-day healthy-arrival promise.'
        ),
      },
    },
    {
      typeKey: 'page',
      slug: 'contact',
      body: {
        title: 'Contact us',
        excerpt: 'Plant questions, order help, or a sad leaf — we’d love to help.',
        body: doc(
          'Email hello@fernandstone.example and we’ll get back within a business day — send a photo if a plant’s looking off and we’ll talk you through it.',
          'If something arrived less than perfect, just reply to your order confirmation; our healthy-arrival promise has you covered for 30 days.'
        ),
      },
    },
  ],

  commerce: {
    categories: [
      { handle: 'easy-care', name: 'Easy Care', position: 0, featured: true },
      { handle: 'statement', name: 'Statement Plants', position: 1, featured: true },
      { handle: 'low-light', name: 'Low Light', position: 2 },
    ],
    collections: [
      {
        handle: 'featured',
        name: 'Featured',
        type: 'manual',
        featured: true,
        productHandles: ['monstera-deliciosa', 'snake-plant', 'golden-pothos', 'zz-plant'],
      },
    ],
    products: [
      {
        handle: 'monstera-deliciosa',
        title: 'Monstera Deliciosa',
        description:
          '<p>The classic split-leaf monstera — fast-growing, forgiving, and dramatic. Ships in its nursery pot with a care card.</p><p><strong>Light:</strong> bright indirect. <strong>Water:</strong> when the top 2in dries. <strong>Pet note:</strong> toxic if eaten.</p>',
        productType: 'Houseplant',
        vendor: 'Fern & Stone',
        tags: ['statement', 'easy', 'trailing'],
        categoryHandles: ['statement'],
        collectionHandles: ['featured'],
        options: [sizeOption],
        variants: sizeVariants('FS-MONSTERA', 4800),
        images: [{ assetId: 'monstera-img', isPrimary: true, position: 0 }],
      },
      {
        handle: 'snake-plant',
        title: 'Snake Plant',
        description:
          '<p>Nearly indestructible and happy in low light — the plant we recommend first to anyone new. Ships in its nursery pot with a care card.</p><p><strong>Light:</strong> low to bright. <strong>Water:</strong> sparingly, every 2–3 weeks. <strong>Pet note:</strong> mildly toxic if eaten.</p>',
        productType: 'Houseplant',
        vendor: 'Fern & Stone',
        tags: ['easy', 'low-light', 'beginner'],
        categoryHandles: ['easy-care', 'low-light'],
        collectionHandles: ['featured'],
        options: [sizeOption],
        variants: sizeVariants('FS-SNAKE', 3200),
        images: [{ assetId: 'snake-img', isPrimary: true, position: 0 }],
      },
      {
        handle: 'golden-pothos',
        title: 'Golden Pothos',
        description:
          '<p>A trailing vine that grows happily almost anywhere and tells you when it’s thirsty. Ships in its nursery pot with a care card.</p><p><strong>Light:</strong> low to bright indirect. <strong>Water:</strong> when leaves start to droop. <strong>Pet note:</strong> toxic if eaten.</p>',
        productType: 'Houseplant',
        vendor: 'Fern & Stone',
        tags: ['easy', 'trailing', 'beginner'],
        categoryHandles: ['easy-care'],
        collectionHandles: ['featured'],
        options: [sizeOption],
        variants: sizeVariants('FS-POTHOS', 2800),
        images: [{ assetId: 'pothos-img', isPrimary: true, position: 0 }],
      },
      {
        handle: 'zz-plant',
        title: 'ZZ Plant',
        description:
          '<p>Glossy, architectural, and absurdly tough — thrives on neglect and low light alike. Ships in its nursery pot with a care card.</p><p><strong>Light:</strong> low to medium. <strong>Water:</strong> every 2–3 weeks. <strong>Pet note:</strong> toxic if eaten.</p>',
        productType: 'Houseplant',
        vendor: 'Fern & Stone',
        tags: ['easy', 'low-light'],
        categoryHandles: ['easy-care', 'low-light'],
        collectionHandles: ['featured'],
        options: [sizeOption],
        variants: sizeVariants('FS-ZZ', 3600),
        images: [{ assetId: 'zz-img', isPrimary: true, position: 0 }],
      },
      {
        handle: 'fiddle-leaf-fig',
        title: 'Fiddle-Leaf Fig',
        description:
          '<p>A sculptural statement tree with big violin-shaped leaves — rewarding once it settles into a bright, stable spot. Ships in its nursery pot with a care card.</p><p><strong>Light:</strong> bright indirect, no drafts. <strong>Water:</strong> when the top 2in dries. <strong>Pet note:</strong> toxic if eaten.</p>',
        productType: 'Houseplant',
        vendor: 'Fern & Stone',
        tags: ['statement', 'tree'],
        categoryHandles: ['statement'],
        options: [sizeOption],
        variants: sizeVariants('FS-FIGLEAF', 6400),
        images: [{ assetId: 'figleaf-img', isPrimary: true, position: 0 }],
      },
    ],
  },

  components: [],

  layout: { name: 'Fern layout', tree: siteLayoutTree(), makeActive: true },

  pages: [
    { name: 'Home', kind: 'singleton', tree: homeTree(), seoTitle: 'Fern & Stone — Houseplants' },
    { name: 'Care guides', kind: 'singleton', slug: 'guides', tree: guideIndexTree() },
    {
      name: 'Care guide',
      kind: 'collection',
      recordType: 'cms.blog_post',
      isDefault: true,
      tree: blogPostTree(),
    },
    {
      name: 'Plant page',
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
      subject: 'Welcome to Fern & Stone 🌿',
      preheader: 'A little welcome from the studio.',
      tree: welcomeEmailTree(),
    },
    {
      name: 'Monthly drop',
      subject: 'Fresh off the bench',
      preheader: 'This month’s healthiest plants and a seasonal care tip.',
      tree: dropEmailTree(),
    },
  ],
};

/** The houseplant shop blueprint, parsed + integrity-checked at module load so an
 *  invalid edit fails fast (and `defaults` are applied). */
export const plantShop: Blueprint = parseBlueprint(manifest);
