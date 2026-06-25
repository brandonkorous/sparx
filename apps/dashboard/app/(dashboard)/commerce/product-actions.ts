'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-rest-client';
import { listProperties } from '@/lib/sites';
import type { ActionResult } from './_action-helpers';
import { restAction } from './_rest-action';
import type {
  BulkPriceApplyResult,
  BulkPricePreview,
  PriceAdjustment,
} from './products/_lib/bulk-price-types';

export interface SiteOption {
  id: string;
  name: string;
  isPrimary: boolean;
}

// The tenant's web properties for the product wizard's visibility control
// (docs/49 §3 Model B: empty propertyIds = visible on all sites).
export async function listSitesAction(): Promise<ActionResult<SiteOption[]>> {
  return restAction(async () => {
    const props = await listProperties();
    return props.map((p) => ({ id: p.id, name: p.name, isPrimary: p.isPrimary }));
  });
}

export async function createProductAction(
  input: unknown
): Promise<ActionResult<{ id: string; handle: string }>> {
  return restAction(async () => {
    const result = await api.post<{ id: string; handle: string }>('/v1/commerce/products', input);
    revalidatePath('/commerce/products');
    return result;
  });
}

export async function updateProductAction(
  productId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const product = await api.patch<{ id: string }>(`/v1/commerce/products/${productId}`, input);
    revalidatePath('/commerce/products');
    revalidatePath(`/commerce/products/${productId}`);
    return { id: product.id };
  });
}

// Mint a short-lived draft-preview token + return the URL parts the button
// needs to build `<slug>.sparx.zone/products/<handle>?sparxPreview=<token>`.
export async function mintProductPreviewUrl(
  productId: string
): Promise<ActionResult<{ token: string; handle: string; expiresAt: string }>> {
  return restAction(async () => {
    const data = await api.post<{ token: string; handle: string; expires_at: string }>(
      `/v1/commerce/products/${productId}/preview-tokens`,
      {}
    );
    return { token: data.token, handle: data.handle, expiresAt: data.expires_at };
  });
}

export async function publishProductAction(
  productId: string
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    await api.post<{ id: string }>(`/v1/commerce/products/${productId}/publish`, {});
    revalidatePath('/commerce/products');
    revalidatePath(`/commerce/products/${productId}`);
    return { id: productId };
  });
}

export async function unpublishProductAction(
  productId: string
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    await api.post<{ id: string }>(`/v1/commerce/products/${productId}/unpublish`, {});
    revalidatePath('/commerce/products');
    revalidatePath(`/commerce/products/${productId}`);
    return { id: productId };
  });
}

export async function archiveProductAction(
  productId: string
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    await api.post<{ id: string }>(`/v1/commerce/products/${productId}/archive`, {});
    revalidatePath('/commerce/products');
    revalidatePath(`/commerce/products/${productId}`);
    return { id: productId };
  });
}

export async function restoreProductAction(
  productId: string
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    await api.post<{ id: string }>(`/v1/commerce/products/${productId}/restore`, {});
    revalidatePath('/commerce/products');
    revalidatePath(`/commerce/products/${productId}`);
    return { id: productId };
  });
}

export async function deleteProductAction(
  productId: string
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    await api.delete<void>(`/v1/commerce/products/${productId}`);
    revalidatePath('/commerce/products');
    return { id: productId };
  });
}

export async function bulkUpdateProductStatusAction(
  input: unknown
): Promise<ActionResult<{ updated: number }>> {
  return restAction(async () => {
    const result = await api.post<{ updated: number }>('/v1/commerce/products/bulk-status', input);
    revalidatePath('/commerce/products');
    return result;
  });
}

export async function bulkTagProductsAction(
  input: unknown
): Promise<ActionResult<{ updated: number }>> {
  return restAction(async () => {
    const result = await api.post<{ updated: number }>('/v1/commerce/products/bulk-tag', input);
    revalidatePath('/commerce/products');
    return result;
  });
}

// ─── Bulk price adjustment + 30-minute revert (B-3) ──────────────────────────

export async function previewBulkPriceAction(
  productIds: string[],
  adjustment: PriceAdjustment
): Promise<ActionResult<BulkPricePreview>> {
  return restAction(() =>
    api.post<BulkPricePreview>('/v1/commerce/products/bulk-price/preview', {
      productIds,
      adjustment,
    })
  );
}

export async function applyBulkPriceAction(
  productIds: string[],
  adjustment: PriceAdjustment
): Promise<ActionResult<BulkPriceApplyResult>> {
  return restAction(async () => {
    const result = await api.post<BulkPriceApplyResult>('/v1/commerce/products/bulk-price/apply', {
      productIds,
      adjustment,
    });
    revalidatePath('/commerce/products');
    return result;
  });
}

export async function revertBulkPriceAction(
  operationId: string
): Promise<ActionResult<{ operationId: string; productCount: number; variantCount: number }>> {
  return restAction(async () => {
    const result = await api.post<{
      operationId: string;
      productCount: number;
      variantCount: number;
    }>('/v1/commerce/products/bulk-price/revert', { operationId });
    revalidatePath('/commerce/products');
    return result;
  });
}

// ─── Import / Export (B-2) ───────────────────────────────────────────────────

export async function submitProductImportAction(
  rows: Record<string, string>[],
  options: { upsert: boolean; fileName: string }
): Promise<ActionResult<{ jobId: string }>> {
  return restAction(async () => {
    const result = await api.post<{ jobId: string }>('/v1/commerce/products/import', {
      rows,
      options: { upsert: options.upsert },
      fileName: options.fileName,
    });
    return result;
  });
}

export async function getProductImportStatusAction(jobId: string): Promise<
  ActionResult<{
    status: string;
    importedCount: number;
    updatedCount: number;
    errorCount: number;
    rowCount: number;
    rows: {
      rowIndex: number;
      status: string;
      naturalKey?: string | null;
      errorMsg?: string | null;
    }[];
  }>
> {
  return restAction(async () => api.get(`/v1/commerce/products/import/${jobId}`));
}
