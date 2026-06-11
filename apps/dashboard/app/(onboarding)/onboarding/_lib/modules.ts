// The onboarding Modules step is an EXACT mirror of the public pricing
// switchboard (apps/web/components/marketing/pricing-switchboard.tsx): the same
// nine modules, the same prices, descriptions, and "replaces" cost comparison,
// and the same live-calculating plan card. A tenant sees the identical offer
// whether they're shopping on the marketing site or setting up their workspace.
//
// Client-safe (no server import) so the Modules step island can pull it into the
// browser bundle. Colors are token vars (`--module-<key>`), not hex, so they
// stay in lockstep with @sparx/ui's module palette.

export interface OnboardingModule {
  /** Module slug — also the @sparx/ui color key (`color="commerce"` etc.). */
  key: string;
  name: string;
  desc: string;
  /** Monthly price in whole dollars. */
  price: number;
  /** Real monthly cost of the tool this module replaces (the savings ledger). */
  elsewhere: number;
  /** Token var for the module's accent color, e.g. `var(--module-builder)`. */
  colorVar: string;
  long: string;
  feats: string[];
  replaces: string;
  /** Add-ons render under an "Add-ons" divider — priced on top, never part of
   *  the core "modules" story. */
  addon?: boolean;
}

export const ONBOARDING_MODULES: OnboardingModule[] = [
  {
    key: 'builder',
    name: 'Builder',
    desc: 'Themes, pages, live URLs',
    price: 10,
    elsewhere: 39,
    colorVar: 'var(--module-builder)',
    long: 'The foundation every Sparx site starts on. Pick a polished theme, edit blocks, point your domain — automatic SSL, edge-cached pages, instant TTFB worldwide. Power users go fully headless against the same API.',
    feats: [
      'Theme-first, customize what matters',
      'Custom domain + automatic SSL',
      'CDN-cached, stale-while-revalidate',
      'Headless SDK for Next, Remix, Astro',
    ],
    replaces: 'Webflow + hosting + a CDN',
  },
  {
    key: 'commerce',
    name: 'Commerce',
    desc: 'Cart, checkout, orders',
    price: 49,
    elsewhere: 399,
    colorVar: 'var(--module-commerce)',
    long: 'Products, inventory, payments, tax, and shipping. A conversion-optimized single-page checkout out of the box, D2C and B2B from the same codebase.',
    feats: [
      'Variants, bundles, real-time inventory',
      'Apple Pay + one-tap checkout',
      'Stripe, PayPal, Klarna, Affirm',
      'Avalara/TaxJar tax · Shippo/EasyPost',
    ],
    replaces: 'Shopify Advanced + tax & shipping apps',
  },
  {
    key: 'cms',
    name: 'CMS',
    desc: 'Words, media, SEO',
    price: 49,
    elsewhere: 99,
    colorVar: 'var(--module-cms)',
    long: 'A real editor with autosave and revisions, structured content types with a typed API, a media library, and SEO scored on every publish. Standalone or paired with your store.',
    feats: [
      'Block editor, autosave + revisions',
      'Structured content types + typed API',
      'Auto WebP/AVIF media library',
      'Per-page SEO + JSON-LD',
    ],
    replaces: 'a headless CMS like Storyblok + a media CDN',
  },
  {
    key: 'crm',
    name: 'CRM',
    desc: 'Customers, pipeline, signal',
    price: 49,
    elsewhere: 300,
    colorVar: 'var(--module-crm)',
    long: 'One customer record across orders, email, support, RFQs, and AI conversations — sitting on the same database as everything else. No sync, no glue, no duplicate records.',
    feats: [
      'One record, no deduping',
      'Dynamic segments from any signal',
      'Pipeline tied to order status',
      'Automations + activity timeline',
    ],
    replaces: 'HubSpot Sales Pro + an automation seat',
  },
  {
    key: 'email',
    name: 'Email',
    desc: 'Transactional + marketing',
    price: 29,
    elsewhere: 165,
    colorVar: 'var(--module-email)',
    long: 'Transactional and marketing email from your own sending domain, with SPF, DKIM, and DMARC auto-configured. Flat price — send 10K or 1M a month, same bill.',
    feats: [
      'Transactional wired into every module',
      'Campaigns + A/B testing',
      'Your domain, your reputation',
      'No per-email pricing, ever',
    ],
    replaces: 'Klaviyo + a transactional email service',
  },
  {
    key: 'b2b',
    name: 'B2B · Fleet',
    desc: 'Wholesale, net terms, fleet',
    price: 99,
    elsewhere: 2400,
    colorVar: 'var(--module-b2b)',
    long: 'Wholesale pricing, net terms, purchase orders, RFQ, fleet accounts, and service scheduling — natively, not a bolt-on. Built for how industrial actually works.',
    feats: [
      'Account-tier + contract pricing',
      'Net 15 / 30 / 60 / 90 + PO checkout',
      'Fleet: vehicles, VIN, cost centers',
      'RFQ + bookable service bays',
    ],
    replaces: 'Shopify Plus for native B2B',
  },
  {
    key: 'ai',
    name: 'AI · MCP',
    desc: 'Native MCP server',
    price: 49,
    elsewhere: 103,
    colorVar: 'var(--module-ai)',
    long: 'The first content + commerce platform built around the Model Context Protocol. Connect any AI client once and read or write live data in plain English. Scoped, audited, revocable.',
    feats: [
      'First-class MCP server, per-tenant',
      'Read & write everything the API can',
      'Per-agent keys, per-tool scopes',
      'Claude, ChatGPT, Copilot, Cursor',
    ],
    replaces: 'Zapier Team + custom integration work',
  },
  {
    key: 'dropship',
    name: 'Dropship',
    desc: 'Suppliers, sync, fulfillment',
    price: 29,
    elsewhere: 60,
    colorVar: 'var(--module-dropship)',
    long: 'Supplier sync, margin math, and automated order routing — on a real platform underneath, not an app stacked on an app. Sell without holding inventory.',
    feats: [
      'Supplier connectors + CSV/FTP/API',
      'Per-supplier margin rules',
      'Automated multi-supplier routing',
      'Real-time stock sync',
    ],
    replaces: 'a dropshipping app like Spocket',
  },
  {
    key: 'chat',
    name: 'Live Chat',
    desc: 'Widget, AI replies, inbox',
    price: 19,
    elsewhere: 74,
    colorVar: 'var(--module-chat)',
    long: 'A themed chat widget on every page, an AI first responder that answers product and policy questions from your own catalog, and a staff inbox for everything it escalates. Leads from sparx.market route here too.',
    feats: [
      'Storefront widget in your theme',
      'AI answers from your own catalog',
      'Staff inbox — assign, reply, resolve',
      'Web-push + email notifications',
    ],
    replaces: 'a live-chat + AI inbox like Intercom',
    addon: true,
  },
];

export const MODULE_BY_KEY: Record<string, OnboardingModule> = Object.fromEntries(
  ONBOARDING_MODULES.map((m) => [m.key, m])
);

/** Modules on by default the first time a tenant lands — the common starting
 *  point (a site that sells and publishes). Mirrors the pricing page. */
export const DEFAULT_ON = ['builder', 'commerce', 'cms'];

/** The modules a template can REQUIRE for compatibility filtering. Builder is
 *  universal (every site has it) so it never narrows the catalog; Chat is an
 *  add-on layered on top, never a structural requirement. */
export const TEMPLATE_CAP_KEYS = ['commerce', 'cms', 'crm', 'email', 'b2b', 'ai', 'dropship'];

/** Selling modules — when ANY is on, the onboarding flow includes the Payments
 *  (Stripe Connect) step so the tenant can take customer money. */
export const SELLING_MODULE_KEYS = ['commerce', 'b2b', 'dropship'];

export function isSellingSelected(modules: Record<string, boolean>): boolean {
  return SELLING_MODULE_KEYS.some((k) => modules[k]);
}
