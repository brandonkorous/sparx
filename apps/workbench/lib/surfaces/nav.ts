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
  Wrench,
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
  seo: 'Search',
  chat: 'Messages',
  ai: 'AI',
  partner: 'Partners',
  storefront: 'Storefront',
};

export function moduleLabel(module: WorkbenchModule): string {
  return MODULE_LABELS[module] ?? module;
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
  builder: Wrench,
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

  return modules;
}
