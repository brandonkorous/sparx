// The Piggles app registry — the single source of truth for what apps exist,
// what they are called, which group they belong to, and which platform modules
// each one fronts.
//
// This is a PRODUCT ADAPTER, not a feature gate. Every app here is entitled on
// the standard subscription; `defaultEnabled` is a workspace preference that
// controls what the rail shows on day one, nothing more. Piggles has no module
// pricing, so nothing in this file may ever be consulted to answer "did they pay
// for this" — see piggles/CLAUDE.md RULE #2.

import type { PigglesGroup } from '@piggles/brand';

/** A platform module key, as the shared workbench surfaces emit it
 *  (`data-module="commerce"`). Deliberately a bare string rather than a union —
 *  the platform owns that list, and Piggles must not hold a stale copy of it. */
export type ModuleKey = string;

export interface PigglesAppDef {
  /** Stable id. Never rendered — `label` is what a person sees. */
  id: string;
  /** The customer-facing name. */
  label: string;
  /** One line on what the app is for, in the customer's language. Used by the
   *  launcher, onboarding and search, so it must read as a benefit rather than a
   *  category. */
  purpose: string;
  /** Which of the six color groups this app wears. */
  group: PigglesGroup;
  /** Position in the rail. Contiguous within a group — see NAV ORDER below. */
  navOrder: number;
  /** Whether the app is in the rail for a brand-new business. A workspace
   *  default, NOT an entitlement: everything is included in the subscription and
   *  everything stays one click from discoverable. */
  defaultEnabled: boolean;
  /** The platform modules this app fronts. One Piggles app routinely covers
   *  several — "Sell" is commerce + B2B + dropship — which is most of how the
   *  product feels smaller than it is without being smaller than it is. */
  modules: ModuleKey[];
  /**
   * Individual SURFACES this app takes over from whichever module owns them.
   *
   * ── WHY A MODULE IS NOT ALWAYS THE RIGHT UNIT ─────────────────────────────
   *
   * `modules` groups whole modules under one app, which covers almost every
   * case. It cannot express a SPLIT — one platform module whose surfaces belong
   * under two different Piggles apps — and Partners is exactly that.
   *
   * The platform keeps suppliers, purchase orders, receiving, landed cost and
   * supplier performance inside `inventory`, beside stock levels and shelves,
   * because to sparx it is all one module. Piggles advertises them as a separate
   * app: meetpiggles.com/apps/partners is titled "The suppliers and people you
   * work alongside" and promises purchase orders, what they really cost and how
   * long they actually take. Without this field that app could only front the
   * platform's `partner` MODULE — which is sparx's reseller programme, a
   * completely different product — so a Piggles customer clicking Partners
   * expecting their suppliers got referrals, commissions and bootcamps.
   *
   * A surface may be claimed by at most one app; the claiming app wins and the
   * owning module's panel no longer lists it. Keys are verified against the
   * surface registry — a key that does not resolve claims nothing, silently.
   */
  claims?: string[];
}

// ── NAV ORDER ────────────────────────────────────────────────────────────────
// Ordered so each colour group is CONTIGUOUS. config/apps.yaml originally put
// Content (100) and Get Found (110) far below My Site (20), which split the Web
// group across the rail — and a group hue only does its job when the things
// sharing it sit together. Nothing else moved; the two were lifted to sit beside
// My Site.
//
// The sequence tells a story a business owner already has: your presence → what
// you sell → the people → the money → running the place.

export const APPS: readonly PigglesAppDef[] = [
  {
    id: 'home',
    label: 'Home',
    purpose: 'What needs your attention right now',
    group: 'home',
    navOrder: 10,
    defaultEnabled: true,
    modules: ['platform'],
  },
  {
    id: 'site',
    label: 'My Site',
    purpose: 'Your website — pages, design and branding',
    group: 'web',
    navOrder: 20,
    defaultEnabled: true,
    modules: ['builder', 'storefront'],
  },
  {
    id: 'content',
    label: 'Content',
    purpose: 'Articles, images and anything you write once and reuse',
    group: 'web',
    navOrder: 30,
    defaultEnabled: true,
    modules: ['cms'],
  },
  {
    id: 'get_found',
    label: 'Get Found',
    purpose: 'Help people find you in search and on social',
    group: 'web',
    navOrder: 40,
    defaultEnabled: true,
    modules: ['seo', 'social'],
  },
  {
    id: 'sell',
    label: 'Sell',
    purpose: 'Products, services, orders and checkout',
    group: 'sell',
    navOrder: 50,
    defaultEnabled: true,
    modules: ['commerce', 'b2b', 'dropship'],
  },
  {
    id: 'stock',
    label: 'Stock',
    purpose: 'What you have, where it is, and when to reorder',
    group: 'sell',
    navOrder: 60,
    defaultEnabled: true,
    modules: ['inventory'],
  },
  {
    id: 'partners',
    label: 'Partners',
    purpose: 'Your suppliers, what they charge and what you have on order',
    // MOVED from `run` to `sell`, with the app itself. Partners is about buying
    // the stock you sell, so it belongs beside Sell and Stock — and a colour
    // group only does its job when the things sharing it sit together
    // (DESIGN.md §2). It sat in `run` while it fronted sparx's reseller
    // programme, which is a different app that Piggles does not have.
    group: 'sell',
    navOrder: 70,
    defaultEnabled: false,
    // Built ENTIRELY from claims, with no module of its own — see `claims` on
    // the interface for why a module is the wrong unit here.
    //
    // `dropship` is not listed either, deliberately. It splits the same way
    // `inventory` does: its supplier screens belong here, and "Shipped by a
    // supplier" is a panel on a PRODUCT and belongs in Sell beside the product
    // it is about. Claiming the four supplier screens leaves that one where it
    // makes sense.
    modules: [],
    claims: [
      // Who supplies what, and on what terms.
      'dropship.suppliers.list',
      'dropship.products.list',
      'dropship.orders.list',
      'dropship.analytics',
      'inventory.suppliers.list',
      'inventory.sources',
      'inventory.suppliers.scorecards',
      // Purchase orders, end to end.
      'inventory.purchase-orders.list',
      'inventory.purchase-orders.approvals',
      'inventory.purchase-orders.approval-rules',
      'inventory.purchase-orders.late',
      'inventory.advance-ship-notices',
      'inventory.receiving.list',
      // What it actually cost, and what came back.
      'inventory.costing.variance',
      'inventory.supplier-bills',
      'inventory.supplier-returns',
      'inventory.consignment',
    ],
  },
  {
    id: 'customers',
    label: 'Customers',
    purpose: 'Who you work with, and everything you know about them',
    group: 'people',
    navOrder: 80,
    defaultEnabled: true,
    modules: ['crm'],
  },
  {
    id: 'messages',
    label: 'Messages',
    purpose: 'Email and conversations with your customers',
    group: 'people',
    navOrder: 90,
    defaultEnabled: true,
    modules: ['email', 'chat'],
  },
  {
    id: 'bookings',
    label: 'Bookings',
    purpose: 'Appointments, availability and your calendar',
    group: 'people',
    navOrder: 100,
    defaultEnabled: true,
    modules: ['scheduling'],
  },
  {
    id: 'invoices',
    label: 'Invoices',
    purpose: 'Bill people and track who has paid',
    group: 'money',
    navOrder: 110,
    defaultEnabled: true,
    modules: ['invoicing'],
  },
  {
    id: 'money',
    label: 'Money',
    purpose: 'What came in, what went out, and what you kept',
    group: 'money',
    navOrder: 120,
    defaultEnabled: true,
    modules: ['finance'],
  },
  {
    id: 'team',
    label: 'My Team',
    purpose: 'The people who work with you, and what they can do',
    group: 'run',
    navOrder: 130,
    defaultEnabled: true,
    modules: ['staff'],
  },
  {
    id: 'automations',
    label: 'Automations',
    purpose: 'Let routine things happen without you',
    group: 'run',
    navOrder: 140,
    defaultEnabled: false,
    modules: ['automations'],
  },
  {
    id: 'connections',
    label: 'Connections',
    purpose: 'Link Piggles to the other tools you use',
    group: 'run',
    navOrder: 160,
    defaultEnabled: false,
    modules: ['ai'],
  },
] as const;

export type PigglesAppId = (typeof APPS)[number]['id'];

/** Lookup by id. */
export const APP_BY_ID: Record<string, PigglesAppDef> = Object.fromEntries(
  APPS.map((a) => [a.id, a])
);

/** Which group an app belongs to. The canonical statement of this mapping —
 *  `@piggles/brand`'s theme.css restates it in CSS only because a stylesheet
 *  cannot import TypeScript. */
export const APP_GROUP: Record<string, PigglesGroup> = Object.fromEntries(
  APPS.map((a) => [a.id, a.group])
);

/** Platform module key → the Piggles app that fronts it.
 *
 *  This is the bridge for SHARED surfaces. They are platform code that speaks
 *  sparx's vocabulary (`commerce`, `crm`, `invoicing`); this answers "what does
 *  Piggles call the place this belongs". Derived from APPS rather than hand-kept,
 *  so a module can never end up mapped in one direction and not the other. */
export const MODULE_TO_APP: Record<ModuleKey, string> = Object.fromEntries(
  APPS.flatMap((a) => a.modules.map((m) => [m, a.id]))
);

/** Platform module key → colour group, for anything reaching for a hue directly.
 *  Mirrors the `[data-module=…]` bridge in `@piggles/brand`'s theme.css. */
export const MODULE_GROUP: Record<ModuleKey, PigglesGroup> = Object.fromEntries(
  APPS.flatMap((a) => a.modules.map((m) => [m, a.group]))
);

/** The apps in a group, in nav order. */
export const appsInGroup = (group: PigglesGroup): PigglesAppDef[] =>
  APPS.filter((a) => a.group === group).sort((x, y) => x.navOrder - y.navOrder);

/** The rail a brand-new business sees. Onboarding narrows this further by asking
 *  what the business actually does — it HIDES, it never gates, and every app
 *  stays reachable from the launcher regardless. */
export const defaultRail = (): PigglesAppDef[] =>
  APPS.filter((a) => a.defaultEnabled).sort((x, y) => x.navOrder - y.navOrder);

// There is deliberately NO `modulesForGroups` here any more.
//
// It mapped onboarding's "what do you do?" answer to the modules to activate,
// and that mapping was the bug: a module left off returns 404, runs no workers
// and stores no rows, so the groups somebody did not tick became locked doors on
// a screen promising "everything is included either way". Onboarding now
// activates ALL_MODULES for every business (RULE #2) and the groups decide only
// what starts on the rail. Reintroducing a groups→modules function is
// reintroducing the gate — if you need one, you are about to charge for
// something Piggles does not charge for.
