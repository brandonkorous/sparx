'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-rest-client';
import type { ActionResult } from './_action-helpers';
import { restAction } from './_rest-action';
import type { OptionRow, VariantRow } from './products/[id]/_components/variants-panel';

// Client-callable reads for the product wizard's Variants step. The detail page
// fetches these server-side; the wizard needs them after it mutates the lattice
// so it can re-derive the variant matrix without a full navigation.
export async function listProductOptionsAction(
  productId: string
): Promise<ActionResult<OptionRow[]>> {
  return restAction(() =>
    api.get<OptionRow[]>(`/v1/commerce/products/${productId}/variants/options`)
  );
}

export async function listVariantsAction(productId: string): Promise<ActionResult<VariantRow[]>> {
  return restAction(() =>
    api.get<VariantRow[]>(`/v1/commerce/products/${productId}/variants?include_archived=false`)
  );
}

export interface ProductImageRow {
  id: string;
  variantId: string | null;
  mediaAssetId: string;
  position: number;
  isPrimary: boolean;
  alt: string | null;
  optionValueIds: string[];
}

export async function listProductImagesAction(
  productId: string
): Promise<ActionResult<ProductImageRow[]>> {
  return restAction(() => api.get<ProductImageRow[]>(`/v1/commerce/products/${productId}/images`));
}

export async function setProductOptionsAction(
  productId: string,
  input: unknown
): Promise<ActionResult<{ optionCount: number }>> {
  return restAction(async () => {
    await api.post<{ productId: string; updated: boolean }>(
      `/v1/commerce/products/${productId}/variants/options`,
      input
    );
    revalidatePath(`/commerce/products/${productId}`);
    revalidatePath(`/commerce/products/${productId}/variants`);
    // Original returned the option count derived from setOptions result.
    // The REST surface is fire-and-forget; we re-read on the next page render
    // so the count surfaces there instead.
    return { optionCount: 0 };
  });
}

export async function createVariantAction(
  productId: string,
  input: unknown
): Promise<ActionResult<{ id: string; sku: string }>> {
  return restAction(async () => {
    const result = await api.post<{ id: string; sku: string }>(
      `/v1/commerce/products/${productId}/variants`,
      input
    );
    revalidatePath(`/commerce/products/${productId}`);
    revalidatePath(`/commerce/products/${productId}/variants`);
    return result;
  });
}

export async function updateVariantAction(
  variantId: string,
  productId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    await api.patch<{ id: string; updated: boolean }>(`/v1/commerce/variants/${variantId}`, input);
    revalidatePath(`/commerce/products/${productId}`);
    revalidatePath(`/commerce/products/${productId}/variants`);
    return { id: variantId };
  });
}

export async function renameVariantSkuAction(
  variantId: string,
  productId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    await api.post<{ id: string }>(`/v1/commerce/variants/${variantId}/rename-sku`, input);
    revalidatePath(`/commerce/products/${productId}/variants`);
    return { id: variantId };
  });
}

export async function assignVariantOptionValuesAction(
  productId: string,
  input: unknown
): Promise<ActionResult<{ ok: true }>> {
  return restAction(async () => {
    await api.post<{ assigned: boolean }>('/v1/commerce/variants/assign-options', input);
    revalidatePath(`/commerce/products/${productId}/variants`);
    return { ok: true as const };
  });
}

export async function setDefaultVariantAction(
  variantId: string,
  productId: string
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    await api.post<{ id: string }>(`/v1/commerce/variants/${variantId}/default`, {});
    revalidatePath(`/commerce/products/${productId}/variants`);
    return { id: variantId };
  });
}

export async function archiveVariantAction(
  variantId: string,
  productId: string
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    await api.post<{ id: string }>(`/v1/commerce/variants/${variantId}/archive`, {});
    revalidatePath(`/commerce/products/${productId}/variants`);
    return { id: variantId };
  });
}

export async function restoreVariantAction(
  variantId: string,
  productId: string
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    await api.post<{ id: string }>(`/v1/commerce/variants/${variantId}/restore`, {});
    revalidatePath(`/commerce/products/${productId}/variants`);
    return { id: variantId };
  });
}

export async function addVariantImageAction(
  productId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const result = await api.post<{ id: string }>('/v1/commerce/variants/images', input);
    revalidatePath(`/commerce/products/${productId}/variants`);
    return result;
  });
}

export async function setVariantImageBindingsAction(
  productId: string,
  input: unknown
): Promise<ActionResult<{ ok: true }>> {
  return restAction(async () => {
    await api.put<{ updated: boolean }>('/v1/commerce/variant-image-bindings', input);
    revalidatePath(`/commerce/products/${productId}/variants`);
    return { ok: true as const };
  });
}

export async function removeVariantImageAction(
  productId: string,
  variantImageId: string
): Promise<ActionResult<{ ok: true }>> {
  return restAction(async () => {
    await api.delete<void>(`/v1/commerce/variant-images/${variantImageId}`);
    revalidatePath(`/commerce/products/${productId}/variants`);
    return { ok: true as const };
  });
}

export async function setPrimaryVariantImageAction(
  productId: string,
  variantImageId: string
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const result = await api.post<{ id: string; isPrimary: boolean }>(
      `/v1/commerce/variant-images/${variantImageId}/primary`,
      {}
    );
    revalidatePath(`/commerce/products/${productId}`);
    revalidatePath(`/commerce/products/${productId}/variants`);
    return { id: result.id };
  });
}
