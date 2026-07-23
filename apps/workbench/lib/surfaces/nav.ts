// Navigation, derived from the surface registry.
//
// There is no nav config file, and deliberately so. The dashboard keeps its
// navigation in module manifests that are hand-synced with the surfaces they
// point at, which is why a surface there can exist and still be unreachable.
// Here the catalog IS the nav: register a surface with a `module` and `section`
// and it appears, in the right place, automatically.
//
// The consequence worth stating: nav order is authored in the catalog via
// `order`, not here. This module only groups and sorts.

import {
  Bot,
  Boxes,
  Building2,
  CalendarClock,
  CreditCard,
  FileText,
  Globe,
  Handshake,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Newspaper,
  Search,
  ShoppingCart,
  Store,
  Truck,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { listedSurfaces, resolveTitle, type SurfaceDefinition } from './registry';
import type { WorkbenchModule } from '../../components/module-scope';

export interface NavSection {
  /** Group heading. `null` for surfaces registered without a section. */
  title: string | null;
  surfaces: SurfaceDefinition[];
}

export interface NavModule {
  module: WorkbenchModule;
  label: string;
  /** First surface's icon stands in as the module's rail icon. */
  icon: SurfaceDefinition['icon'];
  sections: NavSection[];
  /** Total surfaces, so the rail can hide modules with nothing in them. */
  count: number;
}

/** Human label for a module key. Deliberately plain — the audience is business owners. */
const MODULE_LABELS: Partial<Record<WorkbenchModule, string>> = {
  platform: 'Workbench',
  commerce: 'Selling',
  crm: 'Customers',
  invoicing: 'Invoicing',
  inventory: 'Inventory',
  cms: 'Content',
  builder: 'Site',
  email: 'Email',
  b2b: 'Wholesale',
  finance: 'Finance',
  scheduling: 'Scheduling',
  dropship: 'Dropshipping',
  automations: 'Automations',
  // SEO is the value-add itself — business owners know the term and pay for it,
  // so the rail names it outright rather than softening it to "Search" (which
  // also collided with the toolbar's global search). This is the one place the
  // plain-language rule yields: the acronym IS the recognisable value here.
  seo: 'SEO',
  chat: 'Messages',
  ai: 'AI',
  partner: 'Partners',
  storefront: 'Storefront',
};

export function moduleLabel(module: WorkbenchModule): string {
  return MODULE_LABELS[module] ?? module;
}

/**
 * The order modules appear in the rail — stated once, here, on purpose.
 *
 * This exists because "first-registration order" is the wrong tool for the job.
 * A module claims its rail slot at its first LISTED surface, so a cross-module
 * surface registered under another module's file (the product-panel stock/
 * dropship/translations surfaces live in commerce.ts) would silently drag
 * Inventory, Dropshipping and Content up above the modules they belong to — the
 * rail order became an accident of where a surface happened to be declared.
 *
 * The order tells the arc of running the business, and every module that
 * SUPPORTS another sits directly beneath it:
 *
 *   Workbench                          — home / overview
 *   Site → Content → SEO               — your presence: build it, fill it, get it found
 *   Selling → Inventory → Dropshipping → Wholesale
 *                                      — what you offer, and everything backing it
 *   Customers → Messages → Email → Scheduling
 *                                      — the people you serve, and how you reach them
 *   Invoicing → Finance                — getting paid
 *   Automations → AI                   — leverage across everything above
 *   Partners                           — a different kind of user; stays last
 *
 * A module missing from this list sorts after every listed one (and then by its
 * registration order), so adding a module never vanishes it — it just lands at
 * the end until it earns a considered slot here.
 */
const MODULE_ORDER: WorkbenchModule[] = [
  'platform',
  'builder',
  'cms',
  'seo',
  'commerce',
  'inventory',
  'dropship',
  'b2b',
  'crm',
  'chat',
  'email',
  'scheduling',
  'invoicing',
  'finance',
  'automations',
  'ai',
  'storefront',
  'partner',
];

const MODULE_RANK = new Map<WorkbenchModule, number>(
  MODULE_ORDER.map((module, index) => [module, index])
);

/** Rank for rail sorting; unlisted modules sort to the end, ties keep insertion order. */
function moduleRank(module: WorkbenchModule): number {
  return MODULE_RANK.get(module) ?? Number.MAX_SAFE_INTEGER;
}

/**
 * The rail icon for each module — an explicit editorial choice.
 *
 * Deliberately NOT "the first surface's icon". That made a module's identity in
 * the rail an accident of sort order: Selling showed a `%` because Discounts
 * happened to sort first. The rail is the most persistent piece of UI in the
 * app; its icons should be chosen, not emergent.
 */
const MODULE_ICONS: Partial<Record<WorkbenchModule, LucideIcon>> = {
  platform: LayoutDashboard,
  commerce: ShoppingCart,
  crm: Users,
  invoicing: FileText,
  inventory: Boxes,
  cms: Newspaper,
  builder: Globe,
  email: Mail,
  b2b: Building2,
  finance: CreditCard,
  scheduling: CalendarClock,
  dropship: Truck,
  automations: Workflow,
  seo: Search,
  chat: MessageSquare,
  ai: Bot,
  partner: Handshake,
  storefront: Store,
};

/**
 * A module's chosen icon, for chrome OUTSIDE the rail that has to name a module.
 *
 * Exported so a notification row, a search result or a command-palette entry
 * marks "Selling" with the same glyph the rail does. Re-declaring the mapping at
 * each call site is how a module ends up with two faces.
 *
 * `null` for a module with no chosen icon — callers pick their own fallback,
 * since there is no sensible generic stand-in for "some module".
 */
export function moduleIcon(module: WorkbenchModule): LucideIcon | null {
  return MODULE_ICONS[module] ?? null;
}

function bySectionOrder(a: SurfaceDefinition, b: SurfaceDefinition): number {
  const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
  const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
  if (orderA !== orderB) return orderA - orderB;
  return resolveTitle(a, {}).localeCompare(resolveTitle(b, {}));
}

/**
 * Builds the full nav tree. Cheap enough to call per render — the catalog is a
 * few dozen entries and never changes after import — but callers should still
 * memoise it since it allocates.
 */
export function buildNav(): NavModule[] {
  const byModule = new Map<WorkbenchModule, SurfaceDefinition[]>();

  for (const surface of listedSurfaces()) {
    const existing = byModule.get(surface.module);
    if (existing) existing.push(surface);
    else byModule.set(surface.module, [surface]);
  }

  const modules: NavModule[] = [];

  for (const [module, surfaces] of byModule) {
    const sorted = [...surfaces].sort(bySectionOrder);

    // Preserve first-seen section order rather than sorting alphabetically —
    // 'Catalog' before 'Orders' is an editorial decision made in the catalog,
    // and alphabetising would silently override it.
    const sectionOrder: (string | null)[] = [];
    const grouped = new Map<string | null, SurfaceDefinition[]>();

    for (const surface of sorted) {
      const key = surface.section ?? null;
      const bucket = grouped.get(key);
      if (bucket) {
        bucket.push(surface);
      } else {
        grouped.set(key, [surface]);
        sectionOrder.push(key);
      }
    }

    // Unsectioned surfaces lead — they're the module's landing surfaces.
    sectionOrder.sort((a, b) => (a === null ? -1 : b === null ? 1 : 0));

    const first = sorted[0];
    if (!first) continue;

    modules.push({
      module,
      label: moduleLabel(module),
      // Falls back to a surface icon only for a module with no chosen icon —
      // which means someone added a module and skipped MODULE_ICONS.
      icon: MODULE_ICONS[module] ?? first.icon,
      count: sorted.length,
      sections: sectionOrder.map((title) => ({
        title,
        surfaces: grouped.get(title) ?? [],
      })),
    });
  }

  // Rail order is authored in MODULE_ORDER, not inherited from registration —
  // see the comment there. Array.prototype.sort is stable, so modules sharing a
  // rank (only the unlisted tail) keep their first-registration order.
  modules.sort((a, b) => moduleRank(a.module) - moduleRank(b.module));

  return modules;
}
