// Module presets — the reusable per-module install seam.
//
// A *module preset* is one installable, data-as-code configuration pack scoped to
// a single module: a fitment dictionary, a sales-tax zone set, a CRM pipeline, a
// category taxonomy, a welcome-email series, … Each provisions ONE module's
// config into a tenant, idempotently and audit-logged, via the real service path
// (dogfood — never a side-channel write).
//
// This file owns only the CONTRACT + a pure registry index. It lives in
// @sparx/modules (alongside the enablement primitives) because it must stay
// dependency-light — it carries NO module-package closure. The AGGREGATED
// registry (which imports every module's preset array) is assembled at the
// composition root (api-rest), exactly like module-provisioning.ts, to keep the
// dependency graph acyclic.
//
// Two relationships bind every consumer:
//   1. Nothing but the user flips a module flag — a preset NEVER writes
//      `settings.modules`. It provisions config into an ALREADY-enabled module.
//   2. Provision only into enabled modules — the install seam refuses a preset
//      whose module is off (CLAUDE.md "a disabled module stores no rows").
//
// `install(ctx)` receives a TenantContext that MAY carry an open, tenant-scoped
// `tx` (see @sparx/db withTenant): an à-la-carte install passes none and the
// preset opens its own transaction; an industry starter (a later wave) opens ONE
// transaction and threads it through several presets so the whole kit commits
// atomically.

import { withTenant, type TenantContext, type TxClient } from '@sparx/db';

import type { ModuleSlug } from './index';

/** Grouping/filter hint for the picker — lets a module surface (e.g. the fitment
 *  page) show only its own kind of preset while the cross-module browse surface
 *  shows them all. Open-ended by design; each module owns its kinds. The set
 *  below tracks the planned per-module presets (one preset family per kind). */
export type ModulePresetKind =
  | 'fitment'
  | 'tax'
  | 'shipping'
  | 'categories'
  | 'collections'
  | 'markup'
  | 'surcharge'
  | 'pipeline'
  | 'segments'
  | 'content-types'
  | 'taxonomy'
  | 'navigation'
  | 'email-campaign'
  | 'b2b-pricing'
  | 'b2b-terms'
  | 'b2b-approval'
  | 'scheduling'
  | 'invoicing'
  | 'payments'
  | 'ai-prompts';

/** A single picker chip summarizing the pack's shape/scale, e.g.
 *  `{ label: 'Make → Model → Engine · Year' }` or `{ label: '4 makes',
 *  tone: 'module' }`. `module` tone tints the chip with the owning module's hue. */
export interface ModulePresetSummaryChip {
  label: string;
  tone?: 'module' | 'neutral';
}

/** The result of stamping a preset — the primary entity id created (e.g. the
 *  fitment domain id), so callers can deep-link to what they just installed. */
export interface ModulePresetInstallResult {
  id: string;
}

/** One installable, per-module configuration pack (data-as-code). Authored once
 *  per module package, referenced by the à-la-carte picker AND (later) by
 *  industry starters. */
export interface ModulePreset {
  /** Owning module — the install seam gates on this being enabled. */
  module: ModuleSlug;
  /** Unique within its module. The registry key is `${module}:${slug}`. */
  slug: string;
  /** Grouping/filter hint (see ModulePresetKind). */
  kind: ModulePresetKind;
  name: string;
  description: string;
  /** lucide-react icon key, resolved client-side by the picker. */
  iconKey: string;
  /** Free-form discovery tags (industry, synonyms). */
  tags: string[];
  /** Picker chips summarizing the pack's shape/scale. */
  summary: ModulePresetSummaryChip[];
  /** Whether this pack is already present for the tenant. Drives the picker's
   *  "Installed" state AND lets a starter skip-if-present for batch idempotency.
   *  MUST be a cheap, indexed read; composes into `ctx.tx` when one is supplied. */
  isInstalled(ctx: TenantContext): Promise<boolean>;
  /** Stamp the pack into the tenant via the module's real service path. MUST be
   *  tenant-scoped, audit-logged, and slug-conflict aware. Composes into
   *  `ctx.tx` when supplied (atomic multi-preset starter installs). */
  install(ctx: TenantContext): Promise<ModulePresetInstallResult>;
}

/** The dashboard-facing projection of a preset (no functions, plus the resolved
 *  installed flag). Sent over the wire by the `/v1/presets` endpoint. */
export interface ModulePresetView {
  module: ModuleSlug;
  slug: string;
  kind: ModulePresetKind;
  name: string;
  description: string;
  iconKey: string;
  tags: string[];
  summary: ModulePresetSummaryChip[];
  installed: boolean;
}

/** Pure, in-memory index over a fixed preset list. Constructed once at the
 *  composition root from every module's preset array. Holds no DB/IO — the
 *  install/isInstalled functions on each preset do the work. */
export class ModulePresetRegistry {
  private readonly byKey = new Map<string, ModulePreset>();

  constructor(presets: ModulePreset[]) {
    for (const preset of presets) {
      const key = registryKey(preset.module, preset.slug);
      if (this.byKey.has(key)) {
        throw new Error(`Duplicate module preset: ${key}`);
      }
      this.byKey.set(key, preset);
    }
  }

  /** Every registered preset. */
  all(): ModulePreset[] {
    return [...this.byKey.values()];
  }

  /** Presets whose module is in `modules` — the tenant's enabled set. */
  forModules(modules: readonly ModuleSlug[]): ModulePreset[] {
    const enabled = new Set(modules);
    return this.all().filter((preset) => enabled.has(preset.module));
  }

  /** Resolve one preset by `(module, slug)`, or undefined if unknown. */
  get(module: ModuleSlug, slug: string): ModulePreset | undefined {
    return this.byKey.get(registryKey(module, slug));
  }
}

/** Author one module preset from a marker + an atomic builder — the shared
 *  authoring shape every module package uses (commerce, crm, cms, …). The
 *  builder runs inside ONE tenant-scoped transaction whose ctx carries the open
 *  `tx`, so every service call it makes composes atomically (no partial install).
 *  The "already installed → 409" guard lives in the install seam (it checks
 *  `isInstalled` before calling `install`), so the builder just builds. */
export function definePreset(spec: {
  module: ModuleSlug;
  slug: string;
  kind: ModulePresetKind;
  name: string;
  description: string;
  iconKey: string;
  tags: string[];
  summary: ModulePresetSummaryChip[];
  /** Cheap, indexed read — true ⇒ already installed. Runs on the caller's tx. */
  marker: (tx: TxClient, tenantId: string) => Promise<boolean>;
  /** Stamp the rows; `sx` carries the open tenant tx so service calls compose. */
  build: (sx: TenantContext) => Promise<{ id: string }>;
}): ModulePreset {
  return {
    module: spec.module,
    slug: spec.slug,
    kind: spec.kind,
    name: spec.name,
    description: spec.description,
    iconKey: spec.iconKey,
    tags: spec.tags,
    summary: spec.summary,
    isInstalled: (ctx) => withTenant(ctx, (tx) => spec.marker(tx, ctx.tenantId)),
    install: (ctx) => withTenant(ctx, (tx) => spec.build({ ...ctx, tx })),
  };
}

/** Project a preset to its wire view, folding in the resolved installed flag. */
export function toModulePresetView(preset: ModulePreset, installed: boolean): ModulePresetView {
  return {
    module: preset.module,
    slug: preset.slug,
    kind: preset.kind,
    name: preset.name,
    description: preset.description,
    iconKey: preset.iconKey,
    tags: preset.tags,
    summary: preset.summary,
    installed,
  };
}

function registryKey(module: ModuleSlug, slug: string): string {
  return `${module}:${slug}`;
}
