// The platform component catalog — assembly + public surface (docs/98 §5).
//
// Concatenates every category's seed entries into one `PLATFORM_CATALOG`. This is
// the published, platform-provided library the Add palette merges with a tenant's
// own archetypes. Entries are static data-as-code (the seed of the eventual
// DB-backed `PlatformComponent` table); the palette consumes them directly and
// stamps a forked copy (fresh ids) into the page.

import type { ComponentSurface } from '../component';
import {
  CATALOG_CATEGORIES,
  catalogSummary,
  type CatalogCategory,
  type PlatformCatalogEntry,
  type PlatformCatalogSummary,
} from './_kit';
import { NAVIGATION_CATALOG } from './navigation';
import { ACTIONS_CATALOG } from './actions';
import { DATA_DISPLAY_CATALOG } from './data-display';
import { DATA_INPUT_CATALOG } from './data-input';
import { FEEDBACK_CATALOG } from './feedback';
import { LAYOUT_CATALOG } from './layout';
import { MARKETING_CATALOG } from './marketing';
import { MOCKUP_CATALOG } from './mockup';
import { INTERACTIVE_CATALOG } from './interactive';

// Public surface — the taxonomy + entry types only. The authoring helpers
// (el/atom/bound/behave/part/cid/entry) stay internal to the category files; the
// closed behavior/role vocabularies are exported so the runtime can drift-check
// them (builder-render asserts BEHAVIOR_NAMES/SX_ROLES match these mirrors).
export {
  CATALOG_CATEGORIES,
  CATALOG_CATEGORY_LABELS,
  CATALOG_KINDS,
  SX_BEHAVIOR_NAMES,
  SX_ROLE_NAMES,
  catalogSummary,
  type CatalogCategory,
  type CatalogKind,
  type PlatformCatalogEntry,
  type PlatformCatalogSummary,
  type SxBehaviorName,
  type SxRoleName,
} from './_kit';

/** The full published library. Entries are grouped for the palette by each entry's
 *  own `category` (catalogGroupsForSurface), so the behavior-bearing INTERACTIVE
 *  composites file beside the static blocks of their family despite being authored
 *  together — within a category, list order is order here (statics first). */
export const PLATFORM_CATALOG: PlatformCatalogEntry[] = [
  ...LAYOUT_CATALOG,
  ...NAVIGATION_CATALOG,
  ...ACTIONS_CATALOG,
  ...DATA_DISPLAY_CATALOG,
  ...DATA_INPUT_CATALOG,
  ...FEEDBACK_CATALOG,
  ...MARKETING_CATALOG,
  ...MOCKUP_CATALOG,
  ...INTERACTIVE_CATALOG,
];

/** Catalog entries available on a given editor surface (page / site / email). */
export function catalogForSurface(surface: ComponentSurface): PlatformCatalogEntry[] {
  return PLATFORM_CATALOG.filter((e) => e.surfaces.includes(surface));
}

/** One entry by key, or undefined. */
export function findCatalogEntry(key: string): PlatformCatalogEntry | undefined {
  return PLATFORM_CATALOG.find((e) => e.key === key);
}

/** A category-grouped view for the palette, surface-filtered, skipping empties.
 *  Categories keep their declared order (CATALOG_CATEGORIES). */
export interface CatalogGroup {
  category: CatalogCategory;
  entries: PlatformCatalogEntry[];
}
export function catalogGroupsForSurface(surface: ComponentSurface): CatalogGroup[] {
  const available = catalogForSurface(surface);
  return CATALOG_CATEGORIES.map((category) => ({
    category,
    entries: available.filter((e) => e.category === category),
  })).filter((g) => g.entries.length > 0);
}

/** Summaries (no trees) — for any read surface that lists without stamping. */
export function catalogSummaries(): PlatformCatalogSummary[] {
  return PLATFORM_CATALOG.map(catalogSummary);
}
