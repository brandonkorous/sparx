'use server';

// Server actions for the Marketplace's Blueprints category (docs/54). Install
// provisions a
// whole themed site onto the ACTIVE property (the api-rest endpoint resolves it
// from the forwarded x-sparx-property-id cookie); go-live publishes everything
// the install created. Both are admin-gated in api-rest.

import 'server-only';
import { revalidatePath } from 'next/cache';

import { api, type ApiRestError } from '@/lib/api-rest-client';

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

export async function installBlueprintAction(
  key: string
): Promise<ActionResult<{ install_id: string; counts: Record<string, number> }>> {
  try {
    const data = await api.post<{ install_id: string; counts: Record<string, number> }>(
      `/v1/blueprints/${encodeURIComponent(key)}/install`
    );
    revalidatePath('/marketplace');
    revalidatePath('/builder/blueprints');
    return { ok: true, data };
  } catch (err) {
    const e = err as ApiRestError;
    return { ok: false, error: { message: e.message ?? 'Install failed.' } };
  }
}

export async function goLiveAction(
  installId: string
): Promise<ActionResult<{ id: string; status: string }>> {
  try {
    const data = await api.post<{ id: string; status: string }>(
      `/v1/blueprints/installs/${encodeURIComponent(installId)}/go-live`
    );
    revalidatePath('/marketplace');
    revalidatePath('/builder/blueprints');
    return { ok: true, data };
  } catch (err) {
    const e = err as ApiRestError;
    return { ok: false, error: { message: e.message ?? 'Go-live failed.' } };
  }
}

// Apply a marketplace THEME to the active site (docs/60 §10, D11 — active-site
// only). The theme's slug IS the @sparx/site-themes preset key, so this is the
// same call the Brand & Theme editor's "select theme" makes: it loads the preset
// into the active property's DRAFT (x-sparx-property-id is forwarded by the
// client). Nothing goes live until the tenant reviews + publishes in the editor.
export async function applyThemeAction(slug: string): Promise<ActionResult<{ themeKey: string }>> {
  try {
    await api.put<unknown>('/v1/sitebuilder/config/theme', { themeKey: slug });
    revalidatePath('/marketplace');
    revalidatePath('/builder', 'layout');
    return { ok: true, data: { themeKey: slug } };
  } catch (err) {
    const e = err as ApiRestError;
    return { ok: false, error: { message: e.message ?? 'Could not apply theme.' } };
  }
}

// Reset & reinstall (docs/54 D8): tears down everything the install created and
// deletes the install row, so the blueprint can be installed fresh. Destructive —
// the card gates it behind a confirm.
export async function resetBlueprintAction(
  installId: string
): Promise<ActionResult<{ id: string; status: string }>> {
  try {
    const data = await api.post<{ id: string; status: string }>(
      `/v1/blueprints/installs/${encodeURIComponent(installId)}/reset`
    );
    revalidatePath('/marketplace');
    revalidatePath('/builder/blueprints');
    return { ok: true, data };
  } catch (err) {
    const e = err as ApiRestError;
    return { ok: false, error: { message: e.message ?? 'Reset failed.' } };
  }
}
