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
    id: 'customers',
    label: 'Customers',
    purpose: 'Who you work with, and everything you know about them',
    group: 'people',
    navOrder: 70,
    defaultEnabled: true,
    modules: ['crm'],
  },
  {
    id: 'messages',
    label: 'Messages',
    purpose: 'Email and conversations with your customers',
    group: 'people',
    navOrder: 80,
    defaultEnabled: true,
    modules: ['email', 'chat'],
  },
  {
    id: 'bookings',
    label: 'Bookings',
    purpose: 'Appointments, availability and your calendar',
    group: 'people',
    navOrder: 90,
    defaultEnabled: true,
    modules: ['scheduling'],
  },
  {
    id: 'invoices',
    label: 'Invoices',
    purpose: 'Bill people and track who has paid',
    group: 'money',
    navOrder: 100,
    defaultEnabled: true,
    modules: ['invoicing'],
  },
  {
    id: 'money',
    label: 'Money',
    purpose: 'What came in, what went out, and what you kept',
    group: 'money',
    navOrder: 110,
    defaultEnabled: true,
    modules: ['finance'],
  },
  {
    id: 'team',
    label: 'My Team',
    purpose: 'The people who work with you, and what they can do',
    group: 'run',
    navOrder: 120,
    defaultEnabled: true,
    modules: ['staff'],
  },
  {
    id: 'automations',
    label: 'Automations',
    purpose: 'Let routine things happen without you',
    group: 'run',
    navOrder: 130,
    defaultEnabled: false,
    modules: ['automations'],
  },
  {
    id: 'partners',
    label: 'Partners',
    purpose: 'Suppliers, vendors and the people you work alongside',
    group: 'run',
    navOrder: 140,
    defaultEnabled: false,
    modules: ['partner'],
  },
  {
    id: 'connections',
    label: 'Connections',
    purpose: 'Link Piggles to the other tools you use',
    group: 'run',
    navOrder: 150,
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

/**
 * The platform modules behind a set of colour groups — what onboarding's "what do
 * you do?" answer actually turns on.
 *
 * ── WHY THIS EXISTS, AND WHAT IT IS NOT ─────────────────────────────────────
 *
 * The answer is a set of GROUPS ("I sell things"), the rail is a set of APPS
 * ("Sell", "Stock"), and the platform activates MODULES (`commerce`, `b2b`,
 * `dropship`, `inventory`). This is the only place that walks all three, derived
 * from the registry so the three can never disagree.
 *
 * **It is not an entitlement.** A module that is off in Piggles is not a locked
 * door and must never become one — every app stays listed, and turning one on is
 * one tap with no price attached (piggles/CLAUDE.md RULE #2: the answer HIDES,
 * it never gates). What activation buys is that a business which said it sells
 * things arrives to a Sell app that already has its tax and shipping defaults,
 * rather than to fifteen apps each waiting to be set up.
 *
 * `platform` is filtered out: it is the console itself, not a module anything
 * can activate. Anything else the registry names is passed through as written —
 * validating against the platform's catalogue would mean holding a copy of it
 * here, and an unknown slug is inert anyway.
 */
export const modulesForGroups = (groups: readonly PigglesGroup[]): string[] => {
  const wanted = new Set(groups);
  return [
    ...new Set(
      APPS.filter((app) => wanted.has(app.group))
        .flatMap((app) => app.modules)
        .filter((module) => module !== 'platform')
    ),
  ];
};
