// Industry starters — the second provisioning tier over module presets.
//
// A *module preset* (presets.ts) installs ONE module's config pack. An *industry
// starter* is a named vertical (apparel, food, salon, wholesale, …) that COMPOSES
// presets across modules: installing it stamps each referenced preset whose module
// is enabled, records the tenant's chosen industry (`settings.industry`), and skips
// the slices for disabled modules. Re-installing after enabling a module backfills
// it (the install is idempotent — each preset's marker guards a re-stamp).
//
// This file owns only the CONTRACT + a pure registry index, kept dependency-light
// in @sparx/modules (no module-package closure). The starter DEFINITIONS and the
// install seam live at the composition root (api-rest lib/industry-starters.ts),
// where they can resolve each ref through the aggregated `presetRegistry` — the
// same acyclic-deps split as the preset registry itself.
//
// Locked invariants this tier honors (see presets.ts):
//   1. A starter NEVER writes `settings.modules` — only the user flips a module
//      flag. It writes `settings.industry` (the chosen vertical) and provisions
//      config into ALREADY-enabled modules.
//   2. A slice for a disabled module inserts NOTHING (CLAUDE.md "a disabled module
//      stores no rows").

import type { ModuleSlug } from './index';

/** A reference from a starter to one module preset, by `(module, slug)`. Resolved
 *  through the aggregated `presetRegistry` at install time. */
export interface IndustryStarterPresetRef {
  module: ModuleSlug;
  slug: string;
}

/** One installable industry pack (data-as-code). References module presets only —
 *  it carries no install logic of its own; the seam resolves + stamps the refs. */
export interface IndustryStarter {
  /** Unique vertical key, stored in `tenants.settings.industry`. */
  slug: string;
  name: string;
  description: string;
  /** lucide-react icon key, resolved client-side by the picker. */
  iconKey: string;
  /** Free-form discovery tags (synonyms, sub-verticals). */
  tags: string[];
  /** The module presets this starter stamps (those whose module is enabled). */
  presets: IndustryStarterPresetRef[];
}

/** The dashboard-facing projection of a starter, resolved against the tenant's
 *  enabled modules + current industry. Sent over the wire by the
 *  `/v1/industry-starters` endpoint. */
export interface IndustryStarterView {
  slug: string;
  name: string;
  description: string;
  iconKey: string;
  tags: string[];
  /** Distinct modules this starter touches. */
  modules: ModuleSlug[];
  /** Of those, the ones currently enabled for the tenant (the rest are skipped). */
  enabledModules: ModuleSlug[];
  /** Presets that WOULD install for the tenant (their module is enabled). */
  applicablePresetCount: number;
  /** Every preset the starter references (across all modules). */
  totalPresetCount: number;
  /** Whether this is the tenant's currently-selected industry. */
  active: boolean;
}

/** Pure, in-memory index over a fixed starter list. Constructed once at the
 *  composition root. Holds no DB/IO. */
export class IndustryStarterRegistry {
  private readonly bySlug = new Map<string, IndustryStarter>();

  constructor(starters: IndustryStarter[]) {
    for (const starter of starters) {
      if (this.bySlug.has(starter.slug)) {
        throw new Error(`Duplicate industry starter: ${starter.slug}`);
      }
      this.bySlug.set(starter.slug, starter);
    }
  }

  /** Every registered starter, in declaration order. */
  all(): IndustryStarter[] {
    return [...this.bySlug.values()];
  }

  /** Resolve one starter by slug, or undefined if unknown. */
  get(slug: string): IndustryStarter | undefined {
    return this.bySlug.get(slug);
  }
}

/** The distinct modules a starter touches, in first-reference order. */
export function starterModules(starter: IndustryStarter): ModuleSlug[] {
  const seen = new Set<ModuleSlug>();
  const out: ModuleSlug[] = [];
  for (const ref of starter.presets) {
    if (!seen.has(ref.module)) {
      seen.add(ref.module);
      out.push(ref.module);
    }
  }
  return out;
}

/** Project a starter to its wire view against the tenant's enabled modules and
 *  current industry. Pure — no per-preset installed check (the install is
 *  idempotent and skips already-present packs), so this stays a cheap read. */
export function toIndustryStarterView(
  starter: IndustryStarter,
  enabledModules: readonly ModuleSlug[],
  active: boolean
): IndustryStarterView {
  const enabled = new Set(enabledModules);
  const modules = starterModules(starter);
  return {
    slug: starter.slug,
    name: starter.name,
    description: starter.description,
    iconKey: starter.iconKey,
    tags: starter.tags,
    modules,
    enabledModules: modules.filter((m) => enabled.has(m)),
    applicablePresetCount: starter.presets.filter((p) => enabled.has(p.module)).length,
    totalPresetCount: starter.presets.length,
    active,
  };
}
