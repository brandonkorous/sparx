'use server';

// Server Actions for the Automations surface. Each is a thin call into the
// `/v1/automations` REST surface (docs/84 Slice G-API) wrapped in `restAction`,
// so the api-rest service layer stays the single authoring path (the same one
// MCP uses). The tier guard surfaces as `AUTOMATION_LOCKED` (409) — the form/list
// components read `result.error.code` to offer "Duplicate to edit".
//
// Reads (list / detail / runs) are done directly in the server pages via `api`;
// these actions are only the mutation path + the revalidation that follows.

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-rest-client';
import type {
  AutomationStatus,
  CreateAutomationInput,
  UpdateAutomationInput,
} from '@sparx/automation-schemas';
import type { ActionResult } from './_lib/rest-action';
import { restAction } from './_lib/rest-action';
import type { AutomationDto, AutomationVersionDto } from './_lib/types';

export async function createAutomationAction(
  input: CreateAutomationInput
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const created = await api.post<AutomationDto>('/v1/automations', input);
    revalidatePath('/automations');
    return { id: created.id };
  });
}

export async function updateAutomationAction(
  id: string,
  input: UpdateAutomationInput
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const updated = await api.patch<AutomationDto>(`/v1/automations/${id}`, input);
    revalidatePath('/automations');
    revalidatePath(`/automations/${id}`);
    return { id: updated.id };
  });
}

export async function setAutomationStatusAction(
  id: string,
  status: AutomationStatus
): Promise<ActionResult<{ id: string; status: string }>> {
  return restAction(async () => {
    const updated = await api.post<AutomationDto>(`/v1/automations/${id}/status`, { status });
    revalidatePath('/automations');
    revalidatePath(`/automations/${id}`);
    return { id: updated.id, status: updated.status };
  });
}

// ─── Versioning (docs/84 Slice G-versioning) ─────────────────────────────────

export async function publishAutomationAction(
  id: string,
  note?: string
): Promise<ActionResult<{ id: string; version: number }>> {
  return restAction(async () => {
    const published = await api.post<AutomationDto>(
      `/v1/automations/${id}/publish`,
      note ? { note } : {}
    );
    revalidatePath('/automations');
    revalidatePath(`/automations/${id}`);
    return { id: published.id, version: published.version };
  });
}

export async function discardDraftAction(id: string): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const updated = await api.post<AutomationDto>(`/v1/automations/${id}/discard-draft`, {});
    revalidatePath('/automations');
    revalidatePath(`/automations/${id}`);
    return { id: updated.id };
  });
}

/** Restore a prior version into the draft; returns the restored draft document so
 *  the editor can load it as the working state (the tenant then publishes). */
export async function restoreAutomationVersionAction(
  id: string,
  version: number
): Promise<ActionResult<AutomationDto>> {
  return restAction(async () => {
    const updated = await api.post<AutomationDto>(`/v1/automations/${id}/restore`, { version });
    revalidatePath(`/automations/${id}`);
    return updated;
  });
}

export async function listAutomationVersionsAction(
  id: string
): Promise<ActionResult<AutomationVersionDto[]>> {
  return restAction(async () => {
    return api.get<AutomationVersionDto[]>(`/v1/automations/${id}/versions`);
  });
}

export async function cloneAutomationAction(
  id: string,
  name?: string
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const clone = await api.post<AutomationDto>(
      `/v1/automations/${id}/clone`,
      name ? { name } : {}
    );
    revalidatePath('/automations');
    return { id: clone.id };
  });
}

export async function deleteAutomationAction(id: string): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    await api.delete<{ id: string; deleted: boolean }>(`/v1/automations/${id}`);
    revalidatePath('/automations');
    return { id };
  });
}
