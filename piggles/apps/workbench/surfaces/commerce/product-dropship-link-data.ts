// Pointing a product at the supplier who ships it, for a supplier with no product
// list of their own (sparx persona issue 171).
//
// A supplier who ships when sent the order (the business's own maker or
// wholesaler) has nothing to import from. The owner already sells the product;
// they say who ships it, the supplier's code for it, and what the supplier
// charges. The API writes the same rows an import would, so the margin on the
// panel, the order router and the profit reports read it unchanged.

import { useMutation, useQueryClient } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import { useSuppliers, type Supplier } from '../dropship/dropship-data';
import { productKeys, useInvalidateProduct, type ProductDropship } from './products-data';

export interface ShipFromSupplierInput {
  supplierId: string;
  /** The supplier's code for this product: what they pick by. */
  supplierSku: string;
  /** What the supplier charges for one, in cents. */
  costCents: number;
}

/** Suppliers a product can be pointed at by hand: connected, and with no
 *  product list of their own. Undefined while loading. */
export function useHandLinkedSuppliers(): {
  suppliers: Supplier[] | undefined;
  isError: boolean;
} {
  const query = useSuppliers();
  return {
    suppliers: query.data?.items.filter(
      (supplier) => !supplier.capabilities.catalogSync && supplier.status !== 'disconnected'
    ),
    isError: query.isError,
  };
}

/** The panel's answer comes back from the write, so it is shown at once; the
 *  variants move too (their supplier and their cost). */
function useSettle(productId: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateProduct();
  return (next: ProductDropship) => {
    queryClient.setQueryData(productKeys.facet(productId, 'dropship'), next);
    invalidate(productId, 'variants');
  };
}

/** This supplier ships this product, from now on. The same call changes their
 *  code or their price. */
export function useShipFromSupplier(productId: string) {
  const settle = useSettle(productId);
  return useMutation({
    mutationFn: (input: ShipFromSupplierInput) =>
      api.put<ProductDropship>('/v1/dropship/product-links', {
        product_id: productId,
        supplier_id: input.supplierId,
        supplier_sku: input.supplierSku.trim(),
        cost_cents: input.costCents,
      }),
    onSuccess: settle,
  });
}

/** They stop shipping it: the business ships it again. */
export function useStopSupplierShipping(productId: string) {
  const settle = useSettle(productId);
  return useMutation({
    mutationFn: (linkId: string) =>
      api.delete<ProductDropship>(`/v1/dropship/product-links/${linkId}`),
    onSuccess: settle,
  });
}
