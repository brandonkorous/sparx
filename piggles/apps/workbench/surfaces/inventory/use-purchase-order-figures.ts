// What the pane works out from the draft: who the supplier is, where it can land,
// the totals, and which spending limit (if any) will hold it.

import { useMemo } from 'react';
import { resolveApprovalRule } from '@wizeworks/commerce-schemas';
import { formatCents, useStockLocations } from './data';
import { useSuppliers } from './suppliers-data';
import { usePoApprovalRules } from './po-approvals-data';
import { freightNote } from './freight-words';
import type { PurchaseOrderDetail } from './purchase-orders-data';
import { subtotalOf, type PurchaseOrderDraft } from './purchase-order-draft';

/** The SAME pure resolver the server runs, so the warning and the outcome agree. */
function useHeldBy(draft: PurchaseOrderDraft, total: number) {
  const spendingLimits = usePoApprovalRules().data?.items ?? [];
  const candidate =
    draft.header.supplierId === '' || draft.header.warehouseId === ''
      ? null
      : resolveApprovalRule(
          {
            supplierId: draft.header.supplierId,
            warehouseId: draft.header.warehouseId,
            totalCents: total,
          },
          spendingLimits
        );
  return spendingLimits.find((limit) => limit.id === candidate?.id) ?? null;
}

function useSupplierChoice(draft: PurchaseOrderDraft, detail: PurchaseOrderDetail | null) {
  const suppliers = useSuppliers({ includeArchived: false, take: 250, skip: 0 });
  const supplierList = suppliers.data?.items ?? [];
  const chosenSupplier =
    supplierList.find((supplier) => supplier.id === draft.header.supplierId) ?? null;
  const supplierName = detail?.supplierName ?? chosenSupplier?.name ?? null;
  // One array per fetch: Base UI matches the selected option by identity.
  const supplierItems = useMemo(
    () =>
      (suppliers.data?.items ?? []).map((supplier) => ({
        value: supplier.id,
        label: supplier.name,
      })),
    [suppliers.data]
  );
  return { chosenSupplier, supplierName, supplierItems };
}

export function usePurchaseOrderFigures(
  draft: PurchaseOrderDraft,
  detail: PurchaseOrderDetail | null
) {
  const locationsQuery = useStockLocations();
  const activeLocations = (locationsQuery.data?.items ?? []).filter(
    (location) => location.isActive
  );
  const supplier = useSupplierChoice(draft, detail);
  const subtotal = subtotalOf(draft.lines);
  const total = subtotal + draft.header.freightCents;
  const heldBy = useHeldBy(draft, total);
  const currency = draft.header.currency || 'USD';
  // Freight agreed and freight charged on arrival are two facts. See ./freight-words.
  const freight = freightNote(
    draft.header.freightCents,
    detail?.receiptFreightCents ?? 0,
    (cents) => formatCents(cents, currency)
  );
  return { activeLocations, ...supplier, subtotal, total, heldBy, currency, freight };
}
