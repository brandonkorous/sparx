import type { SparxModule } from '@sparx/ui';

// Real partner-enablement content (docs/114 §B.7/D7), authored as data-as-code so
// the pitch, one-pager, and per-module guide pages render genuine, Sparx-accurate
// material — NOT links to the public marketing site. Kept terminology-correct: a
// tenant builds a SITE (content and/or commerce, not a "storefront"), pays only
// for the modules they switch on, and starts on a 14-day free trial. Update this
// one file to update every resource page.

export interface PitchSection {
  heading: string;
  body: string;
  points?: string[];
}

// The pitch a partner walks a client through — the honest story of Sparx.
export const PITCH_SECTIONS: PitchSection[] = [
  {
    heading: 'One platform instead of five tools',
    body: 'Most businesses stitch together a site builder, a CRM, an email tool, an invoicing app, and a pile of integrations — then pay for and maintain all of them. Sparx is a single platform where those live together and actually talk to each other. Content and commerce, customers and campaigns, one login and one bill.',
  },
  {
    heading: 'You only pay for what you switch on',
    body: 'Sparx is modular. A publisher can run CMS-only, a services team CRM-only, a shop the full commerce stack — each is first-class. Modules activate independently, and a client pays for exactly the ones they use. Nothing is bundled they didn’t ask for.',
    points: [
      'Site Builder — pages, content, and design, live fast',
      'Commerce — catalog, checkout, and payments',
      'CMS — pages, posts, and structured content',
      'CRM — customers, pipelines, and segments',
      'Email — broadcasts, flows, and deliverability on their own domain',
      'B2B, invoicing, inventory, scheduling, chat, and AI as they grow',
    ],
  },
  {
    heading: 'Live in minutes, not months',
    body: 'A client picks the modules they need, starts from a complete themed template, and has a real site with real content in under an hour — then refines from there. No developer required to get to launch.',
  },
  {
    heading: 'It grows with them',
    body: 'When a content site starts selling, they switch on Commerce. When they land wholesale accounts, they switch on B2B. Nothing to migrate, no replatforming — the data and the customers are already there.',
  },
  {
    heading: 'Getting started costs nothing',
    body: 'Every Sparx account starts with a 14-day free trial — enough to build the whole thing and see it work before paying anything. After the trial it’s a paid subscription, priced only on the modules they keep switched on.',
  },
];

export interface OnePager {
  tagline: string;
  what: string;
  modules: string[];
  pricing: string;
  bestFor: string[];
}

export const ONE_PAGER: OnePager = {
  tagline: 'The modular platform for content and commerce — one login, one bill.',
  what: 'Sparx replaces a business’s site builder, CRM, email tool, and more with a single platform whose parts share the same customers, content, and data. Turn on only what you need; add the rest as you grow.',
  modules: [
    'Site Builder — a real site, live in minutes',
    'Commerce — sell products, take payments, fulfil orders',
    'CMS — pages, posts, and structured content',
    'CRM — one view of every customer and deal',
    'Email — campaigns and automated flows on your own domain',
    'B2B — wholesale accounts, price lists, and fleet',
    'Plus invoicing, inventory, scheduling, chat, and AI',
  ],
  pricing:
    'Starts with a 14-day free trial. After that, a subscription priced only on the modules you switch on — no bundles you don’t use.',
  bestFor: [
    'Owners tired of paying for and wiring up five separate tools',
    'Content sites that are starting to sell',
    'Service businesses that need a site + CRM + email in one place',
    'Wholesalers who need B2B and a public site together',
  ],
};

export interface ModuleGuide {
  module: SparxModule;
  label: string;
  blurb: string;
  steps: string[];
}

// Concise, real "get this module live for a client" playbooks — what a partner
// actually does, in order. Each module's guide wears its own hue on the resource
// page via a nested ModuleProvider (legit cross-module wayfinding).
export const MODULE_GUIDES: ModuleGuide[] = [
  {
    module: 'builder',
    label: 'Site Builder',
    blurb: 'Stand up the client’s site — pages, layout, and brand.',
    steps: [
      'Start from a template that fits the client’s industry, or a blank canvas.',
      'Set the brand: logo, colours, and fonts in the theme — every page inherits them.',
      'Build the core pages (home, about, contact) from the component palette.',
      'Point their domain at the site in Settings → Domains, then publish.',
    ],
  },
  {
    module: 'commerce',
    label: 'Commerce',
    blurb: 'Turn the site into a store — catalog, checkout, payments.',
    steps: [
      'Switch on Commerce and connect the client’s Stripe account for payments.',
      'Add products (or import a catalog) with images, variants, and prices.',
      'Set up shipping zones and tax, then place a test order end-to-end.',
      'Drop product and cart components onto the site and publish.',
    ],
  },
  {
    module: 'cms',
    label: 'CMS',
    blurb: 'Give them a real content engine — pages and posts.',
    steps: [
      'Switch on CMS and define the content types they need (posts, guides, FAQs).',
      'Create a few starter entries so the layout has real content to show.',
      'Add a blog/index component to the site and link it in the nav.',
      'Hand off the editor — it’s explicit-save, last-write-wins, like every editor.',
    ],
  },
  {
    module: 'crm',
    label: 'CRM',
    blurb: 'One view of every customer, lead, and deal.',
    steps: [
      'Switch on CRM — site forms and orders start creating customer records automatically.',
      'Set up the pipeline stages that match how the client actually sells.',
      'Import existing contacts and tag them into segments.',
      'Show the client the timeline: every order, email, and note on one customer.',
    ],
  },
  {
    module: 'email',
    label: 'Email',
    blurb: 'Campaigns and flows that send from their own domain.',
    steps: [
      'Switch on Email and verify the client’s sending domain (DNS records).',
      'Build a welcome flow triggered when a customer is created in CRM.',
      'Design a first broadcast from the atomic email components.',
      'Confirm deliverability with a test send before going live.',
    ],
  },
  {
    module: 'b2b',
    label: 'B2B',
    blurb: 'Wholesale accounts, price lists, and a buyer portal.',
    steps: [
      'Switch on B2B (Commerce comes with it) and create the wholesale accounts.',
      'Set per-account price lists and payment terms.',
      'Invite the buyers to the account portal.',
      'Test a wholesale order at account-specific pricing.',
    ],
  },
];
