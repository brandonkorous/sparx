// Thin commerce wrapper over the shared `definePreset` (in @wizeworks/modules) —
// just pins `module: 'commerce'` so the family files (tax, shipping, …) stay
// terse. You supply a cheap `marker` (used for the picker's "Installed" state
// AND the seam's re-install 409 guard) and a `build` that stamps the rows inside
// one tenant-scoped transaction (its ctx carries the open tx, so every
// taxService.createZone / … call composes atomically).

// The preset contract is imported from @wizeworks/auth (a commerce dep that
// re-exports @wizeworks/modules) — packages that don't dep auth import the same
// symbols from @wizeworks/modules directly.
import { definePreset, type ModulePreset, type ModulePresetKind } from '@wizeworks/auth';
import type { ModulePresetSummaryChip } from '@wizeworks/auth';
import type { TenantContext, TxClient } from '@wizeworks/db';

export interface CommercePresetSpec {
  slug: string;
  kind: ModulePresetKind;
  name: string;
  description: string;
  iconKey: string;
  tags: string[];
  summary: ModulePresetSummaryChip[];
  marker: (tx: TxClient, tenantId: string) => Promise<boolean>;
  build: (sx: TenantContext) => Promise<{ id: string }>;
}

export function commercePreset(spec: CommercePresetSpec): ModulePreset {
  return definePreset({ module: 'commerce', ...spec });
}
