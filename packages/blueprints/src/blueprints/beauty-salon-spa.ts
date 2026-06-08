// A Beauty Salon & Spa blueprint (docs/54 §12, sibling of retail-store-blog.ts):
// an elegant hair & skin studio — "Maren & Wilde" — with a priced, scannable
// service menu, a stylist team, a small retail shelf of haircare/skincare, a
// journal, and book-now calls to action. It exercises builder + cms + commerce +
// email. Everything installs to DRAFT (docs/54 D4); the tenant reviews,
// customizes, and goes live.
//
// Authoring notes:
//   · Trees are real @sparx/builder-schemas nodes (same JSON the editor emits)
//     and bind via tokens, so they re-theme to whatever tenant installs them.
//   · Services are NOT sold online here — the priced/timed menu is STATIC content
//     in the home tree (grouped columns of Text lines).
//   · Static imagery in trees hot-links a raw URL (box.backgroundImage); imagery
//     bound to records (products, posts) comes from the seeded assets.
//   · Placeholder images hot-link picsum.photos with the mockup's seeds so the
//     installed site matches the design (docs/54 §6 deferred).

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
const rid = (t: string): string => `bsp-${t}-${(nid += 1)}`;

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

/** One priced/timed service line — STATIC content (services aren't sold online).
 *  Renders as a name Heading with a "duration · price" meta Text beneath. */
function serviceLine(name: string, meta: string): BuilderNode {
  return node('Stack', {
    box: { name, padding: 'sm' },
    layout: { direction: 'stack', gap: 'none', alignItems: 'start' },
    children: [
      node('Heading', { props: { level: 'h3', text: name } }),
      node('Text', { props: { variant: 'meta', text: meta } }),
    ],
  });
}

/** A grouped column of the service menu (Hair / Skin / Nails & hands). */
function serviceColumn(title: string, lines: BuilderNode[]): BuilderNode {
  return node('Stack', {
    box: { name: `${title} column`, padding: 'none' },
    layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
    children: [node('Heading', { props: { level: 'h3', text: title } }), ...lines],
  });
}

/** A static stylist card — photo via box.backgroundImage, name + role beneath. */
function stylistCard(seed: string, name: string, role: string): BuilderNode {
  return node('Card', {
    box: { name, surface: 'none', padding: 'none' },
    layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
    children: [
      node('Section', {
        box: {
          name: 'Portrait',
          height: 'md',
          backgroundWidth: 'full',
          contentWidth: 'full',
          padding: 'none',
          backgroundImage: pic(seed, 600, 800),
        },
      }),
      node('Heading', { props: { level: 'h3', text: name } }),
      node('Text', { props: { variant: 'meta', text: role } }),
    ],
  });
}

/** A static lookbook tile — image via box.backgroundImage. */
function galleryTile(seed: string, w: number, h: number): BuilderNode {
  return node('Section', {
    box: {
      name: 'Look',
      height: 'md',
      backgroundWidth: 'full',
      contentWidth: 'full',
      padding: 'none',
      backgroundImage: pic(seed, w, h),
    },
  });
}

function homeTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Home', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      // HERO — warm full-bleed studio photo with a light scrim + light text.
      node('Section', {
        box: {
          name: 'Hero',
          height: 'lg',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
          backgroundImage: pic('marenwilde-hero-studio', 2000, 1100),
          overlay: 'dark',
          textTone: 'light',
        },
        layout: { direction: 'stack', gap: 'sm', justify: 'center', alignItems: 'center' },
        children: [
          node('Heading', { props: { level: 'h1', text: 'Hair and skin, tended like a garden.' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'A warm, light-filled studio in the old quarter — where colour, cut and skincare are slow craft, never assembly line.',
            },
          }),
          node('Button', {
            props: { label: 'Book appointment', style: 'primary', href: '/contact' },
          }),
        ],
      }),

      // SERVICES MENU — static, priced, scannable. Three grouped columns.
      node('Section', {
        box: { name: 'Services', surface: 'subtle', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'The menu' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Pricing starts where the work begins; your stylist confirms the exact figure at consultation. Every visit includes a quiet cup of something and time to settle in.',
            },
          }),
          node('Grid', {
            box: { name: 'Menu grid', padding: 'none' },
            layout: { direction: 'grid', columns: 3, gap: 'lg' },
            children: [
              serviceColumn('Hair', [
                serviceLine('Cut & finish', '75 min · from $85'),
                serviceLine('Balayage & gloss', '3 hr · from $240'),
                serviceLine('Full colour', '2 hr · from $150'),
                serviceLine('Smoothing treatment', '2.5 hr · from $210'),
              ]),
              serviceColumn('Skin', [
                serviceLine('Signature facial', '60 min · from $120'),
                serviceLine('Dewglow peel', '45 min · from $135'),
                serviceLine('Brow & lash shape', '30 min · from $55'),
              ]),
              serviceColumn('Nails & hands', [
                serviceLine('Garden manicure', '45 min · from $48'),
                serviceLine('Gel & restore pedicure', '60 min · from $72'),
              ]),
            ],
          }),
        ],
      }),

      // TEAM — static stylist cards (photo + name + role).
      node('Section', {
        box: { name: 'Team', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: "Hands you'll come to trust" } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'A small, senior team — each with their own quiet specialty.',
            },
          }),
          node('Grid', {
            box: { name: 'Team grid', padding: 'none' },
            layout: { direction: 'grid', columns: 4, gap: 'lg' },
            children: [
              stylistCard('marenwilde-stylist-maren', 'Maren Vidal', 'Founder · Master Colourist'),
              stylistCard('marenwilde-stylist-wilde', 'Theo Wilde', 'Co-founder · Senior Stylist'),
              stylistCard('marenwilde-stylist-juniper', 'Juniper Cho', 'Lead Esthetician'),
              stylistCard('marenwilde-stylist-ines', 'Inès Moreau', 'Nail Artist'),
            ],
          }),
        ],
      }),

      // SHOP — a small retail shelf; iterates products from Commerce.
      node('Section', {
        box: { name: 'Shop', surface: 'subtle', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'Take the studio home' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: "The same considered formulas we reach for at the chair — nothing we wouldn't use ourselves.",
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

      // LOOKBOOK — static gallery of recent looks via box.backgroundImage.
      node('Section', {
        box: { name: 'Lookbook', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'From the chair' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'A few recent looks, colours and quiet corners of the studio.',
            },
          }),
          node('Grid', {
            box: { name: 'Gallery grid', padding: 'none' },
            layout: { direction: 'grid', columns: 3, gap: 'md' },
            children: [
              galleryTile('marenwilde-look-1', 800, 800),
              galleryTile('marenwilde-look-2', 400, 400),
              galleryTile('marenwilde-look-3', 400, 600),
              galleryTile('marenwilde-look-4', 400, 400),
              galleryTile('marenwilde-look-5', 800, 400),
              galleryTile('marenwilde-look-6', 400, 400),
            ],
          }),
        ],
      }),

      // JOURNAL — CMS teaser; iterates posts.
      node('Section', {
        box: { name: 'Journal', surface: 'subtle', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'The journal' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Notes on care, colour and the rituals worth keeping.',
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

      // ABOUT / STORY — a warm dark band: founders photo beside the story.
      node('Section', {
        box: { name: 'Story', surface: 'inverse', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'row', gap: 'lg', alignItems: 'center' },
        children: [
          node('Section', {
            box: {
              name: 'Founders',
              height: 'lg',
              backgroundWidth: 'full',
              contentWidth: 'full',
              padding: 'none',
              backgroundImage: pic('marenwilde-story-founders', 700, 880),
            },
          }),
          node('Stack', {
            box: { name: 'Story copy', padding: 'none' },
            layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
            children: [
              node('Heading', {
                props: { level: 'h2', text: 'We opened the studio we always wished existed.' },
              }),
              node('Text', {
                props: {
                  variant: 'body',
                  text: 'Maren & Wilde began with two chairs, a stubborn idea, and a long lease on a corner full of afternoon light. We wanted unhurried appointments, honest advice, and a room that smelled of eucalyptus and good coffee.',
                },
              }),
              node('Text', {
                props: {
                  variant: 'body',
                  text: "Twelve years on, the idea hasn't changed. Small team, real conversation, and colour and care that look like you on your best ordinary day.",
                },
              }),
              node('Text', { props: { variant: 'meta', text: '— Maren & Theo' } }),
            ],
          }),
        ],
      }),

      // CONVERSION — centered band: book CTA + join the list (Signup).
      node('Section', {
        box: {
          name: 'Conversion',
          surface: 'muted',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
        },
        layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'center' },
        bind: 'crm.list',
        children: [
          node('Heading', { props: { level: 'h2', text: 'Your chair is waiting' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Book online in under a minute — or join the list for seasonal openings, new treatments and the occasional studio note.',
            },
          }),
          node('Button', {
            props: { label: 'Book appointment', style: 'primary', href: '/contact' },
          }),
          node('Signup', { props: { cta: 'Join' }, bind: 'crm.list' }),
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
        props: { variant: 'body', text: 'Notes on care, colour and the rituals worth keeping.' },
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

// A `cms.page` template (About, Visit, …) — binds the page entry's fields.
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
              node('Heading', { props: { level: 'h3', text: 'Maren & Wilde' } }),
            ],
          }),
          node('NavMenu', {
            props: {
              orientation: 'row',
              links: [
                { label: 'Shop', href: '/products' },
                { label: 'Journal', href: '/journal' },
                { label: 'About', href: '/about' },
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
                { label: 'Visit', href: '/visit' },
              ],
            },
          }),
          node('SocialLinks', { bind: 'site.social' }),
          node('Text', { props: { variant: 'meta', text: '© Maren & Wilde' } }),
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
      node('Heading', { props: { level: 'h1', text: 'Welcome to Maren & Wilde' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: "Thank you for joining us. We'll send seasonal openings, new treatments, and the occasional quiet note from the studio — nothing noisy.",
        },
      }),
      node('Button', { props: { label: 'Book appointment', href: '' }, box: { align: 'start' } }),
      node('Divider'),
      node('Text', {
        props: {
          variant: 'meta',
          text: 'Questions? Just reply to this email — a real person reads it.',
        },
      }),
    ],
  });
}

function newsletterEmailTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'New this season — book your next visit' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'A few fresh treatments on the menu, a new shade story for autumn, and the haircare we keep reaching for at the chair.',
        },
      }),
      node('Button', {
        props: { label: 'Book your next visit', href: '' },
        box: { align: 'start' },
      }),
      node('Divider'),
      node('Text', {
        props: {
          variant: 'meta',
          text: "You're receiving this because you joined the list at Maren & Wilde. Unsubscribe whenever you like.",
        },
      }),
    ],
  });
}

// ── The manifest ───────────────────────────────────────────────────────────────

const manifest = {
  key: 'beauty-salon-spa',
  version: '0.1.0',
  name: 'Beauty Salon & Spa',
  summary:
    'An elegant salon & spa site with a priced, scannable service menu, a stylist team, a small retail shelf of haircare/skincare, a journal, and book-now calls to action — themed and ready to review.',
  vertical: 'services',
  requiresModules: ['builder', 'cms', 'commerce', 'email'],

  brand: {
    businessName: 'Maren & Wilde',
    tagline: 'Hair & skin, considered.',
    colors: {
      primary: '#8C9A82',
      primaryForeground: '#FFFFFF',
      accent: '#C9A98C',
      secondary: '#3D352C',
    },
    fonts: { heading: 'Fraunces', body: 'Jost' },
    logoLightAssetId: 'logo',
  },

  // The NEW theme this blueprint ships (docs/54 D5): a named SiteTheme over the
  // `drift` preset — soft/warm/light, matching the salon identity colors above.
  theme: {
    name: 'Maren',
    basePresetKey: 'drift',
    presentation: { v: 2, containerWidth: '1200px' },
    brand: {
      colorPrimary: '#8C9A82',
      colorPrimaryForeground: '#FFFFFF',
      colorAccent: '#C9A98C',
      fontHeading: 'Fraunces',
      fontBody: 'Jost',
      tokens: { radiusBase: '14px' },
    },
    apply: true,
  },

  assets: [
    {
      id: 'logo',
      url: 'https://ui-avatars.com/api/?name=Maren+Wilde&background=8C9A82&color=FFFFFF&bold=true&size=128&format=svg',
      alt: 'Maren & Wilde',
    },
    // Retail product imagery (mockup seeds).
    {
      id: 'prod-shampoo',
      url: pic('marenwilde-prod-shampoo', 1000, 1000),
      alt: 'Botanic Repair Shampoo',
    },
    {
      id: 'prod-serum',
      url: pic('marenwilde-prod-serum', 1000, 1000),
      alt: 'Dewglow Vitamin C Serum',
    },
    {
      id: 'prod-oil',
      url: pic('marenwilde-prod-oil', 1000, 1000),
      alt: 'Featherlight Finishing Oil',
    },
    {
      id: 'prod-balm',
      url: pic('marenwilde-prod-balm', 1000, 1000),
      alt: 'Garden Hand & Cuticle Balm',
    },
    // Journal featured images (mockup seeds).
    { id: 'journal-1-img', url: pic('marenwilde-journal-1', 800, 600), alt: 'Hair-washing ritual' },
    { id: 'journal-2-img', url: pic('marenwilde-journal-2', 800, 600), alt: 'Skincare flatlay' },
    {
      id: 'journal-3-img',
      url: pic('marenwilde-journal-3', 800, 600),
      alt: 'Studio plants and morning light',
    },
  ],

  // Lean on built-in content types (page, blog_post) — no custom types in v1.
  contentTypes: [],

  content: [
    {
      typeKey: 'blog_post',
      slug: 'make-a-fresh-colour-last',
      body: {
        title: 'How to make a fresh colour last the season',
        excerpt:
          'The small at-home habits that protect a salon investment — from water temperature to the oils worth skipping.',
        body: doc(
          'A fresh colour is an investment, and most of what fades it happens at home in the first two weeks. Cooler water, fewer washes, and a sulphate-free shampoo do more than any single product can.',
          'Wait a full 72 hours before the first wash so the cuticle can close, then keep water lukewarm and finish with a cool rinse to seal in shine.',
          'Skip the heavy oils on the days you wash; they lift tone faster than you would think. Save them for second-day ends, and let a weekly mask do the deeper work.'
        ),
        featuredImage: assetRef('journal-1-img'),
      },
    },
    {
      typeKey: 'blog_post',
      slug: 'barrier-first-skincare',
      body: {
        title: 'Barrier-first: the case for doing less',
        excerpt:
          'Why our estheticians keep paring routines back — and the three steps that actually move the needle.',
        body: doc(
          'Most skin that comes to us is over-treated, not under-treated. A long routine of actives can quietly erode the barrier, leaving skin reactive, tight, and harder to calm.',
          'We start almost everyone in the same place: a gentle cleanse, a humectant while skin is still damp, and a simple moisturiser to lock it in. Three steps, done consistently.',
          'Once the barrier is steady, we add one active at a time and watch how skin answers. Slower is not only kinder — it is usually faster to the result you actually wanted.'
        ),
        featuredImage: assetRef('journal-2-img'),
      },
    },
    {
      typeKey: 'blog_post',
      slug: 'a-morning-in-the-studio',
      body: {
        title: 'A morning in the old quarter: a stylist Q&A',
        excerpt:
          'The light, the espresso, the records we play before the doors open — a look at how the day begins.',
        body: doc(
          'We asked founder Maren Vidal what a morning at the studio looks like before the first client arrives. Her answer, lightly edited.',
          '"I get in early, open the shutters, and let the room fill with that old-quarter light. The espresso machine goes on, a record goes on, and the team drifts in. We talk through the day’s bookings together so no one is rushed."',
          '"The work is exacting, but the feeling should be easy. If a guest leaves looking like the best version of an ordinary day, the morning did its job."'
        ),
        featuredImage: assetRef('journal-3-img'),
      },
    },
    {
      typeKey: 'page',
      slug: 'about',
      body: {
        title: 'About Maren & Wilde',
        excerpt: 'A hair & skin studio built on slow craft and honest advice.',
        body: doc(
          'Maren & Wilde began with two chairs, a stubborn idea, and a long lease on a corner full of afternoon light. We wanted unhurried appointments, honest advice, and a room that smelled of eucalyptus and good coffee.',
          'Twelve years on, the idea has not changed. A small, senior team — colour, cut, skin and nails — each with their own quiet specialty, and the time to do the work properly.',
          'We believe great salon work looks like you on your best ordinary day, and that it should be easy to keep up at home. That is the whole of it.'
        ),
      },
    },
    {
      typeKey: 'page',
      slug: 'visit',
      body: {
        title: 'Visit the studio',
        excerpt: 'Find us in the old quarter — by appointment, Monday through Saturday.',
        body: doc(
          'You will find us at 14 Linden Court, Old Quarter, Visalia CA. We are open by appointment Tuesday to Friday, 9 to 7, and Saturday 9 to 5; closed Sunday and Monday.',
          'To book, call (559) 555-0168 or email hello@marenandwilde.com and we will find a time that suits. New guests, do let us know a little about your hair or skin so we can plan the right amount of time.',
          'For gift cards, careers, or a wedding-day enquiry, reach out the same way and we will route you to the right person.'
        ),
      },
    },
  ],

  commerce: {
    categories: [
      { handle: 'hair-care', name: 'Hair Care', position: 0, featured: true },
      { handle: 'skin-care', name: 'Skin Care', position: 1, featured: true },
    ],
    collections: [
      {
        handle: 'studio-shelf',
        name: 'The Studio Shelf',
        type: 'manual',
        featured: true,
        productHandles: [
          'botanic-repair-shampoo',
          'dewglow-vitamin-c-serum',
          'featherlight-finishing-oil',
          'garden-hand-cuticle-balm',
        ],
      },
    ],
    products: [
      {
        handle: 'botanic-repair-shampoo',
        title: 'Botanic Repair Shampoo',
        description:
          '<p>A sulphate-free, colour-safe shampoo with botanical proteins that rebuild softness wash after wash.</p>',
        productType: 'Haircare',
        vendor: 'Maren & Wilde',
        tags: ['haircare', 'shampoo', 'colour-safe'],
        categoryHandles: ['hair-care'],
        collectionHandles: ['studio-shelf'],
        options: [
          {
            name: 'Size',
            displayType: 'segmented',
            position: 0,
            values: [
              { value: '250ml', position: 0 },
              { value: '500ml', position: 1 },
            ],
          },
        ],
        variants: [
          {
            sku: 'SHMP-250',
            optionValues: { Size: '250ml' },
            priceCents: 3200,
            isDefault: true,
            position: 0,
          },
          {
            sku: 'SHMP-500',
            optionValues: { Size: '500ml' },
            priceCents: 5200,
            position: 1,
          },
        ],
        images: [{ assetId: 'prod-shampoo', isPrimary: true, position: 0 }],
      },
      {
        handle: 'dewglow-vitamin-c-serum',
        title: 'Dewglow Vitamin C Serum',
        description:
          '<p>A lightweight, barrier-friendly vitamin C serum for tone, texture and a lit-from-within finish.</p>',
        productType: 'Skincare',
        vendor: 'Maren & Wilde',
        tags: ['skincare', 'serum', 'brightening'],
        categoryHandles: ['skin-care'],
        collectionHandles: ['studio-shelf'],
        variants: [{ sku: 'SERUM-VITC', priceCents: 5800, isDefault: true, position: 0 }],
        images: [{ assetId: 'prod-serum', isPrimary: true, position: 0 }],
      },
      {
        handle: 'featherlight-finishing-oil',
        title: 'Featherlight Finishing Oil',
        description:
          '<p>A weightless finishing oil that tames frizz and adds glossy movement without a trace of grease.</p>',
        productType: 'Haircare',
        vendor: 'Maren & Wilde',
        tags: ['haircare', 'styling', 'oil'],
        categoryHandles: ['hair-care'],
        collectionHandles: ['studio-shelf'],
        variants: [{ sku: 'OIL-FNSH', priceCents: 3800, isDefault: true, position: 0 }],
        images: [{ assetId: 'prod-oil', isPrimary: true, position: 0 }],
      },
      {
        handle: 'garden-hand-cuticle-balm',
        title: 'Garden Hand & Cuticle Balm',
        description:
          '<p>A botanical balm for hands and cuticles, scented with eucalyptus and sweet almond — the studio in a jar.</p>',
        productType: 'Skincare',
        vendor: 'Maren & Wilde',
        tags: ['skincare', 'hands', 'balm'],
        categoryHandles: ['skin-care'],
        collectionHandles: ['studio-shelf'],
        variants: [{ sku: 'BALM-GRDN', priceCents: 2400, isDefault: true, position: 0 }],
        images: [{ assetId: 'prod-balm', isPrimary: true, position: 0 }],
      },
    ],
  },

  components: [],

  layout: { name: 'Maren layout', tree: siteLayoutTree(), makeActive: true },

  pages: [
    {
      name: 'Home',
      kind: 'singleton',
      tree: homeTree(),
      seoTitle: 'Maren & Wilde — Hair & Skin Studio',
    },
    { name: 'Journal', kind: 'singleton', slug: 'journal', tree: journalIndexTree() },
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
      subject: 'Welcome to Maren & Wilde',
      preheader: "You're on the list — slow craft, warm room, honest advice.",
      tree: welcomeEmailTree(),
    },
    {
      name: 'Studio newsletter',
      subject: 'New this season — book your next visit',
      preheader: 'Fresh treatments, an autumn shade story, and shelf favourites.',
      tree: newsletterEmailTree(),
    },
  ],
};

export const beautySalonSpa: Blueprint = parseBlueprint(manifest);
