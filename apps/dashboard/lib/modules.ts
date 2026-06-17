// Shared module switchboard catalog — the single source for the interactive
// "switch on what you use" surface that now appears in THREE places: the public
// pricing page (apps/web mirrors this data), the onboarding Modules step, and
// the in-app Settings → Modules activation screen. Same modules, prices,
// descriptions, "replaces" cost comparison, and dependency graph, so a tenant
// sees an identical offer whether they're shopping, onboarding, or managing a
// live workspace.
//
// Client-safe (no server import) so it can ship in the browser bundle of any of
// those islands. Colors are token vars (`--module-<key>`), not hex, so they stay
// in lockstep with @sparx/ui's module palette.
//
// The dependency helpers below MIRROR the server graph in @sparx/modules
// (BUNDLED_FREE / REQUIRES). They drive the MARKETING surfaces (pricing,
// onboarding) where there is no server round-trip — flipping a switch recomputes
// the bill client-side. The in-app Settings screen is different: it reads
// authoritative per-tenant lock state from the API
// (`listModuleStateForCurrentTenant`) and uses this file only for presentation
// (name, price, copy, color), never re-deriving locks client-side.

export interface SwitchboardModule {
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

export const SWITCHBOARD_MODULES: SwitchboardModule[] = [
  {
    key: 'builder',
    name: 'Builder',
    desc: 'Themes, pages, live URLs',
    price: 10,
    elsewhere: 39,
    colorVar: 'var(--module-builder)',
    long: 'The foundation every sparx site starts on. Pick a polished theme, edit blocks, point your domain — automatic SSL, edge-cached pages, instant TTFB worldwide. Power users go fully headless against the same API.',
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
    long: 'A real editor with autosave and revisions, structured content types with a typed API, a media library, and SEO scored on every publish. Standalone or paired with your site.',
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
    key: 'invoicing',
    name: 'Invoicing',
    desc: 'Estimates, invoices, AR',
    price: 19,
    elsewhere: 30,
    colorVar: 'var(--module-invoicing)',
    long: 'Author estimates, work orders, and invoices line by line — parts marked up, labor by the hour, deposits and partial payments — through stages you name. Tracks balances and AR aging, and prints on your brand. Included free with Commerce or B2B.',
    feats: [
      'Estimate → invoice workflows you name',
      'Parts, labor, sublet & flat-fee lines',
      'Deposits, partial payments, AR aging',
      'Branded, printable documents',
    ],
    replaces: 'a billing tool like FreshBooks',
    addon: true,
  },
  {
    key: 'inventory',
    name: 'Inventory',
    desc: 'Stock, warehouses, ledger',
    price: 29,
    elsewhere: 99,
    colorVar: 'var(--module-inventory)',
    long: 'A real inventory system under your catalog — multi-warehouse stock with an append-only movement ledger that makes every count auditable, reservations, lots and serials, and reorder alerts. Included free with Commerce or B2B; runs standalone as WMS-lite.',
    feats: [
      'Multi-warehouse on-hand / allocated / available',
      'Audited movement ledger — every change attributable',
      'Lots, serials, expiry & recalls',
      'Reorder points + low-stock alerts',
    ],
    replaces: 'a WMS/IMS add-on like inFlow or Katana',
    addon: true,
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
      'Site widget in your theme',
      'AI answers from your own catalog',
      'Staff inbox — assign, reply, resolve',
      'Web-push + email notifications',
    ],
    replaces: 'a live-chat + AI inbox like Intercom',
    addon: true,
  },
];

export const MODULE_BY_KEY: Record<string, SwitchboardModule> = Object.fromEntries(
  SWITCHBOARD_MODULES.map((m) => [m.key, m])
);

// ── Module dependency rules (mirror the server @sparx/modules graph) ──────────
//   REQUIRES — a key needs these providers; each is SEPARATELY BILLED and locks
//     ON while the key is on. Commerce/CMS/Email need Builder (the $10 site
//     foundation); B2B needs Commerce. Requirements compose transitively
//     (B2B → Commerce → Builder).
//   BUNDLED_FREE — a key is on free ($0, "Included") whenever a provider is on;
//     Invoicing rides along with Commerce/B2B, else it's a $19 add-on.
const REQUIRES: Record<string, string[]> = {
  commerce: ['builder'],
  cms: ['builder'],
  email: ['builder'],
  b2b: ['commerce'],
};
const BUNDLED_FREE: Record<string, string[]> = {
  invoicing: ['b2b', 'commerce'],
  inventory: ['commerce', 'b2b'],
};

/** Providers that bundle `key` free and are currently on. */
function activeBundlers(modules: Record<string, boolean>, key: string): string[] {
  return (BUNDLED_FREE[key] ?? []).filter((p) => modules[p]);
}

/** Enabled modules that REQUIRE `key` (so it's locked on). */
function activeRequirers(modules: Record<string, boolean>, key: string): string[] {
  return Object.keys(REQUIRES).filter((k) => (REQUIRES[k] ?? []).includes(key) && modules[k]);
}

/** Transitive paid requirements pulled on when `key` is enabled. */
function requiredKeys(key: string): string[] {
  const out = new Set<string>();
  const visit = (k: string): void => {
    for (const dep of REQUIRES[k] ?? []) {
      if (!out.has(dep)) {
        out.add(dep);
        visit(dep);
      }
    }
  };
  visit(key);
  return [...out];
}

function joinNames(slugs: string[]): string {
  const names = slugs.map((s) => MODULE_BY_KEY[s]?.name ?? s);
  return names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} & ${names.at(-1)}`;
}

/** A module's effective on-state once the dependency graph is applied. */
export function effectiveModuleOn(modules: Record<string, boolean>, key: string): boolean {
  return (
    Boolean(modules[key]) ||
    activeBundlers(modules, key).length > 0 ||
    activeRequirers(modules, key).length > 0
  );
}

/** Why a module's toggle is locked on, if it is — bundled ("Included") wins. */
export function moduleLock(
  modules: Record<string, boolean>,
  key: string
): 'included' | 'required' | null {
  if (activeBundlers(modules, key).length > 0) return 'included';
  if (activeRequirers(modules, key).length > 0) return 'required';
  return null;
}

/** The "Included with …" / "Required by …" caption for a locked row, or null. */
export function lockReasonText(modules: Record<string, boolean>, key: string): string | null {
  const lock = moduleLock(modules, key);
  if (lock === 'included') return `Included with ${joinNames(activeBundlers(modules, key))}`;
  if (lock === 'required') return `Required by ${joinNames(activeRequirers(modules, key))}`;
  return null;
}

/** Apply a toggle through the dependency graph: locked rows ignore the click;
 *  enabling a module co-enables its transitive paid requirements (enabling
 *  Commerce pulls Builder on; enabling B2B pulls Commerce AND Builder on). */
export function toggleModule(
  modules: Record<string, boolean>,
  key: string
): Record<string, boolean> {
  if (moduleLock(modules, key) !== null) return modules;
  const next = { ...modules, [key]: !modules[key] };
  if (next[key]) for (const dep of requiredKeys(key)) next[dep] = true;
  return next;
}

/** Monthly charge for a module given the graph — a bundled capability is $0. */
export function moduleBilled(modules: Record<string, boolean>, m: SwitchboardModule): number {
  return moduleLock(modules, m.key) === 'included' ? 0 : m.price;
}

/** Replaced-cost contribution to the savings ledger — bundled capabilities are a
 *  free rider, so they contribute $0 (no double-count). */
export function moduleElsewhere(modules: Record<string, boolean>, m: SwitchboardModule): number {
  return moduleLock(modules, m.key) === 'included' ? 0 : m.elsewhere;
}
