'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-rest-client';
import type { ActionResult } from './rest-action';
import { restAction } from './rest-action';

// Purchase-order Server Actions (docs/100 P3b). All go through the inventory
// module's own API namespace (/v1/inventory/purchase-orders, requireInventory
// Module), so they work for a standalone WMS tenant. Mutations revalidate the
// list + the affected detail; the client components refresh after success.

export async function createPurchaseOrderAction(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const result = await api.post<{ id: string }>('/v1/inventory/purchase-orders', input);
    revalidatePath('/inventory/purchase-orders');
    return result;
  });
}

export async function updatePurchaseOrderAction(
  id: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const result = await api.patch<{ id: string }>(`/v1/inventory/purchase-orders/${id}`, input);
    revalidatePath('/inventory/purchase-orders');
    revalidatePath(`/inventory/purchase-orders/${id}`);
    return result;
  });
}

export async function deletePurchaseOrderAction(id: string): Promise<ActionResult<{ ok: true }>> {
  return restAction(async () => {
    await api.delete<void>(`/v1/inventory/purchase-orders/${id}`);
    revalidatePath('/inventory/purchase-orders');
    return { ok: true as const };
  });
}

async function transition(
  id: string,
  action: 'submit' | 'cancel' | 'close',
  body: unknown
): Promise<{ id: string; status: string }> {
  const result = await api.post<{ id: string; status: string }>(
    `/v1/inventory/purchase-orders/${id}/${action}`,
    body
  );
  revalidatePath('/inventory/purchase-orders');
  revalidatePath(`/inventory/purchase-orders/${id}`);
  return result;
}

export async function submitPurchaseOrderAction(
  id: string,
  input: unknown = {}
): Promise<ActionResult<{ id: string; status: string }>> {
  return restAction(() => transition(id, 'submit', input));
}

export async function cancelPurchaseOrderAction(
  id: string
): Promise<ActionResult<{ id: string; status: string }>> {
  return restAction(() => transition(id, 'cancel', {}));
}

export async function closePurchaseOrderAction(
  id: string
): Promise<ActionResult<{ id: string; status: string }>> {
  return restAction(() => transition(id, 'close', {}));
}

export async function addPurchaseOrderLineAction(
  id: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const result = await api.post<{ id: string }>(
      `/v1/inventory/purchase-orders/${id}/lines`,
      input
    );
    revalidatePath(`/inventory/purchase-orders/${id}`);
    return result;
  });
}

export async function updatePurchaseOrderLineAction(
  id: string,
  lineId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const result = await api.patch<{ id: string }>(
      `/v1/inventory/purchase-orders/${id}/lines/${lineId}`,
      input
    );
    revalidatePath(`/inventory/purchase-orders/${id}`);
    return result;
  });
}

export async function removePurchaseOrderLineAction(
  id: string,
  lineId: string
): Promise<ActionResult<{ ok: true }>> {
  return restAction(async () => {
    await api.delete<void>(`/v1/inventory/purchase-orders/${id}/lines/${lineId}`);
    revalidatePath(`/inventory/purchase-orders/${id}`);
    return { ok: true as const };
  });
}
