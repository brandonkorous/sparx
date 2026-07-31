// The module switchboard — the catalog the onboarding "switch on what you use"
// surface is built from, plus the dependency graph that keeps a selection honest.
//
// Client-safe by construction (no server import): flipping a switch recomputes the
// bill in the browser with no round-trip. The API enforces the authoritative graph
// (b2b→commerce, the bundled-free rules) on save; this file is the user-intended
// set the UI drives from, and the price/savings math the plan summary shows.
//
// A row carries NO color of its own. The workbench's module-hue mechanism is
// `ModuleScope` (data-module ⇒ --color-module), so a row that wants a module's
// accent wraps in <ModuleScope module={m.key}> and its children read `bg-module` /
// `text-module`. A `colorVar` field used to sit here holding
// `var(--color-module-<key>)` per entry; nothing ever read it, and duplicating the
// palette in TS is exactly the drift the tokens exist to prevent.
//
// This mirrors the same catalog the pricing page and Settings → Modules present, so
// a tenant sees an identical offer whether shopping, onboarding, or managing a live
// workspace. A future @sparx/module-catalog package could collapse those copies
// into one source; until then each surface owns a client-safe view of the data.

export interface SwitchboardModule {
  /** Module slug — also the brand color key (`--color-module-<key>`). */
  key: string;
  name: string;
  desc: string;
  /** Monthly price in whole dollars. */
  price: number;
  /** Real monthly cost of the tool this module replaces (the savings ledger). */
  elsewhere: number;
  long: string;
  feats: string[];
  replaces: string;
  /** Add-ons render under an "Add-ons" divider — priced on top, never part of the
   *  core "modules" story. */
  addon?: boolean;
}

export const SWITCHBOARD_MODULES: SwitchboardModule[] = [
  {
    key: 'builder',
    name: 'Builder',
    desc: 'Themes, pages, live URLs',
    price: 10,
    elsewhere: 39,
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
    long: 'A real editor with revisions, structured content types with a typed API, a media library, and SEO scored on every publish. Standalone or paired with your site.',
    feats: [
      'Block editor with revisions',
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
    key: 'scheduling',
    name: 'Scheduling',
    desc: 'Appointments, classes, reservations',
    price: 29,
    elsewhere: 49,
    long: 'Online booking for anything time-based — appointments, group classes, table reservations, equipment rentals — on one engine. Availability that prevents double-booking at the database level, deposits and no-show fees, automated reminders, and two-way calendar sync.',
    feats: [
      'Appointments, classes, reservations & rentals',
      'No-overlap booking with buffers & lead time',
      'Deposits, no-show fees & cancellation policies',
      'Email + SMS reminders, two-way calendar sync',
    ],
    replaces: 'a booking tool like Calendly or Acuity',
  },
  {
    key: 'dropship',
    name: 'Dropship',
    desc: 'Suppliers, sync, fulfillment',
    price: 29,
    elsewhere: 60,
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
//     ON while the key is on. Only B2B requires Commerce.
//   BUNDLED_FREE — a key is on free ($0, "Included") whenever a provider is on;
//     Invoicing/Inventory ride along with Commerce/B2B, else they're add-ons.
const REQUIRES: Record<string, string[]> = {
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
 *  enabling a module co-enables its transitive paid requirements (enabling B2B
 *  pulls Commerce on). */
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

/** The default modules a fresh tenant starts onboarding with switched on. */
export const DEFAULT_ON = ['builder', 'commerce', 'cms'];

/** Selling modules — any one being on is what gates the Payments step. */
export const SELLING_MODULE_KEYS = ['commerce', 'b2b', 'dropship'];

/** Whether any selling module is effectively on (so Payments should appear). */
export function isSellingSelected(modules: Record<string, boolean>): boolean {
  return SELLING_MODULE_KEYS.some((k) => effectiveModuleOn(modules, k));
}

/** The plan total + savings for a module selection, applying the graph. */
export function planTotals(modules: Record<string, boolean>): {
  total: number;
  elsewhere: number;
  savings: number;
} {
  let total = 0;
  let elsewhere = 0;
  for (const m of SWITCHBOARD_MODULES) {
    if (!effectiveModuleOn(modules, m.key)) continue;
    total += moduleBilled(modules, m);
    elsewhere += moduleElsewhere(modules, m);
  }
  return { total, elsewhere, savings: Math.max(0, elsewhere - total) };
}
