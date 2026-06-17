'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-rest-client';
import type { ActionResult } from './rest-action';
import { restAction } from './rest-action';

// Inventory-count Server Actions (docs/100 P4). All go through the inventory
// module's own API namespace (/v1/inventory/counts, requireInventoryModule), so
// they work for a standalone WMS tenant. Mutations revalidate the list + the
// affected detail; the client components refresh after success. `approve` is the
// only admin-gated action (over-threshold sign-off) — the API enforces the role.

function revalidate(id?: string): void {
  revalidatePath('/inventory/counts');
  if (id) revalidatePath(`/inventory/counts/${id}`);
}

export async function createInventoryCountAction(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const result = await api.post<{ id: string }>('/v1/inventory/counts', input);
    revalidate(result.id);
    return result;
  });
}

export async function addCountLineAction(
  id: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const result = await api.post<{ id: string }>(`/v1/inventory/counts/${id}/lines`, input);
    revalidate(id);
    return result;
  });
}

export async function removeCountLineAction(
  id: string,
  lineId: string
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const result = await api.delete<{ id: string }>(`/v1/inventory/counts/${id}/lines/${lineId}`);
    revalidate(id);
    return result;
  });
}

export async function enterCountsAction(
  id: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const result = await api.post<{ id: string }>(`/v1/inventory/counts/${id}/entries`, input);
    revalidate(id);
    return result;
  });
}

async function transition(
  id: string,
  action: 'submit' | 'approve' | 'post' | 'cancel'
): Promise<{ id: string; status: string }> {
  const result = await api.post<{ id: string; status: string }>(
    `/v1/inventory/counts/${id}/${action}`,
    {}
  );
  revalidate(id);
  return result;
}

export async function submitCountAction(
  id: string
): Promise<ActionResult<{ id: string; status: string }>> {
  return restAction(() => transition(id, 'submit'));
}

export async function approveCountAction(
  id: string
): Promise<ActionResult<{ id: string; status: string }>> {
  return restAction(() => transition(id, 'approve'));
}

export async function postCountAction(
  id: string
): Promise<ActionResult<{ id: string; status: string }>> {
  return restAction(() => transition(id, 'post'));
}

export async function cancelCountAction(
  id: string
): Promise<ActionResult<{ id: string; status: string }>> {
  return restAction(() => transition(id, 'cancel'));
}
