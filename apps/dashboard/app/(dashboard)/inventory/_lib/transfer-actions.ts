'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-rest-client';
import type { ActionResult } from './rest-action';
import { restAction } from './rest-action';

// Inventory-transfer Server Actions (docs/100 P4). All go through the inventory
// module's own API namespace (/v1/inventory/transfers, requireInventoryModule), so
// they work for a standalone WMS tenant. Mutations revalidate the list + the
// affected detail; the client components refresh after success. Ship/receive/cancel
// move stock through the in-transit holding location via the ledger.

function revalidate(id?: string): void {
  revalidatePath('/inventory/transfers');
  if (id) revalidatePath(`/inventory/transfers/${id}`);
}

export async function createInventoryTransferAction(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const result = await api.post<{ id: string }>('/v1/inventory/transfers', input);
    revalidate(result.id);
    return result;
  });
}

export async function addTransferLineAction(
  id: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const result = await api.post<{ id: string }>(`/v1/inventory/transfers/${id}/lines`, input);
    revalidate(id);
    return result;
  });
}

export async function updateTransferLineAction(
  id: string,
  lineId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const result = await api.patch<{ id: string }>(
      `/v1/inventory/transfers/${id}/lines/${lineId}`,
      input
    );
    revalidate(id);
    return result;
  });
}

export async function removeTransferLineAction(
  id: string,
  lineId: string
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const result = await api.delete<{ id: string }>(
      `/v1/inventory/transfers/${id}/lines/${lineId}`
    );
    revalidate(id);
    return result;
  });
}

export async function deleteTransferAction(id: string): Promise<ActionResult<{ ok: true }>> {
  return restAction(async () => {
    await api.delete<void>(`/v1/inventory/transfers/${id}`);
    revalidate();
    return { ok: true as const };
  });
}

export async function shipTransferAction(
  id: string
): Promise<ActionResult<{ id: string; status: string }>> {
  return restAction(async () => {
    const result = await api.post<{ id: string; status: string }>(
      `/v1/inventory/transfers/${id}/ship`,
      {}
    );
    revalidate(id);
    return result;
  });
}

export async function receiveTransferAction(
  id: string,
  input: unknown
): Promise<ActionResult<{ id: string; status: string }>> {
  return restAction(async () => {
    const result = await api.post<{ id: string; status: string }>(
      `/v1/inventory/transfers/${id}/receive`,
      input
    );
    revalidate(id);
    return result;
  });
}

export async function cancelTransferAction(
  id: string
): Promise<ActionResult<{ id: string; status: string }>> {
  return restAction(async () => {
    const result = await api.post<{ id: string; status: string }>(
      `/v1/inventory/transfers/${id}/cancel`,
      {}
    );
    revalidate(id);
    return result;
  });
}
