// Dashboard shell — module manifest registry.
//
// Composes every module's static ModuleManifest into a single array the
// shell renders from. Adding a new module means importing its manifest
// here and appending it to `moduleManifests`. See docs/24-dashboard-shell.md
// §3 for the contract.

import type { ModuleManifest, ModuleAction, ModuleSection, ModuleIcon } from '@sparx/ui/shell';
import type { SparxModule } from '@sparx/ui';

import { commerceManifest } from '@sparx/commerce/manifest';
import { cmsManifest } from '@sparx/cms-editor/manifest';
import { emailManifest } from '@sparx/email-platform/manifest';

import { builderManifest } from '../builder/manifest';
import { crmManifest } from '../crm/manifest';
import { invoicingManifest } from '../invoicing/manifest';
import { b2bManifest } from '../b2b/manifest';
import { dropshipManifest } from '../dropship/manifest';
import { inventoryManifest } from '../inventory/manifest';
import { chatManifest } from '../chat/manifest';
import { schedulingManifest } from '../scheduling/manifest';
import { aiManifest } from '../ai/manifest';

// Ordered. This is the sidebar display order under the "Modules" section.
export const moduleManifests: readonly ModuleManifest[] = [
  builderManifest,
  commerceManifest,
  cmsManifest,
  crmManifest,
  invoicingManifest,
  emailManifest,
  b2bManifest,
  dropshipManifest,
  inventoryManifest,
  chatManifest,
  schedulingManifest,
  aiManifest,
] as const;

export function getManifestById(id: string): ModuleManifest | undefined {
  return moduleManifests.find((m) => m.id === id);
}

// Returns the manifest that owns a given pathname, by matching the longest
// `routePrefix` among all manifests.
function matchManifestByRoutePrefix(pathname: string): ModuleManifest | undefined {
  let best: { manifest: ModuleManifest; matchLength: number } | undefined;
  for (const manifest of moduleManifests) {
    if (pathname === manifest.routePrefix || pathname.startsWith(`${manifest.routePrefix}/`)) {
      if (!best || manifest.routePrefix.length > best.matchLength) {
        best = { manifest, matchLength: manifest.routePrefix.length };
      }
    }
  }
  return best?.manifest;
}

// Returns the manifest that "owns" a given pathname for nav purposes. Usually
// that's just the routePrefix owner (Commerce owns everything under
// /commerce). But a handful of pages are cross-listed in a SECOND module's
// `sections` even though they live outside that module's own routePrefix —
// Orders used to be the example here: one page at /crm/orders cross-listed into
// Commerce's sections. It no longer is — Commerce, B2B, and CRM are separately
// billed and now each own a REAL order route (/commerce/orders, /b2b/orders,
// /crm/orders) over one shared /v1/orders API root, so each resolves by plain
// routePrefix. The cross-listing mechanism below stays for the pages that still
// rely on it. When the
// routePrefix owner isn't enabled for this tenant, prefer whichever ENABLED
// manifest cross-lists this path instead — that's what makes the sidebar,
// breadcrumb, and mobile nav resolve to "Commerce" (not a blank/orphaned
// "CRM") for such a tenant. Pass `enabledModules` wherever it's available;
// omit it only for callers with no tenant-module context (falls back to the
// plain routePrefix match).
export function getManifestForPath(
  pathname: string,
  enabledModules?: readonly string[]
): ModuleManifest | undefined {
  const byPrefix = matchManifestByRoutePrefix(pathname);
  if (!enabledModules || (byPrefix && enabledModules.includes(byPrefix.id))) {
    return byPrefix;
  }
  for (const manifest of moduleManifests) {
    if (!enabledModules.includes(manifest.id)) continue;
    for (const section of manifest.sections) {
      if (pathname === section.href || pathname.startsWith(`${section.href}/`)) {
        return manifest;
      }
    }
  }
  return byPrefix;
}

// Find the action whose href matches the given pathname. Used by the header
// star toggle to resolve "is the current page a favoritable generic
// location?" — returns undefined for entity-instance routes.
export function findActionByHref(href: string): ModuleAction | undefined {
  for (const manifest of moduleManifests) {
    const action = manifest.actions.find((a) => a.href === href);
    if (action) return action;
  }
  return undefined;
}

// Find the section whose href matches the given pathname (exact or prefix).
export function findSectionByPath(pathname: string): ModuleSection | undefined {
  let best: { section: ModuleSection; matchLength: number } | undefined;
  for (const manifest of moduleManifests) {
    for (const section of manifest.sections) {
      if (pathname === section.href || pathname.startsWith(`${section.href}/`)) {
        if (!best || section.href.length > best.matchLength) {
          best = { section, matchLength: section.href.length };
        }
      }
    }
  }
  return best?.section;
}

// A unified shape for anything a user can favorite or land in recents.
// Section-id favorites are namespaced as `${moduleId}.section.${sectionId}`
// to avoid collisions with manifest action ids.
export interface FavoritableItem {
  id: string;
  label: string;
  href: string;
  icon: ModuleIcon;
  moduleId: Exclude<SparxModule, 'platform'>;
  kind: 'action' | 'section';
}

export function listFavoritableItems(): FavoritableItem[] {
  const items: FavoritableItem[] = [];
  for (const m of moduleManifests) {
    for (const s of m.sections) {
      items.push({
        id: `${m.id}.section.${s.id}`,
        label: s.label,
        href: s.href,
        icon: s.icon,
        moduleId: m.id,
        kind: 'section',
      });
    }
    for (const a of m.actions) {
      items.push({
        id: a.id,
        label: a.label,
        href: a.href,
        icon: a.icon,
        moduleId: m.id,
        kind: 'action',
      });
    }
  }
  return items;
}

export function findFavoritableById(id: string): FavoritableItem | undefined {
  return listFavoritableItems().find((i) => i.id === id);
}

export function findFavoritableByPath(pathname: string): FavoritableItem | undefined {
  // Prefer exact href match (a "specific" item is the manifest action whose
  // href equals the current path). Fall back to nothing — we deliberately do
  // not auto-favorite descendant routes.
  return listFavoritableItems().find((i) => i.href === pathname);
}
