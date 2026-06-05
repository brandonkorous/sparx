'use server';

// Server actions for the Templates marketplace (docs/54). Install provisions a
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
    revalidatePath('/templates');
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
    revalidatePath('/templates');
    return { ok: true, data };
  } catch (err) {
    const e = err as ApiRestError;
    return { ok: false, error: { message: e.message ?? 'Go-live failed.' } };
  }
}
