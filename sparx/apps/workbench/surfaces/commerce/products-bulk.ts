'use client';

// Acting on several products at once.
//
//   POST /v1/commerce/products/bulk-delete
//   POST /v1/commerce/products/bulk-status
//
// Its own file rather than more of products-data, because these are the only
// mutations on the list pane that act on a SET, and the set is the whole
// difference: each one reports how many it actually changed, which the
// single-product mutations never have to.

import { useMutation } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import { useInvalidateProduct, type ProductStatus } from './products-data';

export interface BulkDeleteResult {
  deleted: number;
  /** Already gone by the time this ran — deleted in another tab, or a stale
   *  page. Counted rather than silently folded into `deleted`. */
  skipped: number;
}

export function useBulkDeleteProducts() {
  const invalidate = useInvalidateProduct();
  return useMutation({
    mutationFn: (productIds: string[]) =>
      api.post<BulkDeleteResult>('/v1/commerce/products/bulk-delete', { productIds }),
    onSuccess: () => {
      invalidate();
    },
  });
}

export interface BulkStatusResult {
  updated: number;
}

export function useBulkProductStatus() {
  const invalidate = useInvalidateProduct();
  return useMutation({
    mutationFn: (input: { productIds: string[]; status: ProductStatus }) =>
      api.post<BulkStatusResult>('/v1/commerce/products/bulk-status', input),
    onSuccess: () => {
      invalidate();
    },
  });
}
