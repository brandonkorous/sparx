'use client';

// Acting on several products at once: delete (ticked rows only), status, a
// category (add or remove), what they fit (add or remove). Every one refreshes
// every product read, since an open product shows what this just changed.

import { useMutation, useQueryClient } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import { categoryKeys } from './categories-data';
import { productKeys, type ProductFitmentRange, type ProductStatus } from './products-data';
import {
  selectionBody,
  type BulkTarget,
  type CategoryBulkResult,
  type FitmentBulkResult,
} from './products-bulk-words';

/** Lists, every open product, every facet of them, and the category counts. */
function useRefreshAfterBulk() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: productKeys.all });
    void queryClient.invalidateQueries({ queryKey: categoryKeys.all });
  };
}

export interface BulkDeleteResult {
  deleted: number;
  /** Already gone by the time this ran; counted, never folded into `deleted`. */
  skipped: number;
}

export function useBulkDeleteProducts() {
  const refresh = useRefreshAfterBulk();
  return useMutation({
    mutationFn: (productIds: string[]) =>
      api.post<BulkDeleteResult>('/v1/commerce/products/bulk-delete', { productIds }),
    onSuccess: refresh,
  });
}

export interface BulkStatusResult {
  updated: number;
  /** Only from the selection form: chosen products already in that status. */
  unchanged?: number;
}

export function useBulkProductStatus() {
  const refresh = useRefreshAfterBulk();
  return useMutation({
    mutationFn: (input: { target: BulkTarget; status: ProductStatus }) =>
      api.post<BulkStatusResult>(
        '/v1/commerce/products/bulk-status',
        input.target.kind === 'ids'
          ? { productIds: input.target.productIds, status: input.status }
          : { selection: selectionBody(input.target), status: input.status }
      ),
    onSuccess: refresh,
  });
}

export function useBulkCategory() {
  const refresh = useRefreshAfterBulk();
  return useMutation({
    mutationFn: (input: { target: BulkTarget; categoryId: string; direction: 'add' | 'remove' }) =>
      api.post<CategoryBulkResult>(
        `/v1/commerce/categories/${input.categoryId}/${input.direction === 'add' ? 'add-products' : 'remove-products'}`,
        { selection: selectionBody(input.target) }
      ),
    onSuccess: refresh,
  });
}

/** One rule to add, as the server takes it. An open end is null. */
export interface BulkFitmentRule {
  domainId: string;
  nodeId: string | null;
  ranges: ProductFitmentRange[];
  notes?: string;
}

export function useBulkAddFitment() {
  const refresh = useRefreshAfterBulk();
  return useMutation({
    mutationFn: (input: { target: BulkTarget; fitments: BulkFitmentRule[] }) =>
      api.post<FitmentBulkResult>('/v1/commerce/fitment/bulk-add', {
        selection: selectionBody(input.target),
        fitments: input.fitments,
      }),
    onSuccess: refresh,
  });
}

export function useBulkRemoveFitment() {
  const refresh = useRefreshAfterBulk();
  return useMutation({
    mutationFn: (input: { target: BulkTarget; domainId: string; nodeIds: (string | null)[] }) =>
      api.post<FitmentBulkResult>('/v1/commerce/fitment/bulk-remove', {
        selection: selectionBody(input.target),
        domainId: input.domainId,
        nodeIds: input.nodeIds,
      }),
    onSuccess: refresh,
  });
}
