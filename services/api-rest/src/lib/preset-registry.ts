// The platform module-preset registry + install seam.
//
// Assembled at the composition root (like module-provisioning.ts) so it can
// import every module's preset array without a dependency cycle. Today only
// commerce contributes presets; later waves push crm/cms/email/b2b/scheduling/
// invoicing arrays into the same registry — and industry starters (a later wave)
// resolve their member presets through `presetRegistry` too.
//
// The seam enforces the two locked provisioning invariants:
//   1. `installPreset` gates on the owning module being ENABLED — never stamps
//      config into a disabled module (CLAUDE.md "a disabled module stores no
//      rows").
//   2. `listInstallablePresets` self-filters to the tenant's enabled modules —
//      a content-only tenant never sees commerce presets.
// Neither path ever writes `settings.modules`; only the user flips a flag.

import {
  isModuleEnabled,
  listEnabledModules,
  ModulePresetRegistry,
  toModulePresetView,
  type ModulePresetKind,
  type ModulePresetView,
  type ModuleSlug,
} from '@sparx/auth';
import { commercePresets } from '@sparx/commerce';
import { b2bPresets, crmPresets, invoicingPresets } from '@sparx/crm';
import { withTenant, type TenantContext } from '@sparx/db';
import { conflict, moduleDisabled, notFound } from '@sparx/api-core/errors';

import { cmsPresets } from './presets/cms';
import { emailPresets } from './presets/email';
import { schedulingPresets } from './presets/scheduling';

/** Every module's presets, indexed by `${module}:${slug}`. Each module package
 *  contributes its array here at the composition root (like module-provisioning.ts),
 *  which keeps the dependency graph acyclic. Presets whose module package doesn't
 *  dep the contract (cms / scheduling / email) are authored here under ./presets. */
export const presetRegistry = new ModulePresetRegistry([
  ...commercePresets,
  ...crmPresets,
  ...b2bPresets,
  ...invoicingPresets,
  ...cmsPresets,
  ...schedulingPresets,
  ...emailPresets,
]);

/** Narrow the listing to one module and/or one preset kind (e.g. the fitment
 *  page asks for `{ module: 'commerce', kind: 'fitment' }`). */
export interface PresetListFilter {
  module?: ModuleSlug;
  kind?: ModulePresetKind;
}

/**
 * The presets installable for a tenant — filtered to its enabled modules (and
 * any requested module/kind), each tagged with whether it's already installed.
 * The per-preset installed checks run in ONE tenant-scoped transaction (they
 * compose into `ctx.tx`).
 */
export async function listInstallablePresets(
  ctx: TenantContext,
  filter: PresetListFilter = {}
): Promise<ModulePresetView[]> {
  const modules = await listEnabledModules(ctx.tenantId);
  const presets = presetRegistry
    .forModules(modules)
    .filter((preset) => (filter.module ? preset.module === filter.module : true))
    .filter((preset) => (filter.kind ? preset.kind === filter.kind : true));
  if (presets.length === 0) return [];

  return withTenant({ tenantId: ctx.tenantId, userId: ctx.userId }, async (tx) => {
    const scoped: TenantContext = { tenantId: ctx.tenantId, userId: ctx.userId, tx };
    const installed = await Promise.all(presets.map((preset) => preset.isInstalled(scoped)));
    return presets.map((preset, i) => toModulePresetView(preset, installed[i] ?? false));
  });
}

/**
 * Install one preset into a tenant via its real service path. Throws NOT_FOUND
 * for an unknown preset, MODULE_DISABLED if the owning module isn't active
 * (invariant #1), and CONFLICT (409) if the preset is already installed — the
 * guard lives here (one place) rather than in every preset's builder.
 */
export async function installPreset(
  ctx: TenantContext,
  module: ModuleSlug,
  slug: string
): Promise<{ id: string }> {
  const preset = presetRegistry.get(module, slug);
  if (!preset) throw notFound('ModulePreset', `${module}:${slug}`);

  const enabled = await isModuleEnabled(ctx.tenantId, module);
  if (!enabled) throw moduleDisabled(module);

  if (await preset.isInstalled(ctx)) {
    throw conflict(`"${preset.name}" is already installed`);
  }

  return preset.install(ctx);
}
