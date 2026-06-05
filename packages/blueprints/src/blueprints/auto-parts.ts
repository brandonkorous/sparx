// A diesel & fleet parts supplier blueprint (docs/54 §12 sibling of the flagship):
// a tough, utilitarian B2B storefront — shop-by-system categories, a parts catalog
// with part numbers and fitment, fleet/trade calls to action, and a "shop talk"
// journal — that exercises Builder, Commerce, CMS, and Email. Everything installs
// to DRAFT (docs/54 D4); the tenant reviews, customizes, and goes live.
//
// Authoring notes:
//   · Trees are real @sparx/builder-schemas nodes (same JSON the editor emits)
//     and bind via tokens, so they re-theme to whatever tenant installs them.
//   · Static imagery in trees hot-links a raw URL (box.backgroundImage); imagery
//     bound to records (products, posts) comes from the seeded assets.
//   · Placeholder images hot-link picsum.photos with the same seeds as the design
//     mockup (mockups/templates/auto-parts.html) — swap for owned media when the
//     install path moves to copy-into-tenant-media (docs/54 §6 deferred).

import {
  DEFAULT_BOX,
  DEFAULT_LAYOUT,
  type BoxBase,
  type BuilderNode,
  type LayoutBase,
} from '@sparx/builder-schemas';

import type { Blueprint } from '../manifest';
import { assetRef } from '../refs';
import { parseBlueprint } from '../validate';

// ── Tree authoring helpers (mirror builder-schemas/starters.ts) ────────────────

let nid = 0;
const rid = (t: string): string => `aps-${t}-${(nid += 1)}`;
const box = (o: Partial<BoxBase> = {}): BoxBase => ({ ...DEFAULT_BOX, ...o });
const lay = (o: Partial<LayoutBase> = {}): LayoutBase => ({ ...DEFAULT_LAYOUT, ...o });

function node(
  type: string,
  opts: {
    box?: Partial<BoxBase>;
    layout?: Partial<LayoutBase>;
    props?: Record<string, unknown>;
    bind?: string;
    children?: BuilderNode[];
  } = {}
): BuilderNode {
  const out: BuilderNode = { id: rid(type), type, box: box(opts.box), props: opts.props ?? {} };
  if (opts.layout) out.layout = lay(opts.layout);
  if (opts.bind) out.binding = { path: opts.bind };
  if (opts.children) out.children = opts.children;
  return out;
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

/** A static shop-by-system category tile: a background photo with a dark scrim
 *  and a light label. Reused six times on the home page. */
function systemTile(seed: string, label: string): BuilderNode {
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

/** A static fleet/trade value card: a heading + a line of supporting copy. */
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

/** A static brand chip. */
function brandChip(label: string): BuilderNode {
  return node('Card', {
    box: { name: label, surface: 'subtle', padding: 'sm' },
    layout: { direction: 'stack', gap: 'none', alignItems: 'center', justify: 'center' },
    children: [node('Text', { props: { variant: 'body', text: label } })],
  });
}

function homeTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Home', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      // HERO — full-bleed diesel-bay photo, dark scrim, light text. Two CTAs.
      node('Section', {
        box: {
          name: 'Hero',
          height: 'lg',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'start',
          padding: 'xl',
          backgroundImage: pic('ironhaul-diesel-bay', 2000, 1100),
          overlay: 'dark',
          textTone: 'light',
        },
        layout: { direction: 'stack', gap: 'sm', justify: 'center', alignItems: 'start' },
        children: [
          node('Heading', {
            props: { level: 'h1', text: 'The right diesel part, fits the first time.' },
          }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'OE-replacement and performance parts for Cummins, Power Stroke, and Duramax — backed by real fitment data, six stocking warehouses, and counter-grade support. Built for fleets that can’t afford a wrong part.',
            },
          }),
          node('Stack', {
            box: { name: 'Hero actions', padding: 'none' },
            layout: { direction: 'row', gap: 'sm', alignItems: 'center' },
            children: [
              node('Button', {
                props: {
                  label: 'Shop the catalog',
                  style: 'primary',
                  href: '/collections/featured',
                },
              }),
              node('Button', {
                props: { label: 'Open a fleet account', style: 'soft', href: '/fleet-accounts' },
              }),
            ],
          }),
        ],
      }),

      // SHOP BY SYSTEM — static category tiles, two rows of three.
      node('Section', {
        box: { name: 'Shop by system', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'Shop by system' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Every department, filtered to your vehicle the moment it’s selected — no wrong-part guesswork.',
            },
          }),
          node('Grid', {
            box: { name: 'System grid', padding: 'none' },
            layout: { direction: 'grid', columns: 3, gap: 'md' },
            children: [
              systemTile('ih-engine', 'Engine'),
              systemTile('ih-fuel', 'Fuel & Injection'),
              systemTile('ih-brakes', 'Brakes'),
              systemTile('ih-filter', 'Filtration'),
              systemTile('ih-elec', 'Electrical'),
              systemTile('ih-drive', 'Drivetrain'),
            ],
          }),
        ],
      }),

      // FEATURED PARTS — Commerce as one section; iterates products.
      node('Section', {
        box: {
          name: 'Featured parts',
          surface: 'subtle',
          padding: 'lg',
          contentWidth: 'contained',
        },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'Featured parts' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Fast-moving parts our fleet customers reorder most. Prices shown are list — sign in for your fleet pricing.',
            },
          }),
          node('Grid', {
            box: { name: 'Parts grid', padding: 'none' },
            layout: { direction: 'grid', columns: 4, gap: 'md' },
            bind: 'commerce.product',
            children: [
              node('Card', {
                box: { name: 'Part card', surface: 'none', padding: 'sm' },
                layout: { direction: 'stack', gap: 'sm' },
                children: [
                  node('ImageDisplay', { props: { ratio: 'square' }, bind: 'item.images' }),
                  node('Heading', { props: { level: 'h3' }, bind: 'item.title' }),
                  node('PriceTag', { bind: 'item.price' }),
                  node('Button', { props: { label: 'Add to order', style: 'primary' } }),
                ],
              }),
            ],
          }),
        ],
      }),

      // FLEET / TRADE VALUE BAND — gunmetal inverse band, static value cards.
      node('Section', {
        box: {
          name: 'Fleet value',
          surface: 'inverse',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          padding: 'xl',
        },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', {
            props: { level: 'h2', text: 'Built for the shop, not the spreadsheet.' },
          }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Open a fleet account and your team buys the way a parts counter actually works — your price, your terms, your reorder history.',
            },
          }),
          node('Grid', {
            box: { name: 'Capability grid', padding: 'none' },
            layout: { direction: 'grid', columns: 4, gap: 'md' },
            children: [
              valueCard(
                'Account pricing',
                'Per-account price lists and volume breaks apply automatically the second you sign in — no quoting back-and-forth.'
              ),
              valueCard(
                'Net terms & POs',
                'Pay on Net 15/30/60. Drop a PO number at checkout, routed to the right unit and cost center — invoice follows.'
              ),
              valueCard(
                'One-click reorder',
                'Saved lists, order history, and recurring replenishment — rebuild last month’s PM order in a single click.'
              ),
              valueCard(
                'Fleet management',
                'Track every unit by VIN, store fitment per truck, and split spend across drivers, bays, and locations.'
              ),
            ],
          }),
          node('Button', {
            props: { label: 'Open a fleet account', style: 'primary', href: '/fleet-accounts' },
            box: { align: 'start' },
          }),
        ],
      }),

      // BRANDS STRIP — static row of brand chips.
      node('Section', {
        box: { name: 'Brands', surface: 'subtle', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md', alignItems: 'center' },
        children: [
          node('Text', {
            props: {
              variant: 'meta',
              text: '120+ brands, stocked and ready — the names your techs already trust',
            },
          }),
          node('Grid', {
            box: { name: 'Brand chips', padding: 'none' },
            layout: { direction: 'grid', columns: 5, gap: 'sm' },
            children: [
              brandChip('Cummins'),
              brandChip('Bosch'),
              brandChip('Holset'),
              brandChip('Fleetguard'),
              brandChip('BD Diesel'),
              brandChip('Garrett'),
              brandChip('AirDog'),
              brandChip('FASS'),
              brandChip('Dorman HD'),
              brandChip('S&B Filters'),
            ],
          }),
        ],
      }),

      // SHOP TALK — CMS as a section; iterates posts.
      node('Section', {
        box: { name: 'Shop talk', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'Shop talk' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Maintenance guides, fitment tips, and field notes from techs who actually turn the wrenches.',
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
          node('Heading', { props: { level: 'h2', text: 'Open a fleet account in minutes.' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Net terms, your team’s pricing, and a dedicated parts specialist — set up today, ordering by tomorrow. No card required to apply.',
            },
          }),
          node('Button', {
            props: { label: 'Open a fleet account', style: 'primary', href: '/fleet-accounts' },
          }),
          node('Signup', { props: { cta: 'Get fleet pricing' }, bind: 'crm.list' }),
        ],
      }),
    ],
  });
}

function journalIndexTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Shop talk', padding: 'lg', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'Shop talk' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'Maintenance guides, fitment tips, and field notes from the parts counter.',
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

// A `cms.page` template (Fleet accounts, Support, …) — binds the page entry's fields.
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
        layout: { direction: 'row', justify: 'between', alignItems: 'center' },
        children: [
          node('Stack', {
            box: { padding: 'none' },
            layout: { direction: 'row', gap: 'sm', alignItems: 'center' },
            children: [
              node('Logo', { bind: 'site.identity' }),
              node('Heading', { props: { level: 'h3', text: 'Ironhaul Diesel & Fleet' } }),
            ],
          }),
          node('NavMenu', { props: { orientation: 'row' }, bind: 'site.primaryNav' }),
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
          node('NavMenu', { props: { orientation: 'row' }, bind: 'site.footerNav' }),
          node('SocialLinks', { bind: 'site.social' }),
          node('Text', { props: { variant: 'meta', text: '© Ironhaul Diesel & Fleet' } }),
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
      node('Heading', { props: { level: 'h1', text: 'Welcome to Ironhaul' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'Thanks for joining — set your vehicle once and every result filters to a part that actually fits. Here’s where to start.',
        },
      }),
      node('Button', { props: { label: 'Shop the catalog', href: '' }, box: { align: 'start' } }),
      node('Divider'),
      node('Text', {
        props: {
          variant: 'meta',
          text: 'Running a fleet? Open an account for your pricing, net terms, and one-click reorder.',
        },
      }),
    ],
  });
}

function dealsEmailTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'Parts deals & shop talk' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'This month’s fast-movers, fresh fitment tips, and a maintenance guide from the counter — everything to keep your trucks on the road.',
        },
      }),
      node('Button', {
        props: { label: 'See this month’s deals', href: '' },
        box: { align: 'start' },
      }),
      node('Divider'),
      node('Text', {
        props: {
          variant: 'meta',
          text: 'You’re receiving this because you subscribed at Ironhaul Diesel & Fleet.',
        },
      }),
    ],
  });
}

// ── The manifest ───────────────────────────────────────────────────────────────

const manifest = {
  key: 'auto-parts',
  version: '0.1.0',
  name: 'Auto & Truck Parts',
  summary:
    'A tough, utilitarian storefront for a diesel & fleet parts supplier — shop-by-system categories, a parts catalog with part numbers and fitment, B2B/fleet calls to action, and a shop-talk journal — themed and ready to review.',
  vertical: 'b2b',
  requiresModules: ['builder', 'commerce', 'cms', 'email'],

  brand: {
    businessName: 'Ironhaul Diesel & Fleet',
    tagline: 'Diesel & fleet supply.',
    colors: {
      primary: '#F4820B',
      primaryForeground: '#11161C',
      accent: '#1C2530',
      secondary: '#11161C',
    },
    fonts: { heading: 'Archivo', body: 'Inter' },
    logoLightAssetId: 'logo',
  },

  // The NEW theme the blueprint ships (docs/54 D5): a named SiteTheme over the
  // `fleet` preset, with a brand look that matches the identity colors above.
  theme: {
    name: 'Ironhaul',
    basePresetKey: 'fleet',
    presentation: { v: 2, containerWidth: '1200px' },
    brand: {
      colorPrimary: '#F4820B',
      colorPrimaryForeground: '#11161C',
      colorAccent: '#1C2530',
      fontHeading: 'Archivo',
      fontBody: 'Inter',
      tokens: { radiusBase: '6px' },
    },
    apply: true,
  },

  assets: [
    {
      id: 'logo',
      url: 'https://ui-avatars.com/api/?name=Ironhaul+Diesel&background=F4820B&color=11161C&bold=true&size=128&format=svg',
      alt: 'Ironhaul Diesel & Fleet',
    },
    // Shop-by-system heroes (reuse the mockup seeds).
    { id: 'cat-engine-hero', url: pic('ih-engine', 600, 360), alt: 'Engine & rebuild parts' },
    { id: 'cat-fuel-hero', url: pic('ih-fuel', 600, 360), alt: 'Fuel & injection parts' },
    { id: 'cat-brakes-hero', url: pic('ih-brakes', 600, 360), alt: 'Brakes & chassis parts' },
    { id: 'cat-filter-hero', url: pic('ih-filter', 600, 360), alt: 'Filtration' },
    { id: 'cat-elec-hero', url: pic('ih-elec', 600, 360), alt: 'Electrical & sensors' },
    { id: 'cat-drive-hero', url: pic('ih-drive', 600, 360), alt: 'Drivetrain & axle' },
    // Product images (reuse the mockup seeds where present).
    { id: 'injector-img', url: pic('ih-injector', 1000, 1000), alt: 'Common-rail fuel injector' },
    {
      id: 'fuelfilter-img',
      url: pic('ih-fuelfilter', 1000, 1000),
      alt: 'Fuel/water separator filter',
    },
    { id: 'turbo-img', url: pic('ih-turbo', 1000, 1000), alt: 'HE351VE turbocharger' },
    { id: 'glowplug-img', url: pic('ih-glowplug', 1000, 1000), alt: 'Glow plug set' },
    { id: 'rotor-img', url: pic('ih-rotor', 1000, 1000), alt: 'Heavy-duty brake rotor' },
    { id: 'oilfilter-img', url: pic('ih-oilfilter', 1000, 1000), alt: 'Heavy-duty oil filter' },
    // Shop-talk featured images (reuse the mockup seeds).
    {
      id: 'post-injector-img',
      url: pic('ih-art-injector'),
      alt: 'Injector replacement on a diesel engine',
    },
    { id: 'post-fitment-img', url: pic('ih-art-fitment'), alt: 'Reading a VIN for fitment' },
    { id: 'post-filter-img', url: pic('ih-art-filter'), alt: 'Fuel filter and CP4 pump' },
  ],

  // Lean on built-in content types (page, blog_post) — no custom types here.
  contentTypes: [],

  content: [
    {
      typeKey: 'blog_post',
      slug: 'cummins-injector-pm-walkthrough',
      body: {
        title: '6.7L Cummins injector replacement: a fleet PM walkthrough',
        excerpt:
          'Torque specs, return-line gotchas, and the OE part numbers that keep a wrong-part return off your dock.',
        body: doc(
          'A 6.7L Cummins injector job is forgiving until it isn’t. The difference between a one-hour swap and a back-on-the-rack callback is almost always the small stuff: clean fuel lines, the right return-line O-rings, and torque specs followed to the inch-pound.',
          'Pull the valve cover and high-pressure lines, then cap everything immediately — a single piece of debris in a common-rail injector is a fast way to ruin a fresh part. Replace the connector tubes and seals as a set; reusing them is a false economy on a fleet truck.',
          'Torque the hold-down clamps in two stages and program the new injector calibration (IQA) codes before the first start. Skipping the codes is the most common reason a "good" injector still runs rough.',
          'Keep the OE part numbers on the work order so the next PM cycle reorders the exact part — fitment notes per VIN are what stop a wrong-part return from ever reaching your dock.'
        ),
        featuredImage: assetRef('post-injector-img'),
      },
    },
    {
      typeKey: 'blog_post',
      slug: 'reading-a-vin-for-power-stroke-fitment',
      body: {
        title: 'Reading a VIN to nail Power Stroke fitment every time',
        excerpt:
          'The 8th and 10th digits decide which turbo, EGR cooler, and harness actually bolt up. Here’s the cheat sheet.',
        body: doc(
          'On a Power Stroke, "what year is it" is the wrong question — the VIN is the answer. The 8th digit identifies the engine, and the 10th encodes the model year. Get those two right and the turbo, EGR cooler, and harness all bolt up the first time.',
          'Early and late builds inside the same model year are the classic trap: a mid-year revision can change the EGR cooler casting or the injector harness connector. The VIN settles it where a year/make/model guess can’t.',
          'Make a habit of storing the full VIN against each unit in your account. Every reorder then filters to parts that fit that exact truck — no cross-referencing, no wrong-part returns.'
        ),
        featuredImage: assetRef('post-fitment-img'),
      },
    },
    {
      typeKey: 'blog_post',
      slug: 'fuel-filter-intervals-that-protect-a-cp4',
      body: {
        title: 'Fuel-filter intervals that actually protect a CP4 pump',
        excerpt:
          'Why the spec interval isn’t the safe interval for high-mileage fleet trucks — and what to stock ahead.',
        body: doc(
          'The CP4 high-pressure pump is unforgiving of dirty or water-laden fuel, and the factory filter interval is written for ideal conditions you don’t have. On a high-mileage fleet truck, treat the spec interval as a ceiling, not a target.',
          'Service the fuel/water separator on a tighter schedule than the manual suggests, drain water at every PM, and never run a marginal filter "one more cycle" to save a few dollars — a CP4 failure spreads metal through the entire fuel system.',
          'Stock filters ahead by VIN so the part is on the shelf before the truck is on the rack. A standing reorder list turns this from a scramble into a line item.'
        ),
        featuredImage: assetRef('post-filter-img'),
      },
    },
    {
      typeKey: 'page',
      slug: 'fleet-accounts',
      body: {
        title: 'Fleet & trade accounts',
        excerpt: 'Account pricing, net terms, POs, and one-click reorder — built for the shop.',
        body: doc(
          'A fleet account changes how your team buys parts. Your price list and volume breaks apply automatically the moment you sign in — no quoting, no back-and-forth, no "let me check with the counter."',
          'Pay the way your accounting team works: Net 15, 30, or 60. Drop a PO number at checkout and we route it to the right unit and cost center; the invoice follows on your terms.',
          'Reordering is one click. Saved lists, full order history, and recurring replenishment let you rebuild last month’s PM order in seconds — and store fitment per VIN so every reorder lands the exact part that fits each truck.',
          'Apply online or call a parts specialist; most accounts are set up the same day. No card is required to apply.'
        ),
      },
    },
    {
      typeKey: 'page',
      slug: 'support',
      body: {
        title: 'Support & contact',
        excerpt: 'Fitment help, order tracking, warranty, and a parts counter that picks up.',
        body: doc(
          'Not sure a part fits? Send us the VIN and the part number and a specialist will confirm fitment before you order — that’s the whole point.',
          'Call the counter at 1-800-IRONHAUL, Mon–Fri 6am–6pm PT and Sat 7am–2pm, or email support@ironhaul.example and we’ll get back within a business day.',
          'For order tracking, warranty claims, and returns, sign in to your account to see status and start a return — or reply to your order confirmation and we’ll take it from there.'
        ),
      },
    },
  ],

  commerce: {
    categories: [
      {
        handle: 'engine',
        name: 'Engine',
        position: 0,
        featured: true,
        heroAssetId: 'cat-engine-hero',
      },
      {
        handle: 'fuel-injection',
        name: 'Fuel & Injection',
        position: 1,
        featured: true,
        heroAssetId: 'cat-fuel-hero',
      },
      { handle: 'brakes', name: 'Brakes', position: 2, heroAssetId: 'cat-brakes-hero' },
      { handle: 'filtration', name: 'Filtration', position: 3, heroAssetId: 'cat-filter-hero' },
      { handle: 'electrical', name: 'Electrical', position: 4, heroAssetId: 'cat-elec-hero' },
      { handle: 'drivetrain', name: 'Drivetrain', position: 5, heroAssetId: 'cat-drive-hero' },
    ],
    collections: [
      {
        handle: 'featured',
        name: 'Featured parts',
        type: 'manual',
        featured: true,
        productHandles: [
          'common-rail-injector',
          'fuel-water-separator',
          'he351ve-turbocharger',
          'glow-plug-set',
        ],
      },
    ],
    products: [
      {
        handle: 'common-rail-injector',
        title: 'Common-Rail Fuel Injector',
        description:
          '<p>OE-spec common-rail fuel injector for the 6.7L Cummins. Flow-matched and IQA-coded for a smooth idle and clean burn.</p><p><strong>Fitment:</strong> 2007.5–2018 RAM 2500/3500 · 6.7L Cummins.</p><p><strong>Specs:</strong> Bosch common-rail · sold each · IQA calibration code on box.</p>',
        productType: 'Fuel & Injection',
        vendor: 'Bosch',
        tags: ['cummins', '6.7l', 'injector', 'fits-2007.5-2018', 'ram-2500-3500'],
        categoryHandles: ['fuel-injection'],
        collectionHandles: ['featured'],
        variants: [
          {
            sku: 'INJ-0445120238',
            priceCents: 31200,
            compareAtPriceCents: 36800,
            isDefault: true,
            position: 0,
          },
        ],
        images: [{ assetId: 'injector-img', isPrimary: true, position: 0 }],
      },
      {
        handle: 'fuel-water-separator',
        title: 'Fuel/Water Separator Kit',
        description:
          '<p>Genuine fuel/water separator element that protects the CP4 high-pressure pump from water and debris.</p><p><strong>Fitment:</strong> 2013–2018 RAM 2500/3500 · 6.7L Cummins.</p><p><strong>Specs:</strong> Fleetguard · includes O-rings · service on a tightened fleet interval.</p>',
        productType: 'Filtration',
        vendor: 'Fleetguard',
        tags: ['cummins', '6.7l', 'fuel-filter', 'cp4', 'fits-2013-2018', 'filtration'],
        categoryHandles: ['filtration'],
        collectionHandles: ['featured'],
        variants: [
          {
            sku: 'FS43255',
            priceCents: 4850,
            compareAtPriceCents: 5900,
            isDefault: true,
            position: 0,
          },
        ],
        images: [{ assetId: 'fuelfilter-img', isPrimary: true, position: 0 }],
      },
      {
        handle: 'he351ve-turbocharger',
        title: 'HE351VE Turbocharger',
        description:
          '<p>Reman Holset HE351VE variable-geometry turbocharger with integrated actuator. Stocked in all six warehouses.</p><p><strong>Fitment:</strong> 2007.5–2012 RAM 2500/3500 · 6.7L Cummins.</p><p><strong>Specs:</strong> Holset/Cummins · VGT · core charge applies.</p>',
        productType: 'Engine',
        vendor: 'Holset',
        tags: ['cummins', '6.7l', 'turbo', 'vgt', 'fits-2007.5-2012', 'engine'],
        categoryHandles: ['engine'],
        collectionHandles: ['featured'],
        variants: [{ sku: 'TRB-3796619RX', priceCents: 118900, isDefault: true, position: 0 }],
        images: [{ assetId: 'turbo-img', isPrimary: true, position: 0 }],
      },
      {
        handle: 'glow-plug-set',
        title: 'Glow Plug Set (8-pack)',
        description:
          '<p>Complete set of eight OE-replacement glow plugs for cold-weather starts on the 6.0L Power Stroke.</p><p><strong>Fitment:</strong> 2003–2007 Ford F-250/F-350 · 6.0L Power Stroke.</p><p><strong>Specs:</strong> Motorcraft-equivalent · set of 8 · pre-gapped.</p>',
        productType: 'Electrical',
        vendor: 'Dorman HD Solutions',
        tags: [
          'power-stroke',
          '6.0l',
          'glow-plug',
          'fits-2003-2007',
          'ford-f250-f350',
          'electrical',
        ],
        categoryHandles: ['electrical'],
        collectionHandles: ['featured'],
        variants: [{ sku: 'GLW-904-5500', priceCents: 8900, isDefault: true, position: 0 }],
        images: [{ assetId: 'glowplug-img', isPrimary: true, position: 0 }],
      },
      {
        handle: 'hd-brake-rotor',
        title: 'Heavy-Duty Brake Rotor',
        description:
          '<p>Vented heavy-duty brake rotor for severe-duty fleet braking. Choose front or rear position to fit your axle.</p><p><strong>Fitment:</strong> 2011–2019 GMC/Chevrolet 2500HD/3500HD · 6.6L Duramax.</p><p><strong>Specs:</strong> G3000 cast iron · vented · sold each · position-specific.</p>',
        productType: 'Brakes',
        vendor: 'BD Diesel',
        tags: [
          'duramax',
          '6.6l',
          'brake-rotor',
          'fits-2011-2019',
          'gmc-chevrolet-2500-3500',
          'brakes',
        ],
        categoryHandles: ['brakes'],
        options: [
          {
            name: 'Position',
            displayType: 'segmented',
            position: 0,
            values: [
              { value: 'Front', position: 0 },
              { value: 'Rear', position: 1 },
            ],
          },
        ],
        variants: [
          {
            sku: 'ROT-DMX-FRT',
            optionValues: { Position: 'Front' },
            priceCents: 12400,
            isDefault: true,
            position: 0,
          },
          {
            sku: 'ROT-DMX-RR',
            optionValues: { Position: 'Rear' },
            priceCents: 11800,
            position: 1,
          },
        ],
        images: [{ assetId: 'rotor-img', isPrimary: true, position: 0 }],
      },
      {
        handle: 'hd-oil-filter',
        title: 'Heavy-Duty Oil Filter',
        description:
          '<p>High-capacity heavy-duty oil filter for extended fleet drain intervals.</p><p><strong>Fitment:</strong> 2007.5–2018 RAM 2500/3500 · 6.7L Cummins.</p><p><strong>Specs:</strong> Fleetguard · full-flow · stock by VIN for PM cycles.</p>',
        productType: 'Filtration',
        vendor: 'Fleetguard',
        tags: ['cummins', '6.7l', 'oil-filter', 'fits-2007.5-2018', 'filtration', 'pm'],
        categoryHandles: ['filtration'],
        variants: [{ sku: 'LF-16035', priceCents: 1650, isDefault: true, position: 0 }],
        images: [{ assetId: 'oilfilter-img', isPrimary: true, position: 0 }],
      },
    ],
  },

  components: [],

  layout: { name: 'Ironhaul layout', tree: siteLayoutTree(), makeActive: true },

  pages: [
    { name: 'Home', kind: 'singleton', tree: homeTree(), seoTitle: 'Ironhaul Diesel & Fleet' },
    { name: 'Shop talk', kind: 'singleton', slug: 'journal', tree: journalIndexTree() },
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
      subject: 'Welcome to Ironhaul',
      preheader: 'Set your vehicle once — every part filters to fit.',
      tree: welcomeEmailTree(),
    },
    {
      name: 'Parts deals & shop talk',
      subject: 'Parts deals & shop talk',
      preheader: 'This month’s fast-movers, fitment tips, and a guide from the counter.',
      tree: dealsEmailTree(),
    },
  ],
};

/** The diesel & fleet parts blueprint, parsed + integrity-checked at module load
 *  so an invalid edit fails fast (and `defaults` are applied). */
export const autoParts: Blueprint = parseBlueprint(manifest);
