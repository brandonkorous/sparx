'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-rest-client';
import type { ActionResult } from './rest-action';
import { restAction } from './rest-action';

// Supplier + per-variant purchasing-link Server Actions (docs/100 P3a). All go
// through the inventory module's own API namespace (/v1/inventory/suppliers,
// requireInventoryModule), so they work for a standalone WMS tenant.

interface SupplierRow {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export async function createSupplierAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const result = await api.post<{ id: string }>('/v1/inventory/suppliers', input);
    revalidatePath('/inventory/suppliers');
    return result;
  });
}

export async function updateSupplierAction(
  supplierId: string,
  input: unknown
): Promise<ActionResult<SupplierRow>> {
  return restAction(async () => {
    const result = await api.patch<SupplierRow>(`/v1/inventory/suppliers/${supplierId}`, input);
    revalidatePath('/inventory/suppliers');
    revalidatePath(`/inventory/suppliers/${supplierId}`);
    return result;
  });
}

export async function archiveSupplierAction(
  supplierId: string
): Promise<ActionResult<{ ok: true }>> {
  return restAction(async () => {
    await api.delete<void>(`/v1/inventory/suppliers/${supplierId}`);
    revalidatePath('/inventory/suppliers');
    return { ok: true as const };
  });
}

interface SupplierVariantRow {
  id: string;
  variantId: string;
  supplierSku: string | null;
  unitCostCents: number | null;
  minOrderQty: number | null;
  isPreferred: boolean;
  variantSku: string | null;
  productTitle: string | null;
}

export async function upsertSupplierVariantAction(
  supplierId: string,
  input: unknown
): Promise<ActionResult<SupplierVariantRow>> {
  return restAction(async () => {
    const result = await api.put<SupplierVariantRow>(
      `/v1/inventory/suppliers/${supplierId}/variants`,
      input
    );
    revalidatePath(`/inventory/suppliers/${supplierId}`);
    return result;
  });
}

export async function removeSupplierVariantAction(
  supplierId: string,
  variantId: string
): Promise<ActionResult<{ ok: true }>> {
  return restAction(async () => {
    await api.delete<void>(`/v1/inventory/suppliers/${supplierId}/variants/${variantId}`);
    revalidatePath(`/inventory/suppliers/${supplierId}`);
    return { ok: true as const };
  });
}

export async function lookupVariantBySkuAction(
  sku: string
): Promise<ActionResult<{ variantId: string; sku: string; productTitle: string | null }>> {
  return restAction(async () =>
    api.get<{ variantId: string; sku: string; productTitle: string | null }>(
      `/v1/inventory/suppliers/variant-lookup?sku=${encodeURIComponent(sku)}`
    )
  );
}
