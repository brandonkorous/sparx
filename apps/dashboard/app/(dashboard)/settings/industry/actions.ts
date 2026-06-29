'use server';

// Industry-starter actions — back the settings → Industry picker. They talk to
// the /v1/industry-starters seam, which composes module presets for a vertical:
// installing one stamps each preset whose module is enabled and records
// `settings.industry`. The page reads the list directly via `api.get`; this action
// performs the install (admin+ — it provisions across modules, like the Modules
// toggle and blueprint install).

import { revalidatePath } from 'next/cache';
import { api, type ApiRestError } from '@/lib/api-rest-client';

export interface IndustryStarterPresetRef {
  module: string;
  slug: string;
}

export interface IndustryStarterView {
  slug: string;
  name: string;
  description: string;
  iconKey: string;
  tags: string[];
  /** Distinct modules this starter touches. */
  modules: string[];
  /** Of those, the ones currently enabled for the tenant. */
  enabledModules: string[];
  /** Presets that would install (their module is enabled). */
  applicablePresetCount: number;
  /** Every preset the starter references. */
  totalPresetCount: number;
  /** Whether this is the tenant's currently-selected industry. */
  active: boolean;
}

export interface InstallStarterResult {
  slug: string;
  installed: IndustryStarterPresetRef[];
  alreadyInstalled: IndustryStarterPresetRef[];
  skipped: IndustryStarterPresetRef[];
}

export type IndustryActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export async function installIndustryStarterAction(
  slug: string
): Promise<IndustryActionResult<InstallStarterResult>> {
  try {
    const data = await api.post<InstallStarterResult>(`/v1/industry-starters/${slug}/install`, {});
    revalidatePath('/settings/industry');
    return { ok: true, data };
  } catch (err) {
    const e = err as ApiRestError;
    return {
      ok: false,
      error: { code: e.code ?? 'INTERNAL_ERROR', message: e.message ?? 'Unexpected error' },
    };
  }
}
