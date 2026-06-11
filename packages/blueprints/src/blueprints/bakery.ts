// A neighborhood bakery blueprint ("Honey & Rye") — a warm, friendly storefront
// for a small-batch bakery. Sibling of retail-store-blog.ts: it exercises the
// same modules (brand + a NEW shipped theme over `market`, CMS content, a
// commerce catalog, builder pages + the site layout, marketing emails). Each
// baked good is a single-variant product sold by the loaf / box. Everything
// installs to DRAFT (docs/54 D4); the tenant reviews, customizes, and goes live.
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
const rid = (t: string): string => `bak-${t}-${(nid += 1)}`;

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
      // HERO — full-bleed bakery-counter photo, warm dark scrim + light text.
      node('Section', {
        box: {
          name: 'Hero',
          height: 'lg',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
          backgroundImage: pic('honey-hero-counter', 2000, 1100),
          overlay: 'dark',
          textTone: 'light',
        },
        layout: { direction: 'stack', gap: 'sm', justify: 'center', alignItems: 'center' },
        children: [
          node('Heading', {
            props: { level: 'h1', text: 'Baked this morning, just down the street.' },
          }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'A tiny neighborhood bakery making slow-proofed sourdough, buttery pastries, and the kind of cake you remember. Order online for pickup — while it’s still warm.',
            },
          }),
          node('Button', {
            props: {
              label: 'Order for pickup',
              style: 'primary',
              href: '/collections/featured',
            },
          }),
        ],
      }),

      // TODAY'S BAKE — Commerce as one section; iterates products.
      node('Section', {
        box: { name: 'Today’s bake', surface: 'subtle', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'Today’s bake.' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Everything is made in small batches and goes fast — reserve yours and we’ll set it aside, still warm.',
            },
          }),
          node('Grid', {
            box: { name: 'Goods grid', padding: 'none' },
            layout: { direction: 'grid', columns: 3, gap: 'lg' },
            bind: 'commerce.product',
            children: [
              node('Card', {
                box: { name: 'Good card', surface: 'none', padding: 'sm' },
                layout: { direction: 'stack', gap: 'sm' },
                children: [
                  node('ImageDisplay', { props: { ratio: 'square' }, bind: 'item.images' }),
                  node('Heading', { props: { level: 'h3' }, bind: 'item.title' }),
                  node('PriceTag', { bind: 'item.price' }),
                  node('Button', { props: { label: 'Reserve', style: 'soft' } }),
                ],
              }),
            ],
          }),
        ],
      }),

      // OUR KITCHEN — about band, photo beside copy (static photo via box.backgroundImage).
      node('Section', {
        box: { name: 'Our kitchen', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'row', gap: 'lg', alignItems: 'center' },
        children: [
          node('Card', {
            box: {
              name: 'Kitchen photo',
              height: 'lg',
              padding: 'none',
              backgroundImage: pic('honey-kitchen', 800, 960),
            },
            layout: { direction: 'stack', gap: 'none' },
          }),
          node('Stack', {
            box: { name: 'Kitchen copy', padding: 'none' },
            layout: { direction: 'stack', gap: 'sm' },
            children: [
              node('Heading', {
                props: { level: 'h2', text: 'Real butter, slow time, no shortcuts.' },
              }),
              node('Text', {
                props: {
                  variant: 'body',
                  text: 'We mill some of our own flour, ferment our sourdough overnight, and laminate every croissant by hand. It takes longer and we wouldn’t have it any other way — you can taste the difference the second morning proves it.',
                },
              }),
              node('Button', {
                box: { align: 'start' },
                props: { label: 'About the bakery', style: 'soft', href: '/about' },
              }),
            ],
          }),
        ],
      }),

      // FROM THE KITCHEN — CMS as a section; iterates posts.
      node('Section', {
        box: { name: 'From the kitchen', surface: 'muted', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'From the kitchen.' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Recipes, baking notes, and the occasional story from behind the counter.',
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

      // VISIT — address & hours as static Text.
      node('Section', {
        box: { name: 'Visit', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'row', gap: 'lg', alignItems: 'start' },
        children: [
          node('Stack', {
            box: { name: 'Visit copy', padding: 'none' },
            layout: { direction: 'stack', gap: 'sm' },
            children: [
              node('Heading', { props: { level: 'h2', text: 'Come say hello.' } }),
              node('Text', {
                props: {
                  variant: 'body',
                  text: 'The counter’s open early and the coffee’s always on. Order ahead for pickup, or just wander in and see what came out of the oven.',
                },
              }),
            ],
          }),
          node('Stack', {
            box: { name: 'Visit details', padding: 'none' },
            layout: { direction: 'stack', gap: 'sm' },
            children: [
              node('Divider'),
              node('Text', {
                props: { variant: 'body', text: 'The Bakery — 42 Maple Street, Corner of 3rd' },
              }),
              node('Text', {
                props: { variant: 'body', text: 'Hours — Tue–Sun, 7am–2pm (or until we sell out)' },
              }),
              node('Text', {
                props: { variant: 'body', text: 'Say hi — (555) 555-0182 · hello@honeyandrye.example' },
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
          node('Heading', { props: { level: 'h2', text: 'Know what’s baking before it sells out.' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'A short note when the weekend specials drop and the holiday pre-orders open. Pastry-forward, never spammy.',
            },
          }),
          node('Signup', { props: { cta: 'Subscribe' }, bind: 'crm.list' }),
        ],
      }),
    ],
  });
}

function journalIndexTree(): BuilderNode {
  return node('Section', {
    box: {
      name: 'From the kitchen',
      padding: 'lg',
      backgroundWidth: 'full',
      contentWidth: 'contained',
    },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'From the kitchen' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'Recipes, baking notes, and the occasional story from behind the counter.',
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
    box: { name: 'Kitchen note', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
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
              node('Button', { props: { label: 'Reserve for pickup', style: 'primary' } }),
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
              node('Heading', { props: { level: 'h3', text: 'Honey & Rye' } }),
            ],
          }),
          node('NavMenu', {
            props: {
              orientation: 'row',
              links: [
                { label: 'Order', href: '/products' },
                { label: 'From the kitchen', href: '/journal' },
                { label: 'About', href: '/about' },
                { label: 'Visit', href: '/contact' },
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
                { label: 'Order', href: '/products' },
                { label: 'About', href: '/about' },
                { label: 'Visit', href: '/contact' },
              ],
            },
          }),
          node('SocialLinks', { bind: 'site.social' }),
          node('Text', { props: { variant: 'meta', text: '© Honey & Rye' } }),
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
      node('Heading', { props: { level: 'h1', text: 'Welcome to Honey & Rye 🥐' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'Thanks for joining — pull up a chair. We’ll let you know when the weekend specials drop and when holiday pre-orders open, so you never miss your favorite.',
        },
      }),
      node('Button', { props: { label: 'Order for pickup', href: '' }, box: { align: 'start' } }),
      node('Divider'),
      node('Text', {
        props: { variant: 'meta', text: 'Got a question or a special request? Just reply.' },
      }),
    ],
  });
}

function specialsEmailTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'This weekend’s specials' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'Fresh on the board this weekend, plus a baking note from the kitchen. Reserve ahead — the good stuff goes early.',
        },
      }),
      node('Button', { props: { label: 'See the specials', href: '' }, box: { align: 'start' } }),
      node('Divider'),
      node('Text', {
        props: {
          variant: 'meta',
          text: 'You’re receiving this because you subscribed at Honey & Rye.',
        },
      }),
    ],
  });
}

// ── The manifest ───────────────────────────────────────────────────────────────

const manifest = {
  key: 'bakery',
  version: '1.0.0',
  name: 'Bakery',
  summary:
    'A warm, friendly storefront for a neighborhood bakery — small-batch sourdough, pastries, and cakes for online pickup, with a from-the-kitchen blog — themed and ready to review.',
  vertical: 'retail',
  requiresModules: ['builder', 'commerce', 'cms', 'email'],

  brand: {
    businessName: 'Honey & Rye',
    tagline: 'Baked this morning, just down the street.',
    colors: {
      primary: '#db2777',
      primaryForeground: '#FFFFFF',
      accent: '#f59e0b',
      secondary: '#5b2333',
    },
    fonts: { heading: 'Quicksand', body: 'Nunito' },
    logoLightAssetId: 'logo',
  },

  // The NEW theme this blueprint ships (docs/54 D5): a named SiteTheme over the
  // `market` preset — a cheerful berry pink with a warm honey accent.
  theme: {
    name: 'Honey',
    basePresetKey: 'market',
    presentation: { v: 2, containerWidth: '1140px' },
    brand: {
      colorPrimary: '#db2777',
      colorPrimaryForeground: '#FFFFFF',
      colorAccent: '#f59e0b',
      fontHeading: 'Quicksand',
      fontBody: 'Nunito',
      tokens: { radiusBase: '8px' },
    },
    apply: true,
  },

  assets: [
    {
      id: 'logo',
      url: 'https://ui-avatars.com/api/?name=Honey+Rye&background=db2777&color=FFFFFF&bold=true&size=128&format=svg',
      alt: 'Honey & Rye',
    },
    // From-the-kitchen featured images.
    {
      id: 'note-sourdough-img',
      url: pic('honey-note-sourdough', 1200, 750),
      alt: 'A scored sourdough loaf before baking',
    },
    {
      id: 'note-croissant-img',
      url: pic('honey-note-croissant', 1200, 750),
      alt: 'Laminating croissant dough by hand',
    },
    // Product images (one each).
    {
      id: 'sourdough-img',
      url: pic('honey-sourdough', 1000, 1000),
      alt: 'Country sourdough loaf',
    },
    {
      id: 'croissant-img',
      url: pic('honey-croissant', 1000, 1000),
      alt: 'Box of butter croissants',
    },
    {
      id: 'cinnamon-img',
      url: pic('honey-cinnamon', 1000, 1000),
      alt: 'Cinnamon rolls with icing',
    },
    {
      id: 'banana-img',
      url: pic('honey-banana', 1000, 1000),
      alt: 'Banana bread loaf',
    },
    {
      id: 'cookies-img',
      url: pic('honey-cookies', 1000, 1000),
      alt: 'Box of chocolate chip cookies',
    },
  ],

  // Lean on built-in content types (page, blog_post) — no custom types.
  contentTypes: [],

  content: [
    {
      typeKey: 'blog_post',
      slug: 'why-our-sourdough-takes-two-days',
      body: {
        title: 'Why our sourdough takes two days',
        excerpt:
          'A long, cool ferment is the whole secret — better flavor, better keeping, and a crumb that’s actually good for you.',
        body: doc(
          'Most supermarket bread is mixed, proofed, and baked in a couple of hours with the help of commercial yeast and a pile of additives. Ours takes the better part of two days, and that slowness is the entire point.',
          'We build our dough on a wild sourdough starter we’ve kept alive for years, then let it ferment overnight in a cool room. That long, slow rise develops the deep, faintly tangy flavor you can’t fake — and it begins breaking down the flour, which is part of why a real sourdough sits easier and keeps longer.',
          'The next morning we shape, score, and bake on stone with a burst of steam for that crackling crust. Two days of patience, one very good loaf.'
        ),
        featuredImage: assetRef('note-sourdough-img'),
      },
    },
    {
      typeKey: 'blog_post',
      slug: 'the-case-for-real-butter',
      body: {
        title: 'The case for real butter (and a lot of it)',
        excerpt:
          'There are 27 layers of it folded into every croissant — here’s why we’d never cut the corner.',
        body: doc(
          'A croissant is, honestly, mostly butter — and the kind of butter matters as much as the technique. We use a high-fat European-style butter because it stays pliable when we fold it into the dough, which is what makes those distinct, shattering layers possible.',
          'Lamination is the patient part: roll, fold, chill, repeat, until thin sheets of butter and dough alternate dozens of times over. In the oven that butter turns to steam and pushes the layers apart — that’s the airy honeycomb you see when you tear one open.',
          'Cheaper fats and shortcuts give you a dense, greasy pastry that misses the whole point. We’d rather use more good butter and fewer shortcuts. Every single time.'
        ),
        featuredImage: assetRef('note-croissant-img'),
      },
    },
    {
      typeKey: 'page',
      slug: 'about',
      body: {
        title: 'About the bakery',
        excerpt: 'A tiny neighborhood bakery that does things the slow way.',
        body: doc(
          'Honey & Rye is a small bakery on the corner of Maple and 3rd. We mill some of our own flour, keep a years-old sourdough starter alive, and laminate every croissant by hand — because the slow way simply tastes better.',
          'Everything is made fresh each morning in small batches, which means it sometimes sells out — so we let you order ahead for pickup and set yours aside, still warm. Come early, the coffee’s on.'
        ),
      },
    },
    {
      typeKey: 'page',
      slug: 'contact',
      body: {
        title: 'Visit & contact',
        excerpt: 'Find us, call us, or order ahead for pickup.',
        body: doc(
          'You’ll find us at 42 Maple Street, on the corner of 3rd. We’re open Tuesday through Sunday, 7am to 2pm — or until we sell out, whichever comes first.',
          'For special orders, custom cakes, or just to say hello, call (555) 555-0182 or email hello@honeyandrye.example and we’ll get right back to you.'
        ),
      },
    },
  ],

  commerce: {
    categories: [
      { handle: 'bread', name: 'Bread', position: 0, featured: true },
      { handle: 'pastries', name: 'Pastries', position: 1, featured: true },
      { handle: 'cakes-loaves', name: 'Cakes & Loaves', position: 2 },
    ],
    collections: [
      {
        handle: 'featured',
        name: 'Featured',
        type: 'manual',
        featured: true,
        productHandles: ['country-sourdough', 'butter-croissants', 'cinnamon-rolls', 'banana-bread'],
      },
    ],
    products: [
      {
        handle: 'country-sourdough',
        title: 'Country Sourdough Loaf',
        description:
          '<p>Our flagship loaf — naturally leavened, fermented overnight, and baked on stone for a deep, crackling crust and an open, tangy crumb.</p><p><strong>Size:</strong> ~900g round. <strong>Contains:</strong> wheat. Made fresh daily; reserve for pickup.</p>',
        productType: 'Bread',
        vendor: 'Honey & Rye',
        tags: ['sourdough', 'bread', 'naturally-leavened'],
        categoryHandles: ['bread'],
        collectionHandles: ['featured'],
        variants: [{ sku: 'HR-SOUR-LOAF', priceCents: 900, isDefault: true, position: 0 }],
        images: [{ assetId: 'sourdough-img', isPrimary: true, position: 0 }],
      },
      {
        handle: 'butter-croissants',
        title: 'Butter Croissants (4-pack)',
        description:
          '<p>Hand-laminated with high-fat European butter and proofed slow for a shatter-crisp exterior and a feathery, honeycomb interior.</p><p><strong>Box of:</strong> 4. <strong>Contains:</strong> wheat, dairy. Made fresh daily; reserve for pickup.</p>',
        productType: 'Pastry',
        vendor: 'Honey & Rye',
        tags: ['croissant', 'pastry', 'laminated'],
        categoryHandles: ['pastries'],
        collectionHandles: ['featured'],
        variants: [{ sku: 'HR-CROIS-4PK', priceCents: 1400, isDefault: true, position: 0 }],
        images: [{ assetId: 'croissant-img', isPrimary: true, position: 0 }],
      },
      {
        handle: 'cinnamon-rolls',
        title: 'Cinnamon Rolls (half-dozen)',
        description:
          '<p>Soft, enriched dough rolled with brown-sugar cinnamon and finished with a cream-cheese glaze. Best the morning they’re baked.</p><p><strong>Box of:</strong> 6. <strong>Contains:</strong> wheat, dairy, egg. Made fresh daily; reserve for pickup.</p>',
        productType: 'Pastry',
        vendor: 'Honey & Rye',
        tags: ['cinnamon-roll', 'pastry', 'sweet'],
        categoryHandles: ['pastries'],
        collectionHandles: ['featured'],
        variants: [{ sku: 'HR-CINN-6PK', priceCents: 1800, isDefault: true, position: 0 }],
        images: [{ assetId: 'cinnamon-img', isPrimary: true, position: 0 }],
      },
      {
        handle: 'banana-bread',
        title: 'Brown-Butter Banana Bread',
        description:
          '<p>A moist, walnut-studded banana loaf made with browned butter and very ripe bananas. Keeps beautifully for a few days.</p><p><strong>Size:</strong> standard loaf. <strong>Contains:</strong> wheat, dairy, egg, walnuts. Made fresh daily; reserve for pickup.</p>',
        productType: 'Loaf',
        vendor: 'Honey & Rye',
        tags: ['banana-bread', 'loaf', 'sweet'],
        categoryHandles: ['cakes-loaves'],
        collectionHandles: ['featured'],
        variants: [{ sku: 'HR-BANANA-LOAF', priceCents: 1200, isDefault: true, position: 0 }],
        images: [{ assetId: 'banana-img', isPrimary: true, position: 0 }],
      },
      {
        handle: 'chocolate-chip-cookies',
        title: 'Chocolate Chip Cookies (half-dozen)',
        description:
          '<p>Brown-butter, sea-salt chocolate chip cookies — crisp at the edge, chewy in the middle, baked to order.</p><p><strong>Box of:</strong> 6. <strong>Contains:</strong> wheat, dairy, egg, soy. Made fresh daily; reserve for pickup.</p>',
        productType: 'Cookie',
        vendor: 'Honey & Rye',
        tags: ['cookie', 'sweet'],
        categoryHandles: ['cakes-loaves'],
        variants: [{ sku: 'HR-COOKIE-6PK', priceCents: 1500, isDefault: true, position: 0 }],
        images: [{ assetId: 'cookies-img', isPrimary: true, position: 0 }],
      },
    ],
  },

  components: [],

  layout: { name: 'Honey layout', tree: siteLayoutTree(), makeActive: true },

  pages: [
    { name: 'Home', kind: 'singleton', tree: homeTree(), seoTitle: 'Honey & Rye — Neighborhood Bakery' },
    { name: 'From the kitchen', kind: 'singleton', slug: 'journal', tree: journalIndexTree() },
    {
      name: 'Kitchen note',
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
      subject: 'Welcome to Honey & Rye 🥐',
      preheader: 'Pull up a chair — here’s what’s baking.',
      tree: welcomeEmailTree(),
    },
    {
      name: 'Weekend specials',
      subject: 'This weekend’s specials',
      preheader: 'Fresh on the board, plus a note from the kitchen.',
      tree: specialsEmailTree(),
    },
  ],
};

/** The neighborhood bakery blueprint, parsed + integrity-checked at module load
 *  so an invalid edit fails fast (and `defaults` are applied). */
export const bakery: Blueprint = parseBlueprint(manifest);
