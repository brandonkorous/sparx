// Content for the /pricing/v1 experiment page. This is a straight port of the
// facts/numbers/copy from the production pricing-page.tsx — the redesign changes
// the visual layer only, never the data. Editorial data-as-code: exempt from the
// file/function size rule. Module dot colors reuse MODULE_HEX (modules-catalog)
// so a module's hue never drifts between the switchboard, the ledger, and the
// feature table.

import type { LucideIcon } from 'lucide-react';
import {
  Code2,
  Download,
  Globe,
  LayoutGrid,
  Lock,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react';

/** The platform floor every plan ships with, regardless of modules. */
export const INCLUDED: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Globe,
    title: 'Hosting + global CDN',
    body: 'Edge-cached pages, fast TTFB worldwide. No separate hosting bill.',
  },
  {
    icon: Lock,
    title: 'SSL + custom domains',
    body: 'Bring your domain; certificates issue and renew automatically.',
  },
  {
    icon: LayoutGrid,
    title: 'The unified dashboard',
    body: 'One admin for every module you turn on — no extra logins.',
  },
  {
    icon: Code2,
    title: 'REST + GraphQL API',
    body: 'Every feature is an endpoint first. Build anything on the same API.',
  },
  {
    icon: ShieldCheck,
    title: 'Multi-tenant security',
    body: 'Row-level isolation in the database — your data is fenced off by default.',
  },
  {
    icon: Users,
    title: 'Unlimited team members',
    body: 'Invite the whole team. No per-seat pricing, ever.',
  },
  {
    icon: RefreshCw,
    title: 'Automatic updates',
    body: 'New features and fixes ship to your tenant — no upgrades to run.',
  },
  {
    icon: Download,
    title: 'Export anytime',
    body: 'Your data is yours. Full export, no lock-in, leave whenever you want.',
  },
];

/** Three headline savings figures. */
export const STATS: { value: string; suffix?: string; label: string }[] = [
  {
    value: '$41,000',
    suffix: '+/yr',
    label:
      'Kept by running all twelve capabilities as sparx instead of twelve separate subscriptions.',
  },
  {
    value: '12 → 1',
    label:
      'Twelve logins, renewal dates, and support queues collapse into a single monthly invoice.',
  },
  {
    value: '0%',
    label:
      'Extra on every sale — versus the 0.6–2% surcharge hosted stores add to use your own processor.',
  },
];

/** The savings ledger — each module vs. the published 2026 price of the tool it
 *  replaces. Figures match the switchboard's ELSEWHERE_MONTHLY so the two never
 *  disagree. */
export const LEDGER: { key: string; name: string; price: string; alt: string; amt: string }[] = [
  { key: 'builder', name: 'Builder', price: '$10', alt: 'Webflow — Premium site plan', amt: '$39' },
  { key: 'commerce', name: 'Commerce', price: '$49', alt: 'Shopify — Advanced', amt: '$399' },
  { key: 'cms', name: 'CMS', price: '$49', alt: 'Storyblok — Growth (headless CMS)', amt: '$99' },
  { key: 'crm', name: 'CRM', price: '$49', alt: 'HubSpot — Sales Pro, 3 seats', amt: '$300' },
  {
    key: 'email',
    name: 'Email',
    price: '$29',
    alt: 'Klaviyo + a transactional email service',
    amt: '$165',
  },
  {
    key: 'b2b',
    name: 'B2B · Fleet',
    price: '$99',
    alt: 'Shopify Plus — native B2B',
    amt: '$2,400',
  },
  {
    key: 'ai',
    name: 'AI',
    price: '$49',
    alt: 'Zapier Team + custom integration work',
    amt: '$103',
  },
  { key: 'dropship', name: 'Dropship', price: '$29', alt: 'Spocket — Pro', amt: '$60' },
  { key: 'scheduling', name: 'Scheduling', price: '$29', alt: 'Acuity — Powerhouse', amt: '$61' },
  { key: 'invoicing', name: 'Invoicing', price: '$19', alt: 'FreshBooks — Plus', amt: '$33' },
  {
    key: 'inventory',
    name: 'Inventory',
    price: '$29',
    alt: 'Zoho Inventory — Professional',
    amt: '$99',
  },
  { key: 'chat', name: 'Live Chat', price: '$19', alt: 'Intercom — live chat', amt: '$74' },
];

/** Two worked scenarios: separate-tools total vs. the sparx total, plus savings. */
export const SCENARIOS: {
  title: string;
  sub: string;
  separate: string;
  sparx: string;
  save: string;
  featured?: boolean;
}[] = [
  {
    title: 'A growing site',
    sub: 'Builder · Commerce · CMS · CRM · Email',
    separate: '$1,002/mo',
    sparx: '$186/mo',
    save: 'You keep $816/mo — about $9,800 a year',
  },
  {
    title: 'The full platform',
    sub: 'All twelve modules — Invoicing & Inventory included free',
    separate: '$3,832/mo',
    sparx: '$411/mo',
    save: 'You keep $3,421/mo — about $41,000 a year',
    featured: true,
  },
];

export const LEDGER_FOOTNOTE =
  'Comparison uses publicly listed 2026 monthly prices for representative growth-tier plans of the tools each module replaces — Webflow Premium, Shopify Advanced and Plus, a headless CMS, HubSpot Sales Professional, Klaviyo, a dropshipping app, FreshBooks, an inventory app, Intercom, and Zapier for the glue between them. Those prices scale up with seats, contacts, and usage, so a real-world stack usually costs more. Invoicing and Inventory come free with Commerce or B2B, so they add $0 to the full-platform total. sparx is flat — the module price is the price.';

/** Every module, its price, what it replaces, and the full feature list. */
export const FEATURES: {
  key: string;
  name: string;
  price: string;
  repl: string;
  feats: string[];
}[] = [
  {
    key: 'builder',
    name: 'Builder',
    price: '$10/mo',
    repl: 'Replaces a website builder like Webflow',
    feats: [
      'Theme-first editor, block editing',
      'Custom domain + automatic SSL',
      'Global edge CDN, stale-while-revalidate',
      'Draft → preview → publish',
      'Reusable components & sections',
      'Headless SDK — Next, Remix, Astro',
    ],
  },
  {
    key: 'commerce',
    name: 'Commerce',
    price: '+ $49/mo',
    repl: 'Replaces Shopify + checkout, tax & shipping apps',
    feats: [
      'Products, variants & bundles',
      'Real-time inventory',
      'One-tap checkout (Apple Pay)',
      'Stripe, PayPal, Klarna, Affirm',
      'Tax — Avalara / TaxJar',
      'Shipping — Shippo / EasyPost',
      'Discounts & gift cards',
      'Orders, refunds, fulfillment',
    ],
  },
  {
    key: 'cms',
    name: 'CMS',
    price: '+ $49/mo',
    repl: 'Replaces a headless CMS like Storyblok',
    feats: [
      'Block editor, autosave + revisions',
      'Structured content types + typed API',
      'Media library (auto WebP/AVIF)',
      'Per-page SEO + JSON-LD',
      'Scheduling & drafts',
      'Roles & publishing workflow',
    ],
  },
  {
    key: 'crm',
    name: 'CRM',
    price: '+ $49/mo',
    repl: 'Replaces HubSpot + an automation seat',
    feats: [
      'One customer record, no deduping',
      'Dynamic segments from any signal',
      'Pipeline tied to order status',
      'Activity timeline across modules',
      'Automations, notes & tasks',
      'Tags & lists',
    ],
  },
  {
    key: 'email',
    name: 'Email',
    price: '+ $29/mo',
    repl: 'Replaces Klaviyo + a transactional service',
    feats: [
      'Transactional wired into every module',
      'Campaigns + A/B testing',
      'Your domain — SPF/DKIM/DMARC',
      'React Email templates',
      'Audiences synced from CRM',
      'Flat price, no per-email fees',
    ],
  },
  {
    key: 'b2b',
    name: 'B2B · Fleet',
    price: '+ $99/mo',
    repl: 'Replaces Shopify Plus for native B2B',
    feats: [
      'Account-tier + contract pricing',
      'Net 15 / 30 / 60 / 90 + PO checkout',
      'Quotes & RFQ',
      'Fleet — vehicles, VIN, cost centers',
      'Catalog visibility & access control',
      'Approval workflows & buyer roles',
    ],
  },
  {
    key: 'ai',
    name: 'AI',
    price: '+ $49/mo',
    repl: 'Replaces Zapier + custom glue code',
    feats: [
      'First-class MCP server, per-tenant',
      'Read & write everything the API can',
      'Per-agent keys, per-tool scopes',
      'Full audit log, revoke in a click',
      'Claude, ChatGPT, Copilot, Cursor',
    ],
  },
  {
    key: 'dropship',
    name: 'Dropship',
    price: '+ $29/mo',
    repl: 'Replaces a standalone dropshipping app',
    feats: [
      'Supplier connectors — CSV/FTP/API',
      'Per-supplier margin rules',
      'Automated multi-supplier routing',
      'Real-time stock sync',
    ],
  },
  {
    key: 'scheduling',
    name: 'Scheduling',
    price: '$29/mo',
    repl: 'Replaces a standalone appointments tool',
    feats: [
      'Appointments, classes, reservations, rentals',
      'No double-booking — enforced in the DB',
      'Deposits, no-show & cancellation policies',
      'Auto-promoting waitlists',
      'Email & SMS reminders',
      'Calendar feed + busy import',
    ],
  },
  {
    key: 'invoicing',
    name: 'Invoicing',
    price: '$19/mo',
    repl: 'Replaces a standalone invoicing tool',
    feats: [
      'Estimates, quotes & invoices — one document',
      'Card & ACH payment links',
      'Recurring & milestone billing',
      'Automatic overdue reminders',
      'Tied to the same customer record',
      'Free with Commerce or B2B',
    ],
  },
  {
    key: 'inventory',
    name: 'Inventory',
    price: '$29/mo',
    repl: 'Replaces a standalone inventory app',
    feats: [
      'Stock across multiple locations',
      'Reorder points & low-stock alerts',
      'Real-time sync to every channel',
      'Transfers, adjustments & counts',
      'Purchase orders to suppliers',
      'Free with Commerce or B2B',
    ],
  },
  {
    key: 'chat',
    name: 'Live Chat',
    price: '$19/mo',
    repl: 'Replaces a live-chat tool like Intercom',
    feats: [
      'Live chat widget on your site',
      'Routed to your shared inbox',
      'Tied to the customer record',
      'Canned replies & office hours',
      'Full history across conversations',
    ],
  },
];

/** How billing works, plainly. */
export const PRINCIPLES: { num: string; title: string; body: string }[] = [
  {
    num: '01',
    title: 'Flat per module',
    body: 'A fixed monthly price for each module you switch on. No per-seat tax, no per-record metering, no usage cliffs.',
  },
  {
    num: '02',
    title: 'Off means off',
    body: 'Turn a module off and it stops billing the same day. It goes quiet, your data stays, and it picks back up if you return.',
  },
  {
    num: '03',
    title: 'One invoice',
    body: 'Every active module on a single monthly bill — not five subscriptions, five renewal dates, and five support queues.',
  },
];

export const ENTERPRISE_FEATS = [
  'SSO / SAML + SCIM',
  'Custom SLA with credits',
  'Dedicated support + onboarding',
  'Security review + custom MSA',
  'Volume pricing',
  'Migration assistance',
];

/** Pricing-specific FAQ — the real objections a visitor to this page asks. */
export const PRICING_FAQ: { id: string; question: string; answer: string }[] = [
  {
    id: 'what-is-a-module',
    question: 'What counts as a module?',
    answer:
      'The twelve capabilities in the switchboard — Builder, Commerce, CMS, CRM, Invoicing, Email, B2B, Dropship, Inventory, Live Chat, Scheduling, and AI. Each is a flat monthly price you switch on or off independently — and Invoicing and Inventory come free the moment you turn on Commerce or B2B. The platform underneath (hosting, security, API) is included on every plan.',
  },
  {
    id: 'start-with-builder',
    question: 'Do I have to start with Builder?',
    answer:
      'No. Builder hosts and serves a website, so any hosted sparx site turns it on — but it is optional, not a base. A content-only publisher, a CRM-only team, or anyone driving their own frontend off the API can start from the module they actually use.',
  },
  {
    id: 'switch-off',
    question: 'Can I switch a module off later?',
    answer:
      'Anytime, from the dashboard. Billing stops the same day and the module goes quiet — no workers, no charges. Your data stays exactly where it was and comes right back if you turn it on again.',
  },
  {
    id: 'seat-usage-fees',
    question: 'Are there per-seat or usage fees?',
    answer:
      'No. Team members are unlimited, and the module price is the price — no per-record or per-contact metering. Email is flat too: send ten thousand or a million a month, same bill.',
  },
  {
    id: 'free-trial',
    question: 'Is there a free trial?',
    answer:
      'Yes — 14 days free, with full access to every module and no credit card to start. Build your whole site during the trial and pick the modules you want to keep before it ends. Need more time? Your data is preserved for 30 days after the trial.',
  },
  {
    id: 'migrate',
    question: 'Can I migrate from my current tools?',
    answer:
      'Yes. Import products, content, and customers with our migration tooling, and Enterprise plans include hands-on migration help.',
  },
];
