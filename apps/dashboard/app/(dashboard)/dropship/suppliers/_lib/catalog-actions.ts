'use server';

import { api } from '@/lib/api-rest-client';

export async function importSupplierProduct(
  supplierId: string,
  productId: string
): Promise<{ error?: string }> {
  try {
    await api.post(`/v1/dropship/suppliers/${supplierId}/catalog/${productId}/import`, {});
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Import failed' };
  }
}

// Re-sync an already-imported product: refreshes availability + backfills the
// supplier's images on the existing commerce product (no duplicate). `imagesAdded`
// lets the UI tell the merchant what changed.
export async function resyncSupplierProduct(
  supplierId: string,
  productId: string
): Promise<{ imagesAdded?: number; error?: string }> {
  try {
    const res = await api.post<{ productId: string; imagesAdded: number }>(
      `/v1/dropship/suppliers/${supplierId}/catalog/${productId}/reimport`,
      {}
    );
    return { imagesAdded: res.imagesAdded };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Re-sync failed' };
  }
}
