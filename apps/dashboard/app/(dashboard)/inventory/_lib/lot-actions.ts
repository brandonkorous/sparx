'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-rest-client';
import type { ActionResult } from './rest-action';
import { restAction } from './rest-action';

// Lot / serial Server Actions (docs/100 P4d). All go through the inventory module's
// own API namespace (/v1/inventory/lots + /serials + /recalls,
// requireInventoryModule), so they work for a standalone WMS tenant. Mutations
// revalidate the lots list + the affected lot detail.

function revalidate(lotId?: string): void {
  revalidatePath('/inventory/lots');
  if (lotId) revalidatePath(`/inventory/lots/${lotId}`);
}

export async function createLotBatchAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const result = await api.post<{ id: string }>('/v1/inventory/lots', input);
    revalidate(result.id);
    return result;
  });
}

export async function createSerialUnitAction(
  lotId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const result = await api.post<{ id: string }>('/v1/inventory/serials', input);
    revalidate(lotId);
    return result;
  });
}

export async function updateSerialStatusAction(
  lotId: string,
  serialId: string,
  status: string
): Promise<ActionResult<{ id: string; status: string }>> {
  return restAction(async () => {
    const result = await api.patch<{ id: string; status: string }>(
      `/v1/inventory/serials/${serialId}`,
      { status }
    );
    revalidate(lotId);
    return result;
  });
}

export async function initiateRecallAction(
  lotId: string,
  reason: string,
  notifyCustomers: boolean
): Promise<ActionResult<{ affectedSerialUnits: number; affectedLotBatches: number }>> {
  return restAction(async () => {
    const result = await api.post<{ affectedSerialUnits: number; affectedLotBatches: number }>(
      '/v1/inventory/recalls',
      { lotBatchIds: [lotId], reason, notifyCustomers }
    );
    revalidate(lotId);
    return result;
  });
}

export async function clearRecallAction(lotId: string): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const result = await api.post<{ id: string }>(`/v1/inventory/lots/${lotId}/clear-recall`, {});
    revalidate(lotId);
    return result;
  });
}
