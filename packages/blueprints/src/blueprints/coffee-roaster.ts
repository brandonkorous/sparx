// A coffee roaster blueprint (docs/54 §12, sibling of retail-store-blog.ts):
// a direct-to-consumer specialty roaster — "Cedar & Smoke Coffee" — with a small
// catalog of single-origin and blend bags (each sold by Roast × Grind), brewing
// guides in the journal, marketing emails, and a warm Cedar & Smoke theme. It
// exercises builder + commerce + cms + email. Everything installs to DRAFT
// (docs/54 D4); the tenant reviews, customizes, and goes live.
//
// Authoring notes:
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
const rid = (t: string): string => `cof-${t}-${(nid += 1)}`;

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
      // HERO — full-bleed roastery photo with a dark scrim + light text.
      node('Section', {
        box: {
          name: 'Hero',
          height: 'lg',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
          backgroundImage: pic('cedarsmoke-hero-roastery', 2000, 1100),
          overlay: 'dark',
          textTone: 'light',
        },
        layout: { direction: 'stack', gap: 'sm', justify: 'center', alignItems: 'center' },
        children: [
          node('Heading', { props: { level: 'h1', text: 'Roasted in small batches, shipped within days.' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Single-origin coffees and house blends, roasted to order over cedar-smoke mornings and sent to your door at peak freshness.',
            },
          }),
          node('Button', {
            props: { label: 'Shop the coffee', style: 'primary', href: '/products' },
          }),
        ],
      }),

      // SHOP — Commerce as one section; iterates products.
      node('Section', {
        box: { name: 'Shop', surface: 'subtle', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'This month at the roastery' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'A rotating shelf of single origins and two blends we keep on always. Choose your roast and grind at checkout.',
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

      // HOW WE ROAST — three static steps.
      node('Section', {
        box: { name: 'How we roast', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'From green bean to your cup' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'We buy small, roast small, and ship fast — so the bag on your counter tastes the way it did the morning it left the drum.',
            },
          }),
          node('Grid', {
            box: { name: 'Steps', padding: 'none' },
            layout: { direction: 'grid', columns: 3, gap: 'lg' },
            children: [
              node('Card', {
                box: { name: 'Step 01', surface: 'none', padding: 'md' },
                layout: { direction: 'stack', gap: 'sm' },
                children: [
                  node('Heading', { props: { level: 'h3', text: 'Source' } }),
                  node('Text', {
                    props: {
                      variant: 'body',
                      text: 'We buy a few sacks at a time from importers we know, favouring farms that get paid well and pick ripe.',
                    },
                  }),
                ],
              }),
              node('Card', {
                box: { name: 'Step 02', surface: 'none', padding: 'md' },
                layout: { direction: 'stack', gap: 'sm' },
                children: [
                  node('Heading', { props: { level: 'h3', text: 'Roast' } }),
                  node('Text', {
                    props: {
                      variant: 'body',
                      text: 'Every coffee gets its own curve, dialled on a small drum until the cup sings — never to a one-size profile.',
                    },
                  }),
                ],
              }),
              node('Card', {
                box: { name: 'Step 03', surface: 'none', padding: 'md' },
                layout: { direction: 'stack', gap: 'sm' },
                children: [
                  node('Heading', { props: { level: 'h3', text: 'Ship' } }),
                  node('Text', {
                    props: {
                      variant: 'body',
                      text: 'Bags are packed within 48 hours of roasting and on their way the same week, with a roast date you can trust.',
                    },
                  }),
                ],
              }),
            ],
          }),
        ],
      }),

      // BREWING GUIDES — CMS as another section; iterates posts.
      node('Section', {
        box: { name: 'Brewing', surface: 'subtle', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'Brew it better' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Simple guides for the gear you already own — pour-over, press, and the morning espresso.',
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
          node('Heading', { props: { level: 'h2', text: 'Fresh roasts, in your inbox' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'New single origins, restocks, and the occasional brewing tip — about twice a month.',
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
    box: { name: 'Brewing guides', padding: 'lg', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'Brewing guides' } }),
      node('Text', {
        props: { variant: 'body', text: 'Recipes and ratios for a better cup at home.' },
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
              node('Heading', { props: { level: 'h3', text: 'Cedar & Smoke Coffee' } }),
            ],
          }),
          node('NavMenu', {
            props: {
              orientation: 'row',
              links: [
                { label: 'Shop', href: '/products' },
                { label: 'Brewing', href: '/brewing' },
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
                { label: 'Shop', href: '/products' },
                { label: 'About', href: '/about' },
                { label: 'Contact', href: '/contact' },
              ],
            },
          }),
          node('SocialLinks', { bind: 'site.social' }),
          node('Text', { props: { variant: 'meta', text: '© Cedar & Smoke Coffee' } }),
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
      node('Heading', { props: { level: 'h1', text: 'Welcome to Cedar & Smoke' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: "Thanks for joining the list. Here's a little about how we roast — and a first cup recommendation to get you started.",
        },
      }),
      node('Button', { props: { label: 'Shop fresh roasts', href: '' }, box: { align: 'start' } }),
      node('Divider'),
      node('Text', { props: { variant: 'meta', text: 'Questions about a coffee? Just reply to this email.' } }),
    ],
  });
}

function restockEmailTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'Fresh off the drum this week' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'A new single origin just landed and two shelf favourites are back in stock. Roasted to order, shipped within days.',
        },
      }),
      node('Button', { props: { label: 'See this week’s roasts', href: '' }, box: { align: 'start' } }),
      node('Divider'),
      node('Text', {
        props: {
          variant: 'meta',
          text: 'You’re receiving this because you subscribed at Cedar & Smoke Coffee.',
        },
      }),
    ],
  });
}

// ── The manifest ───────────────────────────────────────────────────────────────

const manifest = {
  key: 'coffee-roaster',
  version: '1.0.0',
  name: 'Coffee Roaster',
  summary:
    'A direct-to-consumer specialty coffee roaster with a small catalog sold by roast and grind, brewing guides in the journal, marketing emails, and the warm Cedar & Smoke theme — everything themed and ready to review.',
  vertical: 'retail',
  requiresModules: ['builder', 'commerce', 'cms', 'email'],

  brand: {
    businessName: 'Cedar & Smoke Coffee',
    tagline: 'Small-batch coffee, roasted to order.',
    colors: {
      primary: '#9a3412',
      primaryForeground: '#FFFFFF',
      accent: '#4d7c0f',
      secondary: '#1C1410',
    },
    fonts: { heading: 'Fraunces', body: 'Inter' },
    logoLightAssetId: 'logo',
  },

  // The NEW theme this blueprint ships (docs/54 D5): a named SiteTheme over the
  // `market` preset, warm and earthy to match the roaster identity above.
  theme: {
    name: 'Cedar & Smoke',
    basePresetKey: 'market',
    presentation: { v: 2, containerWidth: '1140px' },
    brand: {
      colorPrimary: '#9a3412',
      colorPrimaryForeground: '#FFFFFF',
      colorAccent: '#4d7c0f',
      fontHeading: 'Fraunces',
      fontBody: 'Inter',
      tokens: { radiusBase: '8px' },
    },
    apply: true,
  },

  assets: [
    {
      id: 'logo',
      url: 'https://ui-avatars.com/api/?name=Cedar+Smoke&background=9a3412&color=FFFFFF&bold=true&size=128&format=svg',
      alt: 'Cedar & Smoke Coffee',
    },
    // Journal featured images.
    { id: 'guide-pourover-img', url: pic('cedarsmoke-guide-pourover', 800, 600), alt: 'Pour-over brewing setup' },
    { id: 'guide-press-img', url: pic('cedarsmoke-guide-press', 800, 600), alt: 'French press and mug' },
    { id: 'guide-espresso-img', url: pic('cedarsmoke-guide-espresso', 800, 600), alt: 'Espresso pulling into a cup' },
    // Product imagery.
    { id: 'prod-ethiopia', url: pic('cedarsmoke-prod-ethiopia', 1000, 1000), alt: 'Ethiopia single-origin bag' },
    { id: 'prod-colombia', url: pic('cedarsmoke-prod-colombia', 1000, 1000), alt: 'Colombia single-origin bag' },
    { id: 'prod-housedark', url: pic('cedarsmoke-prod-housedark', 1000, 1000), alt: 'House Dark blend bag' },
    { id: 'prod-breakfast', url: pic('cedarsmoke-prod-breakfast', 1000, 1000), alt: 'Breakfast Blend bag' },
    // Category heroes.
    { id: 'cat-single-hero', url: pic('cedarsmoke-cat-single'), alt: 'Single origins' },
    { id: 'cat-blends-hero', url: pic('cedarsmoke-cat-blends'), alt: 'Blends' },
  ],

  // Lean on built-in content types (page, blog_post) — no custom types in v1.
  contentTypes: [],

  content: [
    {
      typeKey: 'blog_post',
      slug: 'pour-over-the-easy-way',
      body: {
        title: 'Pour-over, the easy way',
        excerpt: 'A forgiving recipe for a clean, sweet cup with whatever cone you own.',
        body: doc(
          'Pour-over rewards consistency more than gear. Weigh 22 grams of coffee to 360 grams of water — roughly a 1:16 ratio — and you are most of the way there.',
          'Start with a 45-second bloom: pour just enough water to wet the grounds, watch them puff, then add the rest in slow, steady circles. Aim for a total brew time of three to four minutes.',
          'If it tastes thin or sour, grind finer; if it tastes harsh or dry, grind coarser. Change one thing at a time and you will dial it in within a few mornings.'
        ),
        featuredImage: assetRef('guide-pourover-img'),
      },
    },
    {
      typeKey: 'blog_post',
      slug: 'french-press-without-the-mud',
      body: {
        title: 'French press without the mud',
        excerpt: 'Bigger, bolder cups — and a simple trick to keep the silt out.',
        body: doc(
          'The press makes a heavier, rounder cup than paper filters, which is exactly the point. Use a coarse grind so the grounds do not slip through the mesh.',
          'Steep for four minutes, then skim the crust off the top with two spoons before you plunge. Press slowly and gently — racing it is what stirs up the mud.',
          'Decant straight away into a warmed carafe or your mugs; coffee left sitting on the grounds keeps extracting and turns bitter fast.'
        ),
        featuredImage: assetRef('guide-press-img'),
      },
    },
    {
      typeKey: 'blog_post',
      slug: 'dial-in-your-home-espresso',
      body: {
        title: 'Dial in your home espresso',
        excerpt: 'The three numbers that matter, and how to chase a balanced shot.',
        body: doc(
          'Espresso comes down to three numbers: dose in, yield out, and time. A good starting point is 18 grams in, 36 grams out, in about 28 seconds.',
          'Pull a shot and taste. If it runs fast and tastes sour, grind finer; if it pours like syrup and tastes harsh, grind coarser. Adjust grind first and everything else second.',
          'Keep your dose and basket the same while you chase the grind, and write down what you change. A repeatable shot beats a lucky one every morning.'
        ),
        featuredImage: assetRef('guide-espresso-img'),
      },
    },
    {
      typeKey: 'page',
      slug: 'about',
      body: {
        title: 'About Cedar & Smoke',
        excerpt: 'A small-batch roaster obsessed with freshness.',
        body: doc(
          'Cedar & Smoke started on a single drum roaster in a borrowed garage, with one rule that still holds: never sell a bag we would not brew ourselves that week.',
          'We source a handful of coffees at a time, roast them to their own profile, and ship within days so the bag on your counter is genuinely fresh — not just freshly printed.'
        ),
      },
    },
    {
      typeKey: 'page',
      slug: 'contact',
      body: {
        title: 'Contact us',
        excerpt: 'Wholesale, subscriptions, or a question about a coffee — say hello.',
        body: doc(
          'Email hello@cedarsmoke.example and a real person will get back within a business day.',
          'For café wholesale or recurring subscriptions, include a few details about your setup and we will route you to the right person.'
        ),
      },
    },
  ],

  commerce: {
    categories: [
      {
        handle: 'single-origin',
        name: 'Single Origin',
        position: 0,
        featured: true,
        heroAssetId: 'cat-single-hero',
      },
      {
        handle: 'blends',
        name: 'Blends',
        position: 1,
        featured: true,
        heroAssetId: 'cat-blends-hero',
      },
    ],
    collections: [
      {
        handle: 'this-month',
        name: 'This Month',
        type: 'manual',
        featured: true,
        productHandles: [
          'ethiopia-yirgacheffe',
          'colombia-huila',
          'house-dark',
          'breakfast-blend',
        ],
      },
    ],
    products: [
      {
        handle: 'ethiopia-yirgacheffe',
        title: 'Ethiopia Yirgacheffe',
        description:
          '<p>A bright, floral single origin with notes of jasmine, bergamot and ripe stone fruit.</p>',
        productType: 'Coffee',
        vendor: 'Cedar & Smoke',
        tags: ['single-origin', 'light', 'floral'],
        categoryHandles: ['single-origin'],
        collectionHandles: ['this-month'],
        options: [
          {
            name: 'Roast',
            displayType: 'segmented',
            position: 0,
            values: [
              { value: 'Light', position: 0 },
              { value: 'Medium', position: 1 },
              { value: 'Dark', position: 2 },
            ],
          },
          {
            name: 'Grind',
            displayType: 'dropdown',
            position: 1,
            values: [
              { value: 'Whole bean', position: 0 },
              { value: 'Ground', position: 1 },
            ],
          },
        ],
        variants: [
          {
            sku: 'ETH-LGT-WB',
            optionValues: { Roast: 'Light', Grind: 'Whole bean' },
            priceCents: 2100,
            isDefault: true,
            position: 0,
          },
          {
            sku: 'ETH-LGT-GR',
            optionValues: { Roast: 'Light', Grind: 'Ground' },
            priceCents: 2100,
            position: 1,
          },
          {
            sku: 'ETH-MED-WB',
            optionValues: { Roast: 'Medium', Grind: 'Whole bean' },
            priceCents: 2100,
            position: 2,
          },
          {
            sku: 'ETH-MED-GR',
            optionValues: { Roast: 'Medium', Grind: 'Ground' },
            priceCents: 2100,
            position: 3,
          },
          {
            sku: 'ETH-DRK-WB',
            optionValues: { Roast: 'Dark', Grind: 'Whole bean' },
            priceCents: 2100,
            position: 4,
          },
          {
            sku: 'ETH-DRK-GR',
            optionValues: { Roast: 'Dark', Grind: 'Ground' },
            priceCents: 2100,
            position: 5,
          },
        ],
        images: [{ assetId: 'prod-ethiopia', isPrimary: true, position: 0 }],
      },
      {
        handle: 'colombia-huila',
        title: 'Colombia Huila',
        description:
          '<p>A balanced, sweet single origin with caramel, red apple and a clean cocoa finish.</p>',
        productType: 'Coffee',
        vendor: 'Cedar & Smoke',
        tags: ['single-origin', 'medium', 'balanced'],
        categoryHandles: ['single-origin'],
        collectionHandles: ['this-month'],
        options: [
          {
            name: 'Roast',
            displayType: 'segmented',
            position: 0,
            values: [
              { value: 'Light', position: 0 },
              { value: 'Medium', position: 1 },
              { value: 'Dark', position: 2 },
            ],
          },
          {
            name: 'Grind',
            displayType: 'dropdown',
            position: 1,
            values: [
              { value: 'Whole bean', position: 0 },
              { value: 'Ground', position: 1 },
            ],
          },
        ],
        variants: [
          {
            sku: 'COL-LGT-WB',
            optionValues: { Roast: 'Light', Grind: 'Whole bean' },
            priceCents: 1950,
            isDefault: true,
            position: 0,
          },
          {
            sku: 'COL-LGT-GR',
            optionValues: { Roast: 'Light', Grind: 'Ground' },
            priceCents: 1950,
            position: 1,
          },
          {
            sku: 'COL-MED-WB',
            optionValues: { Roast: 'Medium', Grind: 'Whole bean' },
            priceCents: 1950,
            position: 2,
          },
          {
            sku: 'COL-MED-GR',
            optionValues: { Roast: 'Medium', Grind: 'Ground' },
            priceCents: 1950,
            position: 3,
          },
          {
            sku: 'COL-DRK-WB',
            optionValues: { Roast: 'Dark', Grind: 'Whole bean' },
            priceCents: 1950,
            position: 4,
          },
          {
            sku: 'COL-DRK-GR',
            optionValues: { Roast: 'Dark', Grind: 'Ground' },
            priceCents: 1950,
            position: 5,
          },
        ],
        images: [{ assetId: 'prod-colombia', isPrimary: true, position: 0 }],
      },
      {
        handle: 'house-dark',
        title: 'House Dark Blend',
        description:
          '<p>Our deep, smoky house blend — dark chocolate, toasted walnut and a long bittersweet finish.</p>',
        productType: 'Coffee',
        vendor: 'Cedar & Smoke',
        tags: ['blend', 'dark', 'bold'],
        categoryHandles: ['blends'],
        collectionHandles: ['this-month'],
        options: [
          {
            name: 'Roast',
            displayType: 'segmented',
            position: 0,
            values: [
              { value: 'Light', position: 0 },
              { value: 'Medium', position: 1 },
              { value: 'Dark', position: 2 },
            ],
          },
          {
            name: 'Grind',
            displayType: 'dropdown',
            position: 1,
            values: [
              { value: 'Whole bean', position: 0 },
              { value: 'Ground', position: 1 },
            ],
          },
        ],
        variants: [
          {
            sku: 'HDK-LGT-WB',
            optionValues: { Roast: 'Light', Grind: 'Whole bean' },
            priceCents: 1800,
            position: 0,
          },
          {
            sku: 'HDK-LGT-GR',
            optionValues: { Roast: 'Light', Grind: 'Ground' },
            priceCents: 1800,
            position: 1,
          },
          {
            sku: 'HDK-MED-WB',
            optionValues: { Roast: 'Medium', Grind: 'Whole bean' },
            priceCents: 1800,
            position: 2,
          },
          {
            sku: 'HDK-MED-GR',
            optionValues: { Roast: 'Medium', Grind: 'Ground' },
            priceCents: 1800,
            position: 3,
          },
          {
            sku: 'HDK-DRK-WB',
            optionValues: { Roast: 'Dark', Grind: 'Whole bean' },
            priceCents: 1800,
            isDefault: true,
            position: 4,
          },
          {
            sku: 'HDK-DRK-GR',
            optionValues: { Roast: 'Dark', Grind: 'Ground' },
            priceCents: 1800,
            position: 5,
          },
        ],
        images: [{ assetId: 'prod-housedark', isPrimary: true, position: 0 }],
      },
      {
        handle: 'breakfast-blend',
        title: 'Breakfast Blend',
        description:
          '<p>An easy, everyday blend — smooth, nutty and sweet, built to please the whole table.</p>',
        productType: 'Coffee',
        vendor: 'Cedar & Smoke',
        tags: ['blend', 'medium', 'everyday'],
        categoryHandles: ['blends'],
        collectionHandles: ['this-month'],
        options: [
          {
            name: 'Roast',
            displayType: 'segmented',
            position: 0,
            values: [
              { value: 'Light', position: 0 },
              { value: 'Medium', position: 1 },
              { value: 'Dark', position: 2 },
            ],
          },
          {
            name: 'Grind',
            displayType: 'dropdown',
            position: 1,
            values: [
              { value: 'Whole bean', position: 0 },
              { value: 'Ground', position: 1 },
            ],
          },
        ],
        variants: [
          {
            sku: 'BRK-LGT-WB',
            optionValues: { Roast: 'Light', Grind: 'Whole bean' },
            priceCents: 1700,
            position: 0,
          },
          {
            sku: 'BRK-LGT-GR',
            optionValues: { Roast: 'Light', Grind: 'Ground' },
            priceCents: 1700,
            position: 1,
          },
          {
            sku: 'BRK-MED-WB',
            optionValues: { Roast: 'Medium', Grind: 'Whole bean' },
            priceCents: 1700,
            isDefault: true,
            position: 2,
          },
          {
            sku: 'BRK-MED-GR',
            optionValues: { Roast: 'Medium', Grind: 'Ground' },
            priceCents: 1700,
            position: 3,
          },
          {
            sku: 'BRK-DRK-WB',
            optionValues: { Roast: 'Dark', Grind: 'Whole bean' },
            priceCents: 1700,
            position: 4,
          },
          {
            sku: 'BRK-DRK-GR',
            optionValues: { Roast: 'Dark', Grind: 'Ground' },
            priceCents: 1700,
            position: 5,
          },
        ],
        images: [{ assetId: 'prod-breakfast', isPrimary: true, position: 0 }],
      },
    ],
  },

  components: [],

  layout: { name: 'Cedar & Smoke layout', tree: siteLayoutTree(), makeActive: true },

  pages: [
    { name: 'Home', kind: 'singleton', tree: homeTree(), seoTitle: 'Cedar & Smoke Coffee' },
    { name: 'Brewing guides', kind: 'singleton', slug: 'brewing', tree: blogIndexTree() },
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
      subject: 'Welcome to Cedar & Smoke',
      preheader: 'You’re on the list — here’s how we roast.',
      tree: welcomeEmailTree(),
    },
    {
      name: 'Fresh roasts',
      subject: 'Fresh off the drum this week',
      preheader: 'A new single origin and two restocks, roasted to order.',
      tree: restockEmailTree(),
    },
  ],
};

export const coffeeRoaster: Blueprint = parseBlueprint(manifest);
