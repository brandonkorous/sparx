// A heritage gallery-catalogue blueprint for a curated antiques dealer
// ("Marrow & Hale, Antiquarians"). Sibling of retail-store-blog.ts — it exercises
// the same modules (brand + a NEW shipped theme, CMS content, a commerce catalog,
// builder pages + the site layout, marketing emails) but for a one-of-a-kind
// dealer: each piece is a single-variant product with era/origin/condition in its
// description, collections are grouped by era/type, and the mood is warm,
// editorial, restrained. Everything installs to DRAFT (docs/54 D4); the tenant
// reviews, customizes, and goes live.
//
// Authoring notes (mirror retail-store-blog.ts):
//   · Trees are real @sparx/builder-schemas nodes (same JSON the editor emits)
//     and bind via tokens, so they re-theme to whatever tenant installs them.
//   · Static imagery in trees hot-links a raw URL (box.backgroundImage); imagery
//     bound to records (products, posts) comes from the seeded assets.
//   · Placeholder images hot-link picsum.photos (the mockup's seeds) — swap for
//     owned media when the install path moves to copy-into-tenant-media.

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
const rid = (t: string): string => `ant-${t}-${(nid += 1)}`;

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
      // HERO — editorial full-bleed parlor photo, dark scrim + light text.
      node('Section', {
        box: {
          name: 'Hero',
          height: 'lg',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
          backgroundImage: pic('marrow-hero-parlor', 2000, 1100),
          overlay: 'dark',
          textTone: 'light',
        },
        layout: { direction: 'stack', gap: 'sm', justify: 'center', alignItems: 'center' },
        children: [
          node('Heading', {
            props: { level: 'h1', text: 'Pieces that have already outlived a century.' },
          }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'A small, exacting collection of period furniture, lighting and objects from our showroom in Hudson, New York — each one sourced, researched and sold once. No reproductions, no two alike.',
            },
          }),
          node('Button', {
            props: {
              label: 'Browse the collection',
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
          node('Heading', { props: { level: 'h2', text: 'One of one, never restocked.' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Every piece is photographed, dated and documented. When it sells, it is gone — so we tell you exactly what it is.',
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

      // COLLECTIONS BY ERA — static tiles via box.backgroundImage Cards.
      node('Section', {
        box: { name: 'Collections', surface: 'muted', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'Shop the rooms, or the eras.' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'We group the collection the way a house is actually furnished — by period and by purpose.',
            },
          }),
          node('Grid', {
            box: { name: 'Era tiles', padding: 'none' },
            layout: { direction: 'grid', columns: 4, gap: 'md' },
            children: [
              node('Card', {
                box: {
                  name: 'Mid-Century tile',
                  height: 'md',
                  padding: 'lg',
                  align: 'start',
                  backgroundImage: pic('marrow-col-midcentury', 600, 800),
                  overlay: 'gradient',
                  textTone: 'light',
                },
                layout: { direction: 'stack', gap: 'none', justify: 'end', alignItems: 'start' },
                children: [node('Heading', { props: { level: 'h3', text: 'Mid-Century' } })],
              }),
              node('Card', {
                box: {
                  name: 'Victorian tile',
                  height: 'md',
                  padding: 'lg',
                  align: 'start',
                  backgroundImage: pic('marrow-col-victorian', 600, 800),
                  overlay: 'gradient',
                  textTone: 'light',
                },
                layout: { direction: 'stack', gap: 'none', justify: 'end', alignItems: 'start' },
                children: [node('Heading', { props: { level: 'h3', text: 'Victorian' } })],
              }),
              node('Card', {
                box: {
                  name: 'Industrial tile',
                  height: 'md',
                  padding: 'lg',
                  align: 'start',
                  backgroundImage: pic('marrow-col-industrial', 600, 800),
                  overlay: 'gradient',
                  textTone: 'light',
                },
                layout: { direction: 'stack', gap: 'none', justify: 'end', alignItems: 'start' },
                children: [node('Heading', { props: { level: 'h3', text: 'Industrial' } })],
              }),
              node('Card', {
                box: {
                  name: 'Lighting tile',
                  height: 'md',
                  padding: 'lg',
                  align: 'start',
                  backgroundImage: pic('marrow-col-lighting', 600, 800),
                  overlay: 'gradient',
                  textTone: 'light',
                },
                layout: { direction: 'stack', gap: 'none', justify: 'end', alignItems: 'start' },
                children: [node('Heading', { props: { level: 'h3', text: 'Lighting' } })],
              }),
            ],
          }),
        ],
      }),

      // THE STORY — about band, photo beside copy (static photo via box.backgroundImage).
      node('Section', {
        box: { name: 'The story', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'row', gap: 'lg', alignItems: 'center' },
        children: [
          node('Card', {
            box: {
              name: 'Founders photo',
              height: 'lg',
              padding: 'none',
              backgroundImage: pic('marrow-story-founders', 800, 960),
            },
            layout: { direction: 'stack', gap: 'none' },
          }),
          node('Stack', {
            box: { name: 'Story copy', padding: 'none' },
            layout: { direction: 'stack', gap: 'sm' },
            children: [
              node('Heading', {
                props: {
                  level: 'h2',
                  text: 'Fifty years of finding the right thing, and only the right thing.',
                },
              }),
              node('Text', {
                props: {
                  variant: 'body',
                  text: 'Marrow & Hale began as a single estate-sale stall in 1971. Three generations later we still buy the same way: slowly, in person, and only when a piece can stand on its own provenance. We would rather sell forty objects we can vouch for than four hundred we cannot.',
                },
              }),
              node('Text', {
                props: {
                  variant: 'body',
                  text: 'Every item is cleaned by hand, researched, and sold with what we know of its history — maker, period, and the wear that proves it lived. If we are not certain, we say so.',
                },
              }),
              node('Text', {
                props: {
                  variant: 'meta',
                  text: 'Eleanor Hale · Third-generation dealer & curator',
                },
              }),
              node('Button', {
                box: { align: 'start' },
                props: { label: 'More about the shop', style: 'link', href: '/the-story' },
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
          node('Heading', { props: { level: 'h2', text: 'From the Journal.' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Care guides, maker histories, and notes from the road on what we find and why it matters.',
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

      // VISIT — address & hours as static Text.
      node('Section', {
        box: { name: 'Visit', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'row', gap: 'lg', alignItems: 'start' },
        children: [
          node('Stack', {
            box: { name: 'Visit copy', padding: 'none' },
            layout: { direction: 'stack', gap: 'sm' },
            children: [
              node('Heading', { props: { level: 'h2', text: 'Come and see them in person.' } }),
              node('Text', {
                props: {
                  variant: 'body',
                  text: 'Photographs only get you so far. The showroom is open five days a week — handle the pieces, ask the questions, take your time.',
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
                props: {
                  variant: 'body',
                  text: 'The Showroom — 114 Warren Street, Hudson, NY 12534',
                },
              }),
              node('Text', {
                props: {
                  variant: 'body',
                  text: 'Hours — Wed–Sun, 11am–6pm. Mon & Tue by appointment.',
                },
              }),
              node('Text', {
                props: {
                  variant: 'body',
                  text: 'Enquiries — (518) 555-0147 · hello@marrowandhale.com',
                },
              }),
            ],
          }),
        ],
      }),

      // CONVERSION BAND — inverse moment with the newsletter signup.
      node('Section', {
        box: {
          name: 'New finds',
          surface: 'inverse',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
        },
        layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'center' },
        children: [
          node('Heading', {
            props: { level: 'h2', text: 'New finds, every week, before they hit the floor.' },
          }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'We send one quiet email a week — the pieces we have just acquired, with first refusal for subscribers. No noise, no sales.',
            },
          }),
          node('Signup', { props: { cta: 'Subscribe' } }),
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
      node('Heading', { props: { level: 'h1', text: 'The Journal' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'Care guides, maker histories, and notes from the road — on what we find and why it matters.',
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
          node('ImageDisplay', { props: { ratio: 'portrait' }, bind: 'product.images' }),
          node('Stack', {
            box: { name: 'Detail', padding: 'none' },
            layout: { direction: 'stack', gap: 'md' },
            children: [
              node('Heading', { props: { level: 'h1' }, bind: 'product.title' }),
              node('PriceTag', { bind: 'product.price' }),
              node('Text', { props: { variant: 'body' }, bind: 'product.description' }),
              node('Button', { props: { label: 'Enquire about this piece', style: 'primary' } }),
            ],
          }),
        ],
      }),
    ],
  });
}

// A `cms.page` template (The Story, Visit, …) — binds the page entry's fields.
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
              node('Logo', { bind: 'site.identity' }),
              node('Heading', { props: { level: 'h3', text: 'Marrow & Hale' } }),
            ],
          }),
          node('NavMenu', {
            props: {
              orientation: 'row',
              links: [
                { label: 'Shop', href: '/products' },
                { label: 'The story', href: '/the-story' },
                { label: 'Journal', href: '/journal' },
                { label: 'Visit', href: '/visit' },
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
                { label: 'The story', href: '/the-story' },
                { label: 'Visit', href: '/visit' },
              ],
            },
          }),
          node('SocialLinks', { bind: 'site.social' }),
          node('Text', { props: { variant: 'meta', text: '© Marrow & Hale' } }),
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
      node('Heading', { props: { level: 'h1', text: 'Welcome to Marrow & Hale' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'Thank you for joining. Once a week we send the pieces we have just acquired — with first refusal for subscribers, before they reach the showroom floor.',
        },
      }),
      node('Button', {
        props: { label: 'Browse the collection', href: '' },
        box: { align: 'start' },
      }),
      node('Divider'),
      node('Text', {
        props: { variant: 'meta', text: 'Questions about a piece? Simply reply to this email.' },
      }),
    ],
  });
}

function newFindsEmailTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'New finds this week' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'A handful of pieces we have just brought in — sourced in person, researched, and sold once. As a subscriber you see them first.',
        },
      }),
      node('Button', {
        props: { label: 'See this week’s arrivals', href: '' },
        box: { align: 'start' },
      }),
      node('Divider'),
      node('Text', {
        props: {
          variant: 'meta',
          text: 'First refusal on new arrivals. Unsubscribe anytime — we never share your address.',
        },
      }),
    ],
  });
}

// ── The manifest ───────────────────────────────────────────────────────────────

const manifest = {
  key: 'antique-shop',
  version: '0.1.0',
  name: 'Antique Shop',
  summary:
    'A heritage, gallery-catalogue site for a curated antiques dealer — one-of-a-kind pieces with provenance, collections by era, a story, and a journal — themed and ready to review.',
  vertical: 'retail',
  requiresModules: ['builder', 'commerce', 'cms', 'email'],

  brand: {
    businessName: 'Marrow & Hale',
    tagline: 'Antiquarians since 1971.',
    colors: {
      primary: '#9A7B2E',
      primaryForeground: '#FFFFFF',
      accent: '#3B4A3A',
      secondary: '#2A2520',
    },
    fonts: { heading: 'Fraunces', body: 'Hanken Grotesk' },
    logoLightAssetId: 'logo',
  },

  // The NEW theme this blueprint ships (docs/54 D5): a named SiteTheme over the
  // `market` preset, warm/editorial brass + forest over a paper canvas.
  theme: {
    name: 'Marrow',
    basePresetKey: 'market',
    presentation: { v: 2, containerWidth: '1200px' },
    brand: {
      colorPrimary: '#9A7B2E',
      colorPrimaryForeground: '#FFFFFF',
      colorAccent: '#3B4A3A',
      fontHeading: 'Fraunces',
      fontBody: 'Hanken Grotesk',
      tokens: { radiusBase: '2px' },
    },
    apply: true,
  },

  assets: [
    {
      id: 'logo',
      url: 'https://ui-avatars.com/api/?name=Marrow+Hale&background=9A7B2E&color=FFFFFF&bold=true&size=128&format=svg',
      alt: 'Marrow & Hale Antiquarians',
    },
    // Journal featured images.
    {
      id: 'journal-wax-img',
      url: pic('marrow-journal-wax', 1200, 750),
      alt: 'Waxing an antique wood finish',
    },
    {
      id: 'journal-maker-img',
      url: pic('marrow-journal-maker', 1200, 750),
      alt: "A cabinetmaker's stamp",
    },
    {
      id: 'journal-road-img',
      url: pic('marrow-journal-road', 1200, 750),
      alt: 'Sourcing antiques on the road',
    },
    // Piece images (one each — every piece is one of one).
    {
      id: 'secretaire-img',
      url: pic('marrow-secretaire', 1000, 1250),
      alt: 'French walnut secretaire desk',
    },
    {
      id: 'armchairs-img',
      url: pic('marrow-armchair', 1000, 1250),
      alt: 'Pair of leather club armchairs',
    },
    {
      id: 'chandelier-img',
      url: pic('marrow-chandelier', 1000, 1250),
      alt: 'Brass and crystal chandelier',
    },
    {
      id: 'workbench-img',
      url: pic('marrow-workbench', 1000, 1250),
      alt: "Industrial machinist's workbench",
    },
    { id: 'mirror-img', url: pic('marrow-mirror', 1000, 1250), alt: 'Giltwood overmantel mirror' },
    {
      id: 'sideboard-img',
      url: pic('marrow-sideboard', 1000, 1250),
      alt: 'Mid-century teak sideboard',
    },
    // Category / era hero images.
    {
      id: 'cat-midcentury-hero',
      url: pic('marrow-col-midcentury', 600, 800),
      alt: 'Mid-century modern furniture',
    },
    {
      id: 'cat-victorian-hero',
      url: pic('marrow-col-victorian', 600, 800),
      alt: 'Victorian antiques',
    },
    {
      id: 'cat-industrial-hero',
      url: pic('marrow-col-industrial', 600, 800),
      alt: 'Industrial antiques',
    },
    { id: 'cat-lighting-hero', url: pic('marrow-col-lighting', 600, 800), alt: 'Antique lighting' },
  ],

  // Lean on built-in content types (page, blog_post) — no custom types.
  contentTypes: [],

  content: [
    {
      typeKey: 'blog_post',
      slug: 'waxing-an-antique-finish',
      body: {
        title: 'How to wax — and not ruin — an antique finish',
        excerpt:
          'The five-minute ritual that keeps a 19th-century patina alive instead of stripping it away.',
        body: doc(
          'A good antique finish is the record of a century of use — the soft sheen, the darkened edges, the small marks that prove a piece was lived with. Strip it and you erase the very thing that makes it worth owning.',
          'Use a soft cloth, a hard paste wax, and patience: a thin coat worked in with the grain, left to haze, then buffed by hand. Never silicone sprays, never sanding. Once or twice a year is plenty.',
          'When in doubt, do less. Patina is earned over decades; it is gone in an afternoon.'
        ),
        featuredImage: assetRef('journal-wax-img'),
      },
    },
    {
      typeKey: 'blog_post',
      slug: 'reading-the-makers-stamp',
      body: {
        title: 'Reading the stamp: who really made your sideboard',
        excerpt:
          "A short field guide to maker's marks, workshop stamps, and the difference they make to value.",
        body: doc(
          'A maker’s mark is a small thing — a stamped initial, a paper label half-perished in a drawer, a chalk number on an unfinished back. But it can change a piece from anonymous to attributable, and attribution is most of what provenance means.',
          'We look first where the maker did: the underside of a drawer, the inside of a carcass, the rebate behind a mirror plate. Then we cross-reference what we find against workshop records and known dates of operation.',
          'Not every good piece is signed, and not every signed piece is good. But knowing who held the chisel is the beginning of knowing what you have.'
        ),
        featuredImage: assetRef('journal-maker-img'),
      },
    },
    {
      typeKey: 'blog_post',
      slug: 'a-week-buying-in-the-loire',
      body: {
        title: 'A week of buying in the Loire Valley',
        excerpt:
          'Six estate sales, one very heavy secretaire, and the case for sourcing in person.',
        body: doc(
          'You cannot smell a photograph. You cannot feel the weight of old oak, or run a thumb along a joint to tell a hand-cut dovetail from a machine, through a screen. So twice a year we go and buy the way we always have — in person, slowly, on the road.',
          'This trip took us through six estate sales across the Loire, a long argument over a French walnut secretaire, and a great deal of careful packing. Most of what we passed on we passed on for a reason; the few pieces we brought home, we can tell you everything about.',
          'It is slower and more expensive than buying from a catalogue. It is also the only way we know how to be certain.'
        ),
        featuredImage: assetRef('journal-road-img'),
      },
    },
    {
      typeKey: 'page',
      slug: 'the-story',
      body: {
        title: 'The Story',
        excerpt: 'Fifty years of finding the right thing, and only the right thing.',
        body: doc(
          'Marrow & Hale began as a single estate-sale stall in 1971. Three generations later we still buy the same way: slowly, in person, and only when a piece can stand on its own provenance.',
          'We would rather sell forty objects we can vouch for than four hundred we cannot. Every item is cleaned by hand, researched, and sold with what we know of its history — maker, period, and the wear that proves it lived. If we are not certain, we say so.',
          'The showroom in Hudson is where it all comes together: a small, exacting collection you can handle, question, and take your time with.'
        ),
      },
    },
    {
      typeKey: 'page',
      slug: 'visit',
      body: {
        title: 'Visit',
        excerpt: 'Come and see them in person — the showroom is open five days a week.',
        body: doc(
          'Photographs only get you so far. The showroom is open Wednesday through Sunday, 11am to 6pm, with Monday and Tuesday by appointment. Handle the pieces, ask the questions, take your time.',
          'You will find us at 114 Warren Street, Hudson, NY 12534. For enquiries, reservations, or trade visits, call (518) 555-0147 or write to hello@marrowandhale.com.',
          'If a piece has caught your eye online, let us know before you come and we will have it ready on the floor.'
        ),
      },
    },
  ],

  commerce: {
    categories: [
      {
        handle: 'mid-century',
        name: 'Mid-Century',
        position: 0,
        featured: true,
        heroAssetId: 'cat-midcentury-hero',
      },
      {
        handle: 'victorian',
        name: 'Victorian',
        position: 1,
        heroAssetId: 'cat-victorian-hero',
      },
      {
        handle: 'industrial',
        name: 'Industrial',
        position: 2,
        heroAssetId: 'cat-industrial-hero',
      },
      {
        handle: 'lighting',
        name: 'Lighting',
        position: 3,
        featured: true,
        heroAssetId: 'cat-lighting-hero',
      },
    ],
    collections: [
      {
        handle: 'featured',
        name: 'Featured Pieces',
        type: 'manual',
        featured: true,
        heroAssetId: 'cat-midcentury-hero',
        productHandles: [
          'french-walnut-secretaire',
          'pair-of-club-armchairs',
          'brass-crystal-chandelier',
          'machinists-workbench',
          'giltwood-overmantel-mirror',
          'teak-sideboard',
        ],
      },
    ],
    products: [
      {
        handle: 'french-walnut-secretaire',
        title: 'French Walnut Secretaire',
        description:
          '<p>A Louis-Philippe secretaire à abattant in figured walnut, c.1840, from Lyon, France.</p><p><strong>Era:</strong> Louis-Philippe, c.1840. <strong>Origin:</strong> Lyon, France. <strong>Condition:</strong> Excellent original condition; fall-front fitted interior intact, working lock and key, light honest wear consistent with age.</p><p>One of one — sourced, researched, and sold once.</p>',
        productType: 'Furniture',
        vendor: 'Marrow & Hale',
        tags: ['victorian', 'desk', 'walnut'],
        categoryHandles: ['victorian'],
        collectionHandles: ['featured'],
        variants: [{ sku: 'MH-SECRETAIRE-1840', priceCents: 485000, isDefault: true, position: 0 }],
        images: [{ assetId: 'secretaire-img', isPrimary: true, position: 0 }],
      },
      {
        handle: 'pair-of-club-armchairs',
        title: 'Pair of Club Armchairs',
        description:
          '<p>A matched pair of Art Deco club armchairs in cognac leather, c.1930.</p><p><strong>Era:</strong> Art Deco, c.1930. <strong>Origin:</strong> France. <strong>Condition:</strong> Original cognac leather with a deep, even patina; frames sound, seats re-webbed for use. Sold as a pair.</p><p>One of one — no two alike.</p>',
        productType: 'Seating',
        vendor: 'Marrow & Hale',
        tags: ['art-deco', 'seating', 'leather'],
        categoryHandles: ['mid-century'],
        collectionHandles: ['featured'],
        variants: [{ sku: 'MH-CLUBCHAIRS-1930', priceCents: 320000, isDefault: true, position: 0 }],
        images: [{ assetId: 'armchairs-img', isPrimary: true, position: 0 }],
      },
      {
        handle: 'brass-crystal-chandelier',
        title: 'Brass & Crystal Chandelier',
        description:
          '<p>A Belle Époque chandelier in polished brass hung with Bohemian crystal, c.1900.</p><p><strong>Era:</strong> Belle Époque, c.1900. <strong>Origin:</strong> Bohemia. <strong>Condition:</strong> Fully restored and rewired to current standards; original crystal complete, brass cleaned and lacquered. A statement piece.</p><p>One of one — reserved on request.</p>',
        productType: 'Lighting',
        vendor: 'Marrow & Hale',
        tags: ['belle-epoque', 'lighting', 'crystal'],
        categoryHandles: ['lighting'],
        collectionHandles: ['featured'],
        variants: [{ sku: 'MH-CHANDELIER-1900', priceCents: 690000, isDefault: true, position: 0 }],
        images: [{ assetId: 'chandelier-img', isPrimary: true, position: 0 }],
      },
      {
        handle: 'machinists-workbench',
        title: "Machinist's Workbench",
        description:
          '<p>An industrial machinist’s workbench in oak and cast iron, c.1925.</p><p><strong>Era:</strong> Industrial, c.1925. <strong>Origin:</strong> United States. <strong>Condition:</strong> Heavily and honestly worn — scarred oak top, original cast-iron base and vice. Cleaned, stabilised, and ready for a second working life as a console or kitchen island.</p><p>One of one.</p>',
        productType: 'Furniture',
        vendor: 'Marrow & Hale',
        tags: ['industrial', 'table', 'oak'],
        categoryHandles: ['industrial'],
        collectionHandles: ['featured'],
        variants: [{ sku: 'MH-WORKBENCH-1925', priceCents: 210000, isDefault: true, position: 0 }],
        images: [{ assetId: 'workbench-img', isPrimary: true, position: 0 }],
      },
      {
        handle: 'giltwood-overmantel-mirror',
        title: 'Giltwood Overmantel Mirror',
        description:
          '<p>A Georgian giltwood overmantel mirror retaining its original mercury glass, c.1790.</p><p><strong>Era:</strong> Georgian, c.1790. <strong>Origin:</strong> England. <strong>Condition:</strong> Original mercury plate with characterful foxing; giltwood frame with minor losses sympathetically conserved. A rare survivor.</p><p>One of one.</p>',
        productType: 'Mirrors',
        vendor: 'Marrow & Hale',
        tags: ['georgian', 'mirror', 'giltwood'],
        categoryHandles: ['victorian'],
        collectionHandles: ['featured'],
        variants: [{ sku: 'MH-MIRROR-1790', priceCents: 167500, isDefault: true, position: 0 }],
        images: [{ assetId: 'mirror-img', isPrimary: true, position: 0 }],
      },
      {
        handle: 'teak-sideboard',
        title: 'Teak Sideboard',
        description:
          '<p>A mid-century Danish teak sideboard, c.1962, attributed to a small Copenhagen workshop.</p><p><strong>Era:</strong> Mid-century, c.1962. <strong>Origin:</strong> Denmark, attrib. workshop. <strong>Condition:</strong> Beautiful original teak, oiled by hand; sliding doors and dovetailed drawers run true. Just arrived.</p><p>One of one.</p>',
        productType: 'Furniture',
        vendor: 'Marrow & Hale',
        tags: ['mid-century', 'sideboard', 'teak'],
        categoryHandles: ['mid-century'],
        collectionHandles: ['featured'],
        variants: [{ sku: 'MH-SIDEBOARD-1962', priceCents: 295000, isDefault: true, position: 0 }],
        images: [{ assetId: 'sideboard-img', isPrimary: true, position: 0 }],
      },
    ],
  },

  components: [],

  layout: { name: 'Marrow layout', tree: siteLayoutTree(), makeActive: true },

  pages: [
    { name: 'Home', kind: 'singleton', tree: homeTree(), seoTitle: 'Marrow & Hale — Antiquarians' },
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
      subject: 'Welcome to Marrow & Hale',
      preheader: 'First refusal on new arrivals, before they hit the floor.',
      tree: welcomeEmailTree(),
    },
    {
      name: 'New finds this week',
      subject: 'New finds this week',
      preheader: 'The pieces we have just acquired — subscribers see them first.',
      tree: newFindsEmailTree(),
    },
  ],
};

export const antiqueShop: Blueprint = parseBlueprint(manifest);
