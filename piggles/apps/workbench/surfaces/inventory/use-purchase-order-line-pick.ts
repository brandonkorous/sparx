// Choosing the item on a line: from what this supplier sells, or by any code.

import { useMemo } from 'react';
import {
  buyingErrorMessage,
  isNotFound,
  useSupplierVariants,
  useVariantLookup,
} from './suppliers-data';
import { centsToInput } from './purchase-order-draft';
import type { LineFields } from './use-purchase-order-line-state';

function useVariantOptions(supplierId: string, variantId: string | undefined) {
  const supplierVariants = useSupplierVariants(supplierId);
  const variantOptions = useMemo(
    () =>
      (supplierVariants.data ?? []).map((sv) => ({
        value: sv.variantId,
        label: sv.productTitle
          ? `${sv.productTitle}${sv.variantSku ? ` · ${sv.variantSku}` : ''}`
          : (sv.variantSku ?? 'Item'),
        sv,
      })),
    [supplierVariants.data]
  );
  const selectedOption = useMemo(
    () => variantOptions.find((option) => option.value === variantId) ?? null,
    [variantOptions, variantId]
  );
  return { supplierVariants, variantOptions, selectedOption };
}

export type VariantOption = ReturnType<typeof useVariantOptions>['variantOptions'][number];

export function useLinePick(fields: LineFields, supplierId: string) {
  const lookup = useVariantLookup();
  const options = useVariantOptions(supplierId, fields.variant?.variantId);

  const pickSuggested = (option: VariantOption | null) => {
    if (!option) return;
    const sv = option.sv;
    fields.setVariant({
      variantId: sv.variantId,
      variantSku: sv.variantSku,
      productTitle: sv.productTitle,
    });
    fields.setDescription(sv.productTitle ?? sv.variantSku ?? '');
    if (sv.supplierSku) fields.setSupplierSku(sv.supplierSku);
    fields.setSupplierVariantId(sv.id);
    if (sv.unitCostCents !== null && fields.cost.trim() === '') {
      fields.setCost(centsToInput(sv.unitCostCents));
    }
  };

  // An item found by code may still be one bought from this supplier, so its ladder applies.
  const findByCode = async () => {
    fields.setLookupError(null);
    const code = fields.skuLookup.trim();
    if (code === '') return;
    try {
      const found = await lookup.mutateAsync(code);
      fields.setVariant({
        variantId: found.variantId,
        variantSku: found.sku,
        productTitle: found.productTitle,
      });
      fields.setDescription(found.productTitle ?? found.sku);
      fields.setSupplierVariantId(
        (options.supplierVariants.data ?? []).find((sv) => sv.variantId === found.variantId)?.id ??
          ''
      );
      fields.setSkuLookup('');
    } catch (err) {
      fields.setLookupError(
        isNotFound(err)
          ? `No item in your catalog has the code "${code}".`
          : buyingErrorMessage(err, 'Could not look that code up.')
      );
    }
  };

  return { ...options, lookupPending: lookup.isPending, pickSuggested, findByCode };
}
