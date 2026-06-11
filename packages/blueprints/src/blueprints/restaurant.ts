// A restaurant blueprint (docs/54 §12, sibling of retail-store-blog.ts): a warm
// neighbourhood bistro — "Olive & Ember" — with a static, scannable menu, an
// about page telling the kitchen's story, and reservation/contact calls to
// action. No commerce — the menu is STATIC content (dishes aren't sold online),
// and there's no journal. It exercises builder + cms + email. Everything installs
// to DRAFT (docs/54 D4); the tenant reviews, customizes, and goes live.
//
// Authoring notes:
//   · Trees are real @sparx/builder-schemas nodes (same JSON the editor emits)
//     and bind via tokens, so they re-theme to whatever tenant installs them.
//   · Menu sections are STATIC content (grouped columns of dish name + meta) in
//     the home and menu page trees — nothing is sold online.
//   · Static imagery in trees hot-links a raw URL (box.backgroundImage); page
//     entries (about, menu, contact) render through the cms.page template.

import {
  seedNode,
  type BoxStyle,
  type BuilderNode,
  type LayoutStyle,
} from '@sparx/builder-schemas';

import type { Blueprint } from '../manifest';
import { parseBlueprint } from '../validate';

// ── Tree authoring helpers (mirror builder-schemas/starters.ts) ────────────────

let nid = 0;
const rid = (t: string): string => `res-${t}-${(nid += 1)}`;

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

// ── Menu helpers (STATIC content — dishes aren't sold online) ───────────────────

/** One static menu item — a dish Heading with a "description · price" meta. */
function menuItem(name: string, meta: string): BuilderNode {
  return node('Stack', {
    box: { name, padding: 'sm' },
    layout: { direction: 'stack', gap: 'none', alignItems: 'start' },
    children: [
      node('Heading', { props: { level: 'h3', text: name } }),
      node('Text', { props: { variant: 'meta', text: meta } }),
    ],
  });
}

/** A grouped menu column (Starters / Mains / Sweets). */
function menuColumn(title: string, items: BuilderNode[]): BuilderNode {
  return node('Stack', {
    box: { name: `${title} column`, padding: 'none' },
    layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
    children: [node('Heading', { props: { level: 'h3', text: title } }), ...items],
  });
}

/** The full three-column menu grid, reused on the home and menu pages. */
function menuGrid(): BuilderNode {
  return node('Grid', {
    box: { name: 'Menu grid', padding: 'none' },
    layout: { direction: 'grid', columns: 3, gap: 'lg' },
    children: [
      menuColumn('To start', [
        menuItem('Wood-fired flatbread', 'whipped feta, charred scallion, honey · $11'),
        menuItem('Ember beets', 'smoked yogurt, dukkah, mint · $13'),
        menuItem('Olive & herb plate', 'marinated olives, warm bread, oil · $9'),
      ]),
      menuColumn('Mains', [
        menuItem('Coal-roasted chicken', 'lemon, garlic, charred greens · $26'),
        menuItem('Smoked short rib', 'red wine jus, root mash · $32'),
        menuItem('Charred eggplant', 'tahini, pomegranate, flatbread · $21'),
        menuItem('Catch of the day', 'market price, ask your server'),
      ]),
      menuColumn('Sweets', [
        menuItem('Olive oil cake', 'citrus, crème fraîche · $10'),
        menuItem('Burnt honey panna cotta', 'stone fruit, thyme · $11'),
      ]),
    ],
  });
}

// ── Page trees ─────────────────────────────────────────────────────────────────

function homeTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Home', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      // HERO — full-bleed dining room photo with a dark scrim + light text.
      node('Section', {
        box: {
          name: 'Hero',
          height: 'lg',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
          backgroundImage: pic('oliveember-hero-room', 2000, 1100),
          overlay: 'dark',
          textTone: 'light',
        },
        layout: { direction: 'stack', gap: 'sm', justify: 'center', alignItems: 'center' },
        children: [
          node('Heading', { props: { level: 'h1', text: 'Fire, smoke, and a table that feels like home.' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'A warm neighbourhood bistro cooking over open flame — seasonal plates, an honest wine list, and a room made for lingering.',
            },
          }),
          node('Button', {
            props: { label: 'Reserve a table', style: 'primary', href: '/contact' },
          }),
        ],
      }),

      // STORY band — static photo beside a short welcome.
      node('Section', {
        box: { name: 'Welcome', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'row', gap: 'lg', alignItems: 'center' },
        children: [
          node('Section', {
            box: {
              name: 'Kitchen photo',
              height: 'lg',
              backgroundWidth: 'full',
              contentWidth: 'full',
              padding: 'none',
              backgroundImage: pic('oliveember-kitchen', 800, 1000),
            },
          }),
          node('Stack', {
            box: { name: 'Welcome copy', padding: 'none' },
            layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
            children: [
              node('Heading', { props: { level: 'h2', text: 'Cooked over coals, served without fuss' } }),
              node('Text', {
                props: {
                  variant: 'body',
                  text: 'Everything that can touch fire does. We let good ingredients and a hot hearth do the work, then get out of their way.',
                },
              }),
              node('Text', {
                props: {
                  variant: 'body',
                  text: 'The menu shifts with the season and what the market gives us, but the welcome never changes — pull up a chair and stay a while.',
                },
              }),
            ],
          }),
        ],
      }),

      // MENU — a static, scannable preview of the menu.
      node('Section', {
        box: { name: 'Menu', surface: 'subtle', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'On the menu' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'A taste of what is on tonight. The full menu changes with the season — ask your server about the day’s specials.',
            },
          }),
          menuGrid(),
          node('Button', {
            props: { label: 'See the full menu', style: 'soft', href: '/menu' },
            box: { align: 'center' },
          }),
        ],
      }),

      // GALLERY — static tiles of dishes and the room.
      node('Section', {
        box: { name: 'Gallery', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'A few moments from the room' } }),
          node('Grid', {
            box: { name: 'Gallery grid', padding: 'none' },
            layout: { direction: 'grid', columns: 3, gap: 'md' },
            children: [
              node('Section', {
                box: {
                  name: 'Tile · hearth',
                  height: 'md',
                  backgroundWidth: 'full',
                  contentWidth: 'full',
                  padding: 'none',
                  backgroundImage: pic('oliveember-tile-hearth', 700, 700),
                },
              }),
              node('Section', {
                box: {
                  name: 'Tile · plate',
                  height: 'md',
                  backgroundWidth: 'full',
                  contentWidth: 'full',
                  padding: 'none',
                  backgroundImage: pic('oliveember-tile-plate', 700, 700),
                },
              }),
              node('Section', {
                box: {
                  name: 'Tile · table',
                  height: 'md',
                  backgroundWidth: 'full',
                  contentWidth: 'full',
                  padding: 'none',
                  backgroundImage: pic('oliveember-tile-table', 700, 700),
                },
              }),
            ],
          }),
        ],
      }),

      // RESERVE — centered band: reservation CTA + join the list (Signup).
      node('Section', {
        box: {
          name: 'Reserve',
          surface: 'inverse',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
        },
        layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'center' },
        bind: 'crm.list',
        children: [
          node('Heading', { props: { level: 'h2', text: 'Save your seat by the fire' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Book a table for tonight or the weekend — or join the list for seasonal menus, special dinners, and the occasional secret pop-up.',
            },
          }),
          node('Button', {
            props: { label: 'Reserve a table', style: 'primary', href: '/contact' },
          }),
          node('Signup', { props: { cta: 'Join the list' }, bind: 'crm.list' }),
        ],
      }),
    ],
  });
}

// The full menu page tree — a static, structured menu (not a CMS collection).
function menuPageTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Menu page', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      node('Section', {
        box: {
          name: 'Header',
          height: 'sm',
          surface: 'muted',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
        },
        layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'center' },
        children: [
          node('Heading', { props: { level: 'h1', text: 'The menu' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Seasonal and ever-changing — here is what we are cooking right now.',
            },
          }),
        ],
      }),
      node('Section', {
        box: { name: 'Menu body', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'lg' },
        children: [
          menuGrid(),
          node('Stack', {
            box: { name: 'Drinks', padding: 'none' },
            layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
            children: [
              node('Heading', { props: { level: 'h2', text: 'To drink' } }),
              node('Text', {
                props: {
                  variant: 'body',
                  text: 'A short, well-chosen wine list weighted toward small growers, plus a rotating draught beer, a house negroni, and zero-proof options for the table.',
                },
              }),
            ],
          }),
          node('Text', {
            props: {
              variant: 'meta',
              text: 'Please let your server know about any allergies — almost everything can be adapted.',
            },
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
              node('Heading', { props: { level: 'h3', text: 'Olive & Ember' } }),
            ],
          }),
          node('NavMenu', {
            props: {
              orientation: 'row',
              links: [
                { label: 'Menu', href: '/menu' },
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
                { label: 'Menu', href: '/menu' },
                { label: 'About', href: '/about' },
                { label: 'Contact', href: '/contact' },
              ],
            },
          }),
          node('SocialLinks', { bind: 'site.social' }),
          node('Text', { props: { variant: 'meta', text: '© Olive & Ember' } }),
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
      node('Heading', { props: { level: 'h1', text: 'Welcome to Olive & Ember' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: "Thanks for joining us. We'll send seasonal menus, special dinners, and the occasional secret pop-up — never too often.",
        },
      }),
      node('Button', { props: { label: 'Reserve a table', href: '' }, box: { align: 'start' } }),
      node('Divider'),
      node('Text', { props: { variant: 'meta', text: 'Questions or a large party? Just reply to this email.' } }),
    ],
  });
}

function seasonalEmailTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'A new menu, fresh from the fire' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'The season turned, and so did the menu. New mains over the coals, a fresh dessert, and a few wines worth driving in for.',
        },
      }),
      node('Button', { props: { label: 'Book your table', href: '' }, box: { align: 'start' } }),
      node('Divider'),
      node('Text', {
        props: {
          variant: 'meta',
          text: "You're receiving this because you joined the list at Olive & Ember.",
        },
      }),
    ],
  });
}

// ── The manifest ───────────────────────────────────────────────────────────────

const manifest = {
  key: 'restaurant',
  version: '1.0.0',
  name: 'Restaurant',
  summary:
    'A warm neighbourhood bistro site with a static, scannable menu, a story-led about page, a gallery, and reserve-a-table calls to action — no online ordering, just an inviting room and the season on a plate, themed and ready to review.',
  vertical: 'services',
  requiresModules: ['builder', 'cms', 'email'],

  brand: {
    businessName: 'Olive & Ember',
    tagline: 'Cooked over open flame.',
    colors: {
      primary: '#b91c1c',
      primaryForeground: '#FFFFFF',
      accent: '#d97706',
      secondary: '#1A1411',
    },
    fonts: { heading: 'Sora', body: 'Inter' },
    logoLightAssetId: 'logo',
  },

  // The NEW theme this blueprint ships (docs/54 D5): a named SiteTheme over the
  // `market` preset — warm and appetite-forward to match the bistro identity.
  theme: {
    name: 'Olive & Ember',
    basePresetKey: 'market',
    presentation: { v: 2, containerWidth: '1140px' },
    brand: {
      colorPrimary: '#b91c1c',
      colorPrimaryForeground: '#FFFFFF',
      colorAccent: '#d97706',
      fontHeading: 'Sora',
      fontBody: 'Inter',
      tokens: { radiusBase: '8px' },
    },
    apply: true,
  },

  assets: [
    {
      id: 'logo',
      url: 'https://ui-avatars.com/api/?name=Olive+Ember&background=b91c1c&color=FFFFFF&bold=true&size=128&format=svg',
      alt: 'Olive & Ember',
    },
  ],

  // Lean on built-in content types (page) — no custom types in v1.
  contentTypes: [],

  content: [
    {
      typeKey: 'page',
      slug: 'about',
      body: {
        title: 'About Olive & Ember',
        excerpt: 'A neighbourhood bistro cooking over open flame.',
        body: doc(
          'Olive & Ember began with a single wood-fired hearth and a stubborn idea: that the best food is simple, seasonal, and cooked close to the fire.',
          'Our kitchen changes the menu with what the market gives us — bright in spring, smoky in autumn — but the heart of it never moves. Good ingredients, an open flame, and a little patience.',
          'The room is small on purpose. We would rather know your name and your usual wine than serve twice as many tables. Come hungry, come early, and stay as long as you like.'
        ),
      },
    },
    {
      typeKey: 'page',
      slug: 'menu',
      body: {
        title: 'The menu',
        excerpt: 'Seasonal plates cooked over coals — here is tonight.',
        body: doc(
          'Our menu shifts with the season and the market, so the printed page is always a snapshot. Ask your server what just came off the fire.',
          'To start, we lean on the hearth: wood-fired flatbreads, ember-roasted vegetables, and a plate of olives and warm bread to share while you settle in.',
          'Mains centre on the coals — coal-roasted chicken, smoked short rib, a charred eggplant for the table, and whatever the day’s catch happens to be. Finish with an olive oil cake or burnt-honey panna cotta.'
        ),
      },
    },
    {
      typeKey: 'page',
      slug: 'contact',
      body: {
        title: 'Visit & reserve',
        excerpt: 'Find us, book a table, or plan a private dinner.',
        body: doc(
          'You will find us at 58 Kindling Lane, open for dinner Tuesday through Sunday from 5pm, with the kitchen open until 10 on weekends. We are closed Mondays.',
          'To reserve, book online or call (555) 010-7788. Tables of six or more, please call so we can seat you properly. Walk-ins are always welcome at the bar.',
          'For private dinners, buyouts, or press, email hello@oliveandember.example and we will get back within a business day.'
        ),
      },
    },
  ],

  components: [],

  layout: { name: 'Olive & Ember layout', tree: siteLayoutTree(), makeActive: true },

  pages: [
    { name: 'Home', kind: 'singleton', tree: homeTree(), seoTitle: 'Olive & Ember' },
    { name: 'Menu', kind: 'singleton', slug: 'menu', tree: menuPageTree() },
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
      subject: 'Welcome to Olive & Ember',
      preheader: "You're on the list — seasonal menus and the odd secret pop-up.",
      tree: welcomeEmailTree(),
    },
    {
      name: 'Seasonal menu',
      subject: 'A new menu, fresh from the fire',
      preheader: 'New mains over the coals and a fresh dessert this season.',
      tree: seasonalEmailTree(),
    },
  ],
};

export const restaurant: Blueprint = parseBlueprint(manifest);
