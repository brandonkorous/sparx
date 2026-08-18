// The Piggles app registry — what apps exist, what they are called, which group
// they belong to, and which platform modules each one fronts.
//
// A PRODUCT ADAPTER, not a feature gate: every app here is included in the
// standard subscription, and `defaultEnabled` only decides what the rail shows on
// day one (piggles/CLAUDE.md RULE #2). Derived lookups live in `app-index.ts`.

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
  /** One line on what the app is for, in the customer's language — a benefit
   *  rather than a category. Used by the launcher, onboarding and search. */
  purpose: string;
  /** Which of the six color groups this app wears. */
  group: PigglesGroup;
  /** Position in the rail. Contiguous within a group — see NAV ORDER below. */
  navOrder: number;
  /** Whether the app is in the rail for a brand-new business. A workspace
   *  default, NOT an entitlement: everything is included in the subscription and
   *  everything stays one click from discoverable. */
  defaultEnabled: boolean;
  /**
   * The NAV vocabulary — the `data-module` identities whose surfaces gather
   * under this app. One Piggles app routinely covers several: "Sell" is
   * commerce + B2B + dropship.
   *
   * This is NOT the activation vocabulary. It includes identities the platform
   * has no flag for (`platform`, `seo`, `storefront`), so it must never be sent
   * to `PUT /v1/tenant/modules` unfiltered — see `useModulesToActivate`.
   */
  modules: ModuleKey[];
  /**
   * What ADDING this app must switch on, when that differs from `modules`.
   *
   * Only an app built entirely from `claims` needs it: it fronts no module of
   * its own, so without this the Add button would write nothing and still
   * report success.
   */
  activates?: ModuleKey[];
  /**
   * Individual SURFACES this app takes over from whichever module owns them.
   *
   * `modules` cannot express a SPLIT — one platform module whose surfaces belong
   * under two Piggles apps — and Partners is exactly that. The platform keeps
   * suppliers, purchase orders and receiving inside `inventory`; Piggles
   * advertises them as their own app.
   *
   * A surface may be claimed by at most one app; the claiming app wins and the
   * owning module's panel no longer lists it. A key that does not resolve claims
   * nothing, silently.
   */
  claims?: string[];
}

// ── NAV ORDER ────────────────────────────────────────────────────────────────
// Ordered so each color group is CONTIGUOUS — a group hue only does its job
// when the things sharing it sit together. The sequence tells a story a business
// owner already has: your presence → what you sell → the people → the money →
// running the place.

export const APPS: readonly PigglesAppDef[] = [
  {
    id: 'home',
    label: 'Home',
    purpose: 'What needs your attention right now',
    group: 'home',
    navOrder: 10,
    defaultEnabled: true,
    // `platform` is the console itself — always on, never activatable.
    modules: ['platform'],
  },
  {
    id: 'site',
    label: 'My Site',
    purpose: 'Your website — pages, design and branding',
    group: 'web',
    navOrder: 20,
    defaultEnabled: true,
    // `storefront` is a hue identity only; `builder` is the module behind it.
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
    // `seo` rides along with the site and has no flag of its own.
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
    // Beside Sell and Stock because Partners is about buying the stock you sell.
    // It sat in `run` while it fronted sparx's reseller programme, which is a
    // different app that Piggles does not have.
    group: 'sell',
    navOrder: 70,
    defaultEnabled: false,
    // Built ENTIRELY from claims. `dropship` is not listed either: its supplier
    // screens belong here, but "Shipped by a supplier" is a panel on a PRODUCT
    // and stays in Sell beside the product it is about.
    modules: [],
    // ...which is why adding it has to name the modules its claims come from.
    activates: ['inventory', 'dropship'],
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
    // `automations` is a hue identity; the screens ride along with the platform.
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
