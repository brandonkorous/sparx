// The Sparx first-party DATA components (docs/85 dogfood). Each is a composed,
// reusable builder block — a node tree + an optional `propSpec` of fields the
// installer fills in. PURE DATA: the marketplace "Add" clones the tree into the
// tenant's own component library (componentService.create); the storefront only
// ever sees primitives after publish-expand. Trees bind to tokens so a block
// re-themes to whatever site adds it.
//
// Seed-side authoring source for Phase 1; the same shape is what the Phase-2
// submission pipeline compiles an uploaded `component.tsx` down to.

import { seedNode, type BuilderNode } from '@sparx/builder-schemas';

let nid = 0;
const node = (type: string, opts: Parameters<typeof seedNode>[2] = {}): BuilderNode =>
  seedNode(`mc-${(nid += 1)}`, type, opts);

const pic = (seed: string, w = 1200, h = 900): string =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;

export interface DataComponentRow {
  slug: string;
  name: string;
  group: 'layout' | 'content' | 'data';
  kind: string;
  surfaces: string[];
  tagline: string;
  description: string;
  sortWeight: number;
  tree: BuilderNode;
  propSpec: { key: string; label: string; kind: string; default?: string }[];
}

// ── Block trees ────────────────────────────────────────────────────────────

const heroSplit = (): BuilderNode =>
  node('Section', {
    box: { name: 'Hero split', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'row', gap: 'lg', alignItems: 'center' },
    children: [
      node('Stack', {
        box: { padding: 'none' },
        layout: { direction: 'stack', gap: 'md', alignItems: 'start' },
        children: [
          node('Heading', { props: { level: 'h1', text: { $prop: 'heading' } } }),
          node('Text', { props: { variant: 'body', text: { $prop: 'subheading' } } }),
          node('Button', {
            props: { label: { $prop: 'buttonLabel' }, href: { $prop: 'buttonHref' }, style: 'primary' },
          }),
        ],
      }),
      node('Image', {
        box: { name: 'Hero image', backgroundImage: pic('hero-split', 1200, 1000), height: 'md' },
      }),
    ],
  });

const centeredHero = (): BuilderNode =>
  node('Section', {
    box: {
      name: 'Centered hero',
      height: 'lg',
      backgroundWidth: 'full',
      contentWidth: 'contained',
      align: 'center',
      padding: 'xl',
      backgroundImage: pic('centered-hero', 2000, 1100),
      overlay: 'dark',
      textTone: 'light',
    },
    layout: { direction: 'stack', gap: 'md', justify: 'center', alignItems: 'center' },
    children: [
      node('Heading', { box: { align: 'center' }, props: { level: 'h1', text: { $prop: 'heading' } } }),
      node('Text', {
        box: { align: 'center' },
        props: { variant: 'body', text: { $prop: 'subheading' } },
      }),
      node('Button', {
        props: { label: { $prop: 'buttonLabel' }, href: { $prop: 'buttonHref' }, style: 'primary' },
      }),
    ],
  });

const planCard = (name: string, price: string, blurb: string): BuilderNode =>
  node('Card', {
    box: { name: `${name} plan`, surface: 'subtle', padding: 'lg' },
    layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
    children: [
      node('Heading', { props: { level: 'h3', text: name } }),
      node('Heading', { props: { level: 'h2', text: price } }),
      node('Text', { props: { variant: 'body', text: blurb } }),
      node('Button', { props: { label: 'Choose plan', style: 'soft', href: '#' } }),
    ],
  });

const pricingTable = (): BuilderNode =>
  node('Section', {
    box: { name: 'Pricing', padding: 'xl', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'lg', alignItems: 'center' },
    children: [
      node('Heading', { box: { align: 'center' }, props: { level: 'h2', text: 'Simple, fair pricing' } }),
      node('Grid', {
        box: { name: 'Plans', padding: 'none' },
        layout: { direction: 'grid', columns: 3, gap: 'lg' },
        children: [
          planCard('Starter', '$0', 'Everything you need to get going.'),
          planCard('Pro', '$19', 'For growing teams that need more.'),
          planCard('Scale', '$49', 'Advanced controls and support.'),
        ],
      }),
    ],
  });

const testimonialBand = (): BuilderNode =>
  node('Section', {
    box: {
      name: 'Testimonial',
      surface: 'subtle',
      padding: 'xl',
      contentWidth: 'contained',
      align: 'center',
    },
    layout: { direction: 'stack', gap: 'md', alignItems: 'center', justify: 'center' },
    children: [
      node('Heading', { box: { align: 'center' }, props: { level: 'h2', text: { $prop: 'quote' } } }),
      node('Text', { box: { align: 'center' }, props: { variant: 'meta', text: { $prop: 'author' } } }),
    ],
  });

const logoCloud = (): BuilderNode =>
  node('Section', {
    box: { name: 'Logo cloud', padding: 'lg', contentWidth: 'contained', align: 'center' },
    layout: { direction: 'stack', gap: 'md', alignItems: 'center' },
    children: [
      node('Text', { box: { align: 'center' }, props: { variant: 'meta', text: 'Trusted by teams everywhere' } }),
      node('Grid', {
        box: { name: 'Logos', padding: 'none' },
        layout: { direction: 'grid', columns: 5, gap: 'lg', alignItems: 'center' },
        children: [1, 2, 3, 4, 5].map((i) =>
          node('Image', {
            box: { name: `Logo ${i}`, backgroundImage: pic(`logo-${i}`, 240, 120), height: 'sm' },
          })
        ),
      }),
    ],
  });

const personCard = (seed: string): BuilderNode =>
  node('Card', {
    box: { name: 'Person', surface: 'none', padding: 'sm' },
    layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
    children: [
      node('Image', { box: { backgroundImage: pic(seed, 600, 600), height: 'md' } }),
      node('Heading', { props: { level: 'h3', text: 'Team member' } }),
      node('Text', { props: { variant: 'meta', text: 'Role / title' } }),
    ],
  });

const teamGrid = (): BuilderNode =>
  node('Section', {
    box: { name: 'Team', padding: 'xl', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'lg' },
    children: [
      node('Heading', { props: { level: 'h2', text: 'Meet the team' } }),
      node('Grid', {
        box: { name: 'People', padding: 'none' },
        layout: { direction: 'grid', columns: 4, gap: 'lg' },
        children: ['team-a', 'team-b', 'team-c', 'team-d'].map((s) => personCard(s)),
      }),
    ],
  });

const statsStrip = (): BuilderNode =>
  node('Section', {
    box: { name: 'Stats', surface: 'inverse', padding: 'xl', contentWidth: 'contained' },
    layout: { direction: 'grid', columns: 4, gap: 'lg' },
    children: [
      node('Stat', { props: { value: '10k+', label: 'Customers' } }),
      node('Stat', { props: { value: '99.9%', label: 'Uptime' } }),
      node('Stat', { props: { value: '4.9/5', label: 'Rating' } }),
      node('Stat', { props: { value: '24/7', label: 'Support' } }),
    ],
  });

const featureSplit = (): BuilderNode =>
  node('Section', {
    box: { name: 'Feature split', padding: 'xl', contentWidth: 'contained' },
    layout: { direction: 'row', gap: 'lg', alignItems: 'center' },
    children: [
      node('Image', {
        box: { name: 'Feature image', backgroundImage: pic('feature-split', 1000, 800), height: 'md' },
      }),
      node('Stack', {
        box: { padding: 'none' },
        layout: { direction: 'stack', gap: 'md', alignItems: 'start' },
        children: [
          node('Heading', { props: { level: 'h2', text: { $prop: 'heading' } } }),
          node('Text', { props: { variant: 'body', text: { $prop: 'body' } } }),
          node('Button', {
            props: { label: { $prop: 'buttonLabel' }, href: { $prop: 'buttonHref' }, style: 'soft' },
          }),
        ],
      }),
    ],
  });

const ctaBanner = (): BuilderNode =>
  node('Section', {
    box: {
      name: 'CTA banner',
      surface: 'inverse',
      backgroundWidth: 'full',
      contentWidth: 'contained',
      align: 'center',
      padding: 'xl',
    },
    layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'center' },
    children: [
      node('Heading', { box: { align: 'center' }, props: { level: 'h2', text: { $prop: 'heading' } } }),
      node('Text', { box: { align: 'center' }, props: { variant: 'body', text: { $prop: 'body' } } }),
      node('Button', {
        props: { label: { $prop: 'buttonLabel' }, href: { $prop: 'buttonHref' }, style: 'primary' },
      }),
    ],
  });

const newsletterBand = (): BuilderNode =>
  node('Section', {
    box: {
      name: 'Newsletter',
      surface: 'subtle',
      backgroundWidth: 'full',
      contentWidth: 'contained',
      align: 'center',
      padding: 'xl',
    },
    layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'center' },
    bind: 'crm.list',
    children: [
      node('Heading', { box: { align: 'center' }, props: { level: 'h2', text: { $prop: 'heading' } } }),
      node('Text', { box: { align: 'center' }, props: { variant: 'body', text: { $prop: 'body' } } }),
      node('Signup', { props: { cta: 'Subscribe' }, bind: 'crm.list' }),
    ],
  });

// ── The catalog rows ────────────────────────────────────────────────────────

export const SPARX_DATA_COMPONENTS: DataComponentRow[] = [
  {
    slug: 'hero-split',
    name: 'Hero Split',
    group: 'content',
    kind: 'Section',
    surfaces: ['page'],
    tagline: 'A two-column hero — copy and a call-to-action beside a bold image.',
    description:
      'A classic split hero: headline, supporting text, and a button on one side, a full-height image on the other. Collapses to one column on phones.',
    sortWeight: 60,
    tree: heroSplit(),
    propSpec: [
      { key: 'heading', label: 'Heading', kind: 'text', default: 'Build something people love' },
      { key: 'subheading', label: 'Subheading', kind: 'text', default: 'A short, punchy sentence about the value you deliver.' },
      { key: 'buttonLabel', label: 'Button label', kind: 'text', default: 'Get started' },
      { key: 'buttonHref', label: 'Button link', kind: 'url', default: '/signup' },
    ],
  },
  {
    slug: 'centered-hero',
    name: 'Centered Hero',
    group: 'content',
    kind: 'Section',
    surfaces: ['page', 'site'],
    tagline: 'A full-bleed image hero with centered headline and CTA.',
    description:
      'A bold, full-width hero over a darkened background image, with a centered headline, subhead, and button. Great for landing pages.',
    sortWeight: 58,
    tree: centeredHero(),
    propSpec: [
      { key: 'heading', label: 'Heading', kind: 'text', default: 'Make a strong first impression' },
      { key: 'subheading', label: 'Subheading', kind: 'text', default: 'One clear line about what you do.' },
      { key: 'buttonLabel', label: 'Button label', kind: 'text', default: 'Explore' },
      { key: 'buttonHref', label: 'Button link', kind: 'url', default: '/' },
    ],
  },
  {
    slug: 'pricing-table',
    name: 'Pricing Table',
    group: 'content',
    kind: 'Block',
    surfaces: ['page'],
    tagline: 'A three-tier pricing grid of plan cards.',
    description:
      'Three plan cards — name, price, blurb, and a button — in a responsive grid. Edit the copy inline after adding it.',
    sortWeight: 54,
    tree: pricingTable(),
    propSpec: [],
  },
  {
    slug: 'testimonial-band',
    name: 'Testimonial Band',
    group: 'content',
    kind: 'Block',
    surfaces: ['page'],
    tagline: 'A centered customer quote with attribution.',
    description: 'A quiet, centered band for a single strong testimonial — the quote plus who said it.',
    sortWeight: 50,
    tree: testimonialBand(),
    propSpec: [
      { key: 'quote', label: 'Quote', kind: 'text', default: '“This changed how our whole team works.”' },
      { key: 'author', label: 'Attribution', kind: 'text', default: 'Alex Rivera, Founder at Acme' },
    ],
  },
  {
    slug: 'logo-cloud',
    name: 'Logo Cloud',
    group: 'content',
    kind: 'Block',
    surfaces: ['page', 'site'],
    tagline: 'A row of partner or customer logos.',
    description: 'A simple proof strip — a caption above a responsive row of logos. Swap in your own marks.',
    sortWeight: 44,
    tree: logoCloud(),
    propSpec: [],
  },
  {
    slug: 'team-grid',
    name: 'Team Grid',
    group: 'content',
    kind: 'Block',
    surfaces: ['page'],
    tagline: 'A grid of people — photo, name, and role.',
    description: 'Introduce the team with a responsive grid of headshot cards. Collapses gracefully on mobile.',
    sortWeight: 42,
    tree: teamGrid(),
    propSpec: [],
  },
  {
    slug: 'stats-strip',
    name: 'Stats Strip',
    group: 'content',
    kind: 'Block',
    surfaces: ['page'],
    tagline: 'A row of big proof numbers.',
    description: 'Four bold metrics in a row on an inverse band — an at-a-glance proof strip.',
    sortWeight: 46,
    tree: statsStrip(),
    propSpec: [],
  },
  {
    slug: 'feature-split',
    name: 'Feature Split',
    group: 'content',
    kind: 'Section',
    surfaces: ['page'],
    tagline: 'An image beside a feature headline, body, and link.',
    description: 'A media-and-text feature row — image on one side, a headline, paragraph, and button on the other.',
    sortWeight: 52,
    tree: featureSplit(),
    propSpec: [
      { key: 'heading', label: 'Heading', kind: 'text', default: 'A feature worth shouting about' },
      { key: 'body', label: 'Body', kind: 'text', default: 'Explain the benefit in a sentence or two.' },
      { key: 'buttonLabel', label: 'Button label', kind: 'text', default: 'Learn more' },
      { key: 'buttonHref', label: 'Button link', kind: 'url', default: '/features' },
    ],
  },
  {
    slug: 'cta-banner',
    name: 'CTA Banner',
    group: 'content',
    kind: 'Section',
    surfaces: ['page', 'site'],
    tagline: 'A full-width call-to-action — heading, body, and a button.',
    description: 'A bold closing band to drive one action. Fill in the heading, body, and button.',
    sortWeight: 56,
    tree: ctaBanner(),
    propSpec: [
      { key: 'heading', label: 'Heading', kind: 'text', default: 'Ready to get started?' },
      { key: 'body', label: 'Body', kind: 'text', default: 'Join thousands already on board.' },
      { key: 'buttonLabel', label: 'Button label', kind: 'text', default: 'Get started' },
      { key: 'buttonHref', label: 'Button link', kind: 'url', default: '/signup' },
    ],
  },
  {
    slug: 'newsletter-band',
    name: 'Newsletter Band',
    group: 'data',
    kind: 'Block',
    surfaces: ['page', 'site'],
    tagline: 'An email-capture band wired to your CRM.',
    description: 'A centered subscribe band — heading, a line of copy, and a Signup form that drops subscribers straight into your CRM.',
    sortWeight: 48,
    tree: newsletterBand(),
    propSpec: [
      { key: 'heading', label: 'Heading', kind: 'text', default: 'Join the list' },
      { key: 'body', label: 'Body', kind: 'text', default: 'Occasional updates, no spam.' },
    ],
  },
];
