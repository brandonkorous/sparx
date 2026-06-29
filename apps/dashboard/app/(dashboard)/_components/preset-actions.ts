'use server';

// Cross-module module-preset actions — back the shared <PresetPicker>. They talk
// to the generic /v1/presets seam, which self-filters the listing to the
// tenant's enabled modules and gates each install on the owning module being
// active. The fitment page is the first consumer (browse + install fitment
// dictionaries); later surfaces (a settings/onboarding "browse your presets")
// reuse the same pair unchanged.

import { revalidatePath } from 'next/cache';
import { api, type ApiRestError } from '@/lib/api-rest-client';

export interface ModulePresetSummaryChip {
  label: string;
  tone?: 'module' | 'neutral';
}

export interface ModulePresetView {
  module: string;
  slug: string;
  kind: string;
  name: string;
  description: string;
  iconKey: string;
  tags: string[];
  summary: ModulePresetSummaryChip[];
  installed: boolean;
}

export type PresetActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

async function run<T>(fn: () => Promise<T>): Promise<PresetActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    const e = err as ApiRestError;
    return {
      ok: false,
      error: { code: e.code ?? 'INTERNAL_ERROR', message: e.message ?? 'Unexpected error' },
    };
  }
}

export interface PresetFilter {
  module?: string;
  kind?: string;
}

export async function listPresetsAction(
  filter: PresetFilter = {}
): Promise<PresetActionResult<ModulePresetView[]>> {
  const qs = new URLSearchParams();
  if (filter.module) qs.set('module', filter.module);
  if (filter.kind) qs.set('kind', filter.kind);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return run(async () => api.get<ModulePresetView[]>(`/v1/presets${suffix}`));
}

/** Install one preset; `revalidate` is the dashboard path to refresh on success
 *  (e.g. '/commerce/fitment'). */
export async function installPresetAction(
  module: string,
  slug: string,
  revalidate?: string
): Promise<PresetActionResult<{ id: string }>> {
  return run(async () => {
    const result = await api.post<{ id: string }>(`/v1/presets/${module}/${slug}/install`, {});
    if (revalidate) revalidatePath(revalidate);
    return result;
  });
}
