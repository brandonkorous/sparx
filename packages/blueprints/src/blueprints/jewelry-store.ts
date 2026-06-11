// A fine-jewelry atelier blueprint ("Noir Atelier") — a hushed, editorial
// storefront for one-of-a-kind pieces. Sibling of retail-store-blog.ts: it
// exercises the same modules (brand + a NEW shipped theme over `drift`, CMS
// content, a commerce catalog, builder pages + the site layout, marketing
// emails) but for a maker who sells single, made-once pieces — each a
// single-variant product with its own SKU, photographed once, sold once.
// Everything installs to DRAFT (docs/54 D4); the tenant reviews, customizes,
// and goes live.
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
const rid = (t: string): string => `jwl-${t}-${(nid += 1)}`;

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
      // HERO — full-bleed studio photo, dark scrim + light text.
      node('Section', {
        box: {
          name: 'Hero',
          height: 'lg',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
          backgroundImage: pic('noir-hero-atelier', 2000, 1100),
          overlay: 'dark',
          textTone: 'light',
        },
        layout: { direction: 'stack', gap: 'sm', justify: 'center', alignItems: 'center' },
        children: [
          node('Heading', {
            props: { level: 'h1', text: 'Made once, worn forever.' },
          }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'A small studio of one-of-a-kind fine jewelry — each piece hand-set in recycled gold, photographed once, and sold once. No editions, no two alike.',
            },
          }),
          node('Button', {
            props: {
              label: 'View the collection',
              style: 'primary',
              href: '/collections/featured',
            },
          }),
        ],
      }),

      // FEATURED PIECES — Commerce as one section; iterates products.
      node('Section', {
        box: {
          name: 'Featured pieces',
          surface: 'subtle',
          padding: 'lg',
          contentWidth: 'contained',
        },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'One of one, never remade.' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Every piece is hand-fabricated and documented. When it sells, it is gone — so we tell you exactly what it is and how it was made.',
            },
          }),
          node('Grid', {
            box: { name: 'Pieces grid', padding: 'none' },
            layout: { direction: 'grid', columns: 3, gap: 'lg' },
            bind: 'commerce.product',
            children: [
              node('Card', {
                box: { name: 'Piece card', surface: 'none', padding: 'sm' },
                layout: { direction: 'stack', gap: 'sm' },
                children: [
                  node('ImageDisplay', { props: { ratio: 'square' }, bind: 'item.images' }),
                  node('Heading', { props: { level: 'h3' }, bind: 'item.title' }),
                  node('PriceTag', { bind: 'item.price' }),
                  node('Button', { props: { label: 'View piece', style: 'soft' } }),
                ],
              }),
            ],
          }),
        ],
      }),

      // THE BENCH — about band, photo beside copy (static photo via box.backgroundImage).
      node('Section', {
        box: { name: 'The bench', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'row', gap: 'lg', alignItems: 'center' },
        children: [
          node('Card', {
            box: {
              name: 'Bench photo',
              height: 'lg',
              padding: 'none',
              backgroundImage: pic('noir-bench', 800, 960),
            },
            layout: { direction: 'stack', gap: 'none' },
          }),
          node('Stack', {
            box: { name: 'Bench copy', padding: 'none' },
            layout: { direction: 'stack', gap: 'sm' },
            children: [
              node('Heading', {
                props: { level: 'h2', text: 'Drawn, carved, and set entirely by hand.' },
              }),
              node('Text', {
                props: {
                  variant: 'body',
                  text: 'Every piece begins as a pencil sketch and ends at the bench — carved in wax, cast in recycled gold, and set stone by stone. We work in small numbers because that is the only way to work this way.',
                },
              }),
              node('Text', {
                props: {
                  variant: 'meta',
                  text: 'Camille Noir · Founder & bench jeweler',
                },
              }),
              node('Button', {
                box: { align: 'start' },
                props: { label: 'About the atelier', style: 'soft', href: '/about' },
              }),
            ],
          }),
        ],
      }),

      // JOURNAL — CMS as a section; iterates posts.
      node('Section', {
        box: { name: 'Journal', surface: 'subtle', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'From the journal.' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Notes on stones, metal, and the slow craft behind each piece.',
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

      // CONVERSION BAND — centered inverse band with the newsletter signup.
      node('Section', {
        box: {
          name: 'New pieces',
          surface: 'inverse',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
        },
        layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'center' },
        bind: 'crm.list',
        children: [
          node('Heading', {
            props: { level: 'h2', text: 'See new pieces before anyone else.' },
          }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'A quiet note when a new piece leaves the bench — with first refusal for subscribers. No noise, no sales.',
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
    box: { name: 'Journal', padding: 'lg', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'The journal' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'Notes on stones, metal, and the slow craft behind each piece.',
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
    box: { name: 'Journal entry', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
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
      name: 'Piece page',
      padding: 'lg',
      backgroundWidth: 'full',
      contentWidth: 'contained',
    },
    layout: { direction: 'stack', gap: 'lg' },
    children: [
      node('Section', {
        box: { name: 'Piece', padding: 'none', contentWidth: 'full' },
        layout: { direction: 'row', gap: 'lg', alignItems: 'start' },
        children: [
          node('ImageDisplay', { props: { ratio: 'square' }, bind: 'product.images' }),
          node('Stack', {
            box: { name: 'Detail', padding: 'none' },
            layout: { direction: 'stack', gap: 'md' },
            children: [
              node('Heading', { props: { level: 'h1' }, bind: 'product.title' }),
              node('PriceTag', { bind: 'product.price' }),
              node('Text', { props: { variant: 'body' }, bind: 'product.description' }),
              node('Button', { props: { label: 'Add to bag', style: 'primary' } }),
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
              node('Heading', { props: { level: 'h3', text: 'Noir Atelier' } }),
            ],
          }),
          node('NavMenu', {
            props: {
              orientation: 'row',
              links: [
                { label: 'Shop', href: '/products' },
                { label: 'Journal', href: '/journal' },
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
          node('Text', { props: { variant: 'meta', text: '© Noir Atelier' } }),
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
      node('Heading', { props: { level: 'h1', text: 'Welcome to Noir Atelier' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'Thank you for joining. When a new piece leaves the bench we send a quiet note — with first refusal for subscribers, before it reaches the shop.',
        },
      }),
      node('Button', {
        props: { label: 'View the collection', href: '' },
        box: { align: 'start' },
      }),
      node('Divider'),
      node('Text', {
        props: { variant: 'meta', text: 'Questions about a piece? Simply reply to this email.' },
      }),
    ],
  });
}

function newPiecesEmailTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'New from the bench' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'A piece has just left the bench — hand-fabricated, photographed, and made once. As a subscriber you see it first.',
        },
      }),
      node('Button', {
        props: { label: 'See the new piece', href: '' },
        box: { align: 'start' },
      }),
      node('Divider'),
      node('Text', {
        props: {
          variant: 'meta',
          text: 'First refusal on new pieces. Unsubscribe anytime — we never share your address.',
        },
      }),
    ],
  });
}

// ── The manifest ───────────────────────────────────────────────────────────────

const manifest = {
  key: 'jewelry-store',
  version: '1.0.0',
  name: 'Jewelry Store',
  summary:
    'A hushed, editorial storefront for a fine-jewelry atelier — one-of-a-kind pieces hand-set in recycled gold, a maker’s story, and a craft journal — themed and ready to review.',
  vertical: 'retail',
  requiresModules: ['builder', 'commerce', 'cms', 'email'],

  brand: {
    businessName: 'Noir Atelier',
    tagline: 'Made once, worn forever.',
    colors: {
      primary: '#0a0a0a',
      primaryForeground: '#FFFFFF',
      accent: '#b08d57',
      secondary: '#1a1a1a',
    },
    fonts: { heading: 'Cormorant Garamond', body: 'Inter' },
    logoLightAssetId: 'logo',
  },

  // The NEW theme this blueprint ships (docs/54 D5): a named SiteTheme over the
  // `drift` preset — near-black ink with a soft champagne-gold accent.
  theme: {
    name: 'Noir',
    basePresetKey: 'drift',
    presentation: { v: 2, containerWidth: '1140px' },
    brand: {
      colorPrimary: '#0a0a0a',
      colorPrimaryForeground: '#FFFFFF',
      colorAccent: '#b08d57',
      fontHeading: 'Cormorant Garamond',
      fontBody: 'Inter',
      tokens: { radiusBase: '8px' },
    },
    apply: true,
  },

  assets: [
    {
      id: 'logo',
      url: 'https://ui-avatars.com/api/?name=Noir+Atelier&background=0a0a0a&color=b08d57&bold=true&size=128&format=svg',
      alt: 'Noir Atelier',
    },
    // Journal featured images.
    {
      id: 'journal-stones-img',
      url: pic('noir-journal-stones', 1200, 750),
      alt: 'Loose gemstones on a jeweler’s tray',
    },
    {
      id: 'journal-gold-img',
      url: pic('noir-journal-gold', 1200, 750),
      alt: 'Casting recycled gold at the bench',
    },
    // Piece images (one each — every piece is one of one).
    {
      id: 'solitaire-img',
      url: pic('noir-solitaire', 1000, 1000),
      alt: 'Old-mine diamond solitaire ring',
    },
    {
      id: 'sapphire-pendant-img',
      url: pic('noir-sapphire-pendant', 1000, 1000),
      alt: 'Ceylon sapphire pendant',
    },
    {
      id: 'gold-cuff-img',
      url: pic('noir-gold-cuff', 1000, 1000),
      alt: 'Hammered gold cuff bracelet',
    },
    {
      id: 'emerald-earrings-img',
      url: pic('noir-emerald-earrings', 1000, 1000),
      alt: 'Emerald drop earrings',
    },
    {
      id: 'signet-img',
      url: pic('noir-signet', 1000, 1000),
      alt: 'Carved gold signet ring',
    },
  ],

  // Lean on built-in content types (page, blog_post) — no custom types.
  contentTypes: [],

  content: [
    {
      typeKey: 'blog_post',
      slug: 'choosing-an-old-mine-diamond',
      body: {
        title: 'Why we love an old-mine cut',
        excerpt:
          'Hand-cut a century before the modern brilliant — what an antique diamond gives up in sparkle it returns in character.',
        body: doc(
          'A modern brilliant is cut by machine to fling light back at you. An old-mine diamond was cut by hand, by candlelight, to glow rather than to flash — a softer, warmer fire that modern stones simply cannot fake.',
          'We seek these stones out precisely because no two are alike: a slightly off-round outline, a high crown, a small culet you can see straight down through the table. They are imperfect on purpose, and that is the point.',
          'When one finds its way to the bench, we build the whole piece around it — never the other way around.'
        ),
        featuredImage: assetRef('journal-stones-img'),
      },
    },
    {
      typeKey: 'blog_post',
      slug: 'recycled-gold-at-the-bench',
      body: {
        title: 'Recycled gold, and why it changes nothing — and everything',
        excerpt:
          'Refined gold is elemental: it carries no history of where it has been. Here is why we cast with it, always.',
        body: doc(
          'Gold is an element. Once it is refined, an ounce reclaimed from old jewelry is chemically identical to an ounce pulled from the ground this morning — the same purity, the same working properties, the same warm color at the bench.',
          'What changes is everything upstream: no new mining, no new tailings, no new scar on a hillside. We cast every piece in certified recycled gold because the result is indistinguishable and the cost to the world is not.',
          'It is the easiest decision we make, and we make it every single time.'
        ),
        featuredImage: assetRef('journal-gold-img'),
      },
    },
    {
      typeKey: 'page',
      slug: 'about',
      body: {
        title: 'About the atelier',
        excerpt: 'A one-bench studio making single pieces, slowly and by hand.',
        body: doc(
          'Noir Atelier is a one-bench studio. Every piece is drawn, carved in wax, cast in recycled gold, and set stone by stone — by the same pair of hands, from sketch to finish.',
          'We make in single pieces, not editions. That means a longer wait and a smaller catalog, and it means that when you buy a piece, no one else has it or ever will.',
          'If something here is close but not quite right, write to us — most of what we make begins as a conversation.'
        ),
      },
    },
    {
      typeKey: 'page',
      slug: 'contact',
      body: {
        title: 'Contact & commissions',
        excerpt: 'Questions, sizing, or a piece made just for you — we’d love to hear from you.',
        body: doc(
          'For questions, sizing, or care, write to hello@noiratelier.example and we’ll reply within a business day.',
          'For commissions, send us a few words about what you have in mind — a stone you already own, an heirloom to remake, or just a feeling — and we’ll take it from there.'
        ),
      },
    },
  ],

  commerce: {
    categories: [
      { handle: 'rings', name: 'Rings', position: 0, featured: true },
      { handle: 'necklaces', name: 'Necklaces', position: 1, featured: true },
      { handle: 'earrings', name: 'Earrings', position: 2 },
      { handle: 'bracelets', name: 'Bracelets', position: 3 },
    ],
    collections: [
      {
        handle: 'featured',
        name: 'Featured',
        type: 'manual',
        featured: true,
        productHandles: [
          'old-mine-solitaire',
          'ceylon-sapphire-pendant',
          'hammered-gold-cuff',
          'emerald-drop-earrings',
          'carved-gold-signet',
        ],
      },
    ],
    products: [
      {
        handle: 'old-mine-solitaire',
        title: 'Old-Mine Solitaire Ring',
        description:
          '<p>A 1.20ct antique old-mine cut diamond, hand-set in an 18k recycled yellow gold low-profile basket.</p><p><strong>Stone:</strong> 1.20ct old-mine cut diamond, J colour, VS2. <strong>Metal:</strong> 18k recycled yellow gold. <strong>Size:</strong> US 6.5, resizable on request.</p><p>One of one — made once, sold once.</p>',
        productType: 'Rings',
        vendor: 'Noir Atelier',
        tags: ['ring', 'diamond', 'one-of-a-kind'],
        categoryHandles: ['rings'],
        collectionHandles: ['featured'],
        variants: [{ sku: 'NA-RING-OMS-001', priceCents: 685000, isDefault: true, position: 0 }],
        images: [{ assetId: 'solitaire-img', isPrimary: true, position: 0 }],
      },
      {
        handle: 'ceylon-sapphire-pendant',
        title: 'Ceylon Sapphire Pendant',
        description:
          '<p>A cornflower-blue Ceylon sapphire bezel-set in 18k recycled gold on a 16-inch handmade chain.</p><p><strong>Stone:</strong> 2.05ct unheated Ceylon sapphire. <strong>Metal:</strong> 18k recycled yellow gold. <strong>Chain:</strong> 16in handmade cable.</p><p>One of one — no two alike.</p>',
        productType: 'Necklaces',
        vendor: 'Noir Atelier',
        tags: ['necklace', 'sapphire', 'one-of-a-kind'],
        categoryHandles: ['necklaces'],
        collectionHandles: ['featured'],
        variants: [{ sku: 'NA-PEND-SAP-002', priceCents: 412000, isDefault: true, position: 0 }],
        images: [{ assetId: 'sapphire-pendant-img', isPrimary: true, position: 0 }],
      },
      {
        handle: 'hammered-gold-cuff',
        title: 'Hammered Gold Cuff',
        description:
          '<p>A wide cuff hand-raised and hammer-textured from a single billet of 14k recycled gold.</p><p><strong>Metal:</strong> 14k recycled yellow gold, 22mm wide. <strong>Finish:</strong> hand-hammered, lightly satined. <strong>Fit:</strong> medium wrist, gently adjustable.</p><p>One of one.</p>',
        productType: 'Bracelets',
        vendor: 'Noir Atelier',
        tags: ['bracelet', 'gold', 'one-of-a-kind'],
        categoryHandles: ['bracelets'],
        collectionHandles: ['featured'],
        variants: [{ sku: 'NA-CUFF-HAM-003', priceCents: 298000, isDefault: true, position: 0 }],
        images: [{ assetId: 'gold-cuff-img', isPrimary: true, position: 0 }],
      },
      {
        handle: 'emerald-drop-earrings',
        title: 'Emerald Drop Earrings',
        description:
          '<p>A matched pair of Colombian emerald drops on hand-fabricated 18k recycled gold hooks.</p><p><strong>Stones:</strong> 1.60ctw Colombian emeralds. <strong>Metal:</strong> 18k recycled yellow gold. <strong>Drop:</strong> 28mm from the ear wire.</p><p>One of one — sold as a pair.</p>',
        productType: 'Earrings',
        vendor: 'Noir Atelier',
        tags: ['earrings', 'emerald', 'one-of-a-kind'],
        categoryHandles: ['earrings'],
        collectionHandles: ['featured'],
        variants: [{ sku: 'NA-EAR-EMR-004', priceCents: 524000, isDefault: true, position: 0 }],
        images: [{ assetId: 'emerald-earrings-img', isPrimary: true, position: 0 }],
      },
      {
        handle: 'carved-gold-signet',
        title: 'Carved Gold Signet Ring',
        description:
          '<p>A solid signet hand-carved from 18k recycled gold, with a bevelled face ready for engraving.</p><p><strong>Metal:</strong> 18k recycled yellow gold, 12mm face. <strong>Size:</strong> US 9, resizable on request. <strong>Finish:</strong> hand-polished; engraving available.</p><p>One of one.</p>',
        productType: 'Rings',
        vendor: 'Noir Atelier',
        tags: ['ring', 'signet', 'gold', 'one-of-a-kind'],
        categoryHandles: ['rings'],
        collectionHandles: ['featured'],
        variants: [{ sku: 'NA-RING-SIG-005', priceCents: 256000, isDefault: true, position: 0 }],
        images: [{ assetId: 'signet-img', isPrimary: true, position: 0 }],
      },
    ],
  },

  components: [],

  layout: { name: 'Noir layout', tree: siteLayoutTree(), makeActive: true },

  pages: [
    { name: 'Home', kind: 'singleton', tree: homeTree(), seoTitle: 'Noir Atelier — Fine Jewelry' },
    { name: 'Journal', kind: 'singleton', slug: 'journal', tree: journalIndexTree() },
    {
      name: 'Journal entry',
      kind: 'collection',
      recordType: 'cms.blog_post',
      isDefault: true,
      tree: blogPostTree(),
    },
    {
      name: 'Piece page',
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
      subject: 'Welcome to Noir Atelier',
      preheader: 'First refusal on new pieces, before they reach the shop.',
      tree: welcomeEmailTree(),
    },
    {
      name: 'New from the bench',
      subject: 'New from the bench',
      preheader: 'A new one-of-a-kind piece — subscribers see it first.',
      tree: newPiecesEmailTree(),
    },
  ],
};

/** The fine-jewelry atelier blueprint, parsed + integrity-checked at module load
 *  so an invalid edit fails fast (and `defaults` are applied). */
export const jewelryStore: Blueprint = parseBlueprint(manifest);
