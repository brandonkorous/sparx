'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-rest-client';
import type { ActionResult } from './rest-action';
import { restAction } from './rest-action';

// Inventory module Server Actions — warehouses, levels/adjustments, lots/serials.
// All go through the inventory module's own API namespace (/v1/inventory/*,
// requireInventoryModule), so they work for a standalone WMS tenant with no
// commerce. The commerce product editor's Inventory tab calls the same actions
// (inventory rides free with Commerce, so the gate passes — docs/100 P1e).

// ─── Warehouses ───────────────────────────────────────────────────────

interface WarehouseRow {
  id: string;
  name: string;
  code: string;
  isDefault: boolean;
  archivedAt: string | null;
}

export async function listWarehousesAction(filter?: {
  includeInactive?: boolean;
}): Promise<ActionResult<WarehouseRow[]>> {
  return restAction(async () => {
    const q = new URLSearchParams();
    if (filter?.includeInactive) q.set('include_archived', 'true');
    return api.get<WarehouseRow[]>(`/v1/inventory/locations?${q.toString()}`);
  });
}

export async function createWarehouseAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const result = await api.post<{ id: string }>('/v1/inventory/locations', input);
    revalidatePath('/inventory/warehouses');
    revalidatePath('/inventory/stock');
    return result;
  });
}

export async function updateWarehouseAction(
  warehouseId: string,
  input: unknown
): Promise<ActionResult<WarehouseRow>> {
  return restAction(async () => {
    const result = await api.patch<WarehouseRow>(`/v1/inventory/locations/${warehouseId}`, input);
    revalidatePath('/inventory/warehouses');
    revalidatePath(`/inventory/warehouses/${warehouseId}`);
    revalidatePath('/inventory/stock');
    return result;
  });
}

export async function archiveWarehouseAction(
  warehouseId: string
): Promise<ActionResult<{ ok: true }>> {
  return restAction(async () => {
    await api.delete<void>(`/v1/inventory/locations/${warehouseId}`);
    revalidatePath('/inventory/warehouses');
    revalidatePath('/inventory/stock');
    return { ok: true as const };
  });
}

// ─── Inventory levels + adjustments ──────────────────────────────────

export async function adjustInventoryAction(
  input: unknown
): Promise<ActionResult<{ levelAfter: number }>> {
  return restAction(async () => {
    const result = await api.post<{ levelAfter: number }>('/v1/inventory/adjust', input);
    revalidatePath('/inventory/stock');
    revalidatePath('/commerce/products');
    return result;
  });
}

export async function setReorderPolicyAction(input: unknown): Promise<ActionResult<{ ok: true }>> {
  return restAction(async () => {
    await api.post<{ updated: boolean }>('/v1/inventory/reorder-policy', input);
    revalidatePath('/inventory/stock');
    return { ok: true as const };
  });
}

export async function transferInventoryAction(input: unknown): Promise<ActionResult<{ ok: true }>> {
  return restAction(async () => {
    await api.post<{ transferred: boolean }>('/v1/inventory/transfer', input);
    revalidatePath('/inventory/stock');
    return { ok: true as const };
  });
}

// ─── Lot + serial ─────────────────────────────────────────────────────

export async function createLotBatchAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const result = await api.post<{ id: string }>('/v1/inventory/lots', input);
    revalidatePath('/inventory/lots');
    return result;
  });
}

export async function createSerialUnitAction(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const result = await api.post<{ id: string }>('/v1/inventory/serials', input);
    revalidatePath('/inventory/lots');
    return result;
  });
}

export async function initiateRecallAction(
  input: unknown
): Promise<ActionResult<{ recallId: string }>> {
  return restAction(async () => {
    const result = await api.post<{ recallId: string }>('/v1/inventory/recalls', input);
    revalidatePath('/inventory/lots');
    return result;
  });
}
