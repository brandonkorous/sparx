'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-rest-client';
import type { ActionResult } from './_action-helpers';
import { restAction } from './_rest-action';

export interface CollectionOption {
  id: string;
  name: string;
}

// Lightweight collection list for pickers (e.g. the product creation wizard's
// Organization step). The list endpoint paginates as `{ items, total }`.
export async function listCollectionsAction(): Promise<ActionResult<CollectionOption[]>> {
  return restAction(async () => {
    const res = await api.get<{ items: CollectionOption[] }>('/v1/commerce/collections?take=200');
    return res.items.map((c) => ({ id: c.id, name: c.name }));
  });
}

export async function createCollectionAction(
  input: unknown
): Promise<ActionResult<{ id: string; handle: string }>> {
  return restAction(async () => {
    const result = await api.post<{ id: string; handle: string }>(
      '/v1/commerce/collections',
      input
    );
    revalidatePath('/commerce/collections');
    return result;
  });
}

export async function updateCollectionAction(
  collectionId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    await api.patch<{ id: string }>(`/v1/commerce/collections/${collectionId}`, input);
    revalidatePath('/commerce/collections');
    revalidatePath(`/commerce/collections/${collectionId}`);
    return { id: collectionId };
  });
}

export async function setCollectionProductsAction(
  input: unknown
): Promise<ActionResult<{ ok: true }>> {
  return restAction(async () => {
    await api.post<{ updated: boolean }>('/v1/commerce/collections/set-products', input);
    return { ok: true as const };
  });
}

export async function setProductCollectionsAction(
  productId: string,
  collectionIds: string[]
): Promise<ActionResult<{ ok: true }>> {
  return restAction(async () => {
    await api.post<{ updated: boolean }>('/v1/commerce/collections/set-product-collections', {
      productId,
      collectionIds,
    });
    revalidatePath(`/commerce/products/${productId}`);
    return { ok: true as const };
  });
}

export async function reindexCollectionAction(
  collectionId: string
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    await api.post<{ id: string; reindexed: boolean }>(
      `/v1/commerce/collections/${collectionId}/reindex`,
      {}
    );
    revalidatePath(`/commerce/collections/${collectionId}`);
    return { id: collectionId };
  });
}

export async function deleteCollectionAction(
  collectionId: string
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    await api.delete<void>(`/v1/commerce/collections/${collectionId}`);
    revalidatePath('/commerce/collections');
    return { id: collectionId };
  });
}

export async function bulkDeleteCollectionsAction(
  ids: string[]
): Promise<ActionResult<{ deleted: number }>> {
  return restAction(async () => {
    await Promise.all(ids.map((id) => api.delete<void>(`/v1/commerce/collections/${id}`)));
    revalidatePath('/commerce/collections');
    return { deleted: ids.length };
  });
}
