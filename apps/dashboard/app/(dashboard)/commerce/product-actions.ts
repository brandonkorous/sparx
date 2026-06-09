'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { api } from '@/lib/api-rest-client';
import type { ActionResult } from './_action-helpers';
import { restAction } from './_rest-action';

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

export async function getProductImportStatusAction(
  jobId: string
): Promise<ActionResult<{
  status: string;
  importedCount: number;
  updatedCount: number;
  errorCount: number;
  rowCount: number;
  rows: Array<{
    rowIndex: number;
    status: string;
    naturalKey?: string | null;
    errorMsg?: string | null;
  }>;
}>> {
  return restAction(async () =>
    api.get(`/v1/commerce/products/import/${jobId}`)
  );
}

// ─── Product Wizard (B-1) ─────────────────────────────────────────────────
// Multi-step creation: Basics → Pricing → Inventory (physical) → Review.
// Creates the product row then the default variant in a single user action;
// optionally seeds initial stock if a warehouse already exists.

const DimensionsSchema = z.object({
  lengthMm: z.number().int().positive(),
  widthMm: z.number().int().positive(),
  heightMm: z.number().int().positive(),
});

const ProductWizardInputSchema = z.object({
  // Basics
  title: z.string().min(1).max(255),
  sku: z.string().min(1).max(63),
  fulfillmentType: z.enum(['physical', 'digital', 'service']),
  // Pricing
  priceCents: z.number().int().nonnegative(),
  compareAtPriceCents: z.number().int().nonnegative().optional(),
  taxClass: z.string().max(63).optional(),
  // Inventory (physical only)
  trackInventory: z.boolean().optional(),
  initialQuantity: z.number().int().nonnegative().optional(),
  lowStockThreshold: z.number().int().nonnegative().optional(),
  weightGrams: z.number().int().nonnegative().optional(),
  dimensions: DimensionsSchema.optional(),
});

export type ProductWizardInput = z.infer<typeof ProductWizardInputSchema>;

export async function createProductWithVariantAction(
  input: unknown
): Promise<ActionResult<{ id: string; handle: string }>> {
  return restAction(async () => {
    const d = ProductWizardInputSchema.parse(input);

    // Step 1: Create the product catalog row (no variants yet — the service
    // rejects them until Phase 1.2 of the variant lattice build).
    const product = await api.post<{ id: string; handle: string }>('/v1/commerce/products', {
      title: d.title,
      fulfillmentType: d.fulfillmentType,
      taxClass: d.taxClass,
      requiresShipping: d.fulfillmentType === 'physical',
      status: 'draft',
    });

    // Step 2: Create the default variant with SKU + pricing + physical attributes.
    const variant = await api.post<{ id: string; sku: string }>(
      `/v1/commerce/products/${product.id}/variants`,
      {
        sku: d.sku,
        priceCents: d.priceCents,
        ...(d.compareAtPriceCents !== undefined
          ? { compareAtPriceCents: d.compareAtPriceCents }
          : {}),
        inventoryPolicy: d.trackInventory === false ? 'continue' : 'deny',
        requiresShipping: d.fulfillmentType === 'physical',
        ...(d.weightGrams !== undefined ? { weight: d.weightGrams } : {}),
        ...(d.dimensions ? { dimensions: d.dimensions } : {}),
        isDefault: true,
        position: 0,
      }
    );

    // Step 3 (optional): seed initial stock.
    // Requires a warehouse to be configured — skip silently if none exists
    // (merchant can set stock from the Inventory tab after creation).
    if (
      d.fulfillmentType === 'physical' &&
      d.trackInventory !== false &&
      d.initialQuantity &&
      d.initialQuantity > 0
    ) {
      const whs = await api.getPaged<{ id: string }[]>('/v1/commerce/warehouses?take=1');
      const wh = whs.data[0];
      if (wh) {
        await api.post('/v1/commerce/inventory/adjust', {
          variantId: variant.id,
          warehouseId: wh.id,
          delta: d.initialQuantity,
          reason: 'receive',
          note: 'Initial stock — set during product creation',
        });
      }
    }

    revalidatePath('/commerce/products');
    return { id: product.id, handle: product.handle };
  });
}
