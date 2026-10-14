// The state behind entering a supplier's invoice: which order it is for, what
// has been typed, whether that differs from what the console filled in, and save.

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import { useDirtySource } from '../../lib/workbench/dirty';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  usePurchaseOrder,
  usePurchaseOrders,
  type PurchaseOrderDetail,
} from './purchase-orders-data';
import { useCreateSupplierBill } from './supplier-bills-data';
import {
  billAmounts,
  billDates,
  seedBillLines,
  supplierBillInput,
  todayIso,
  type BillDraftLine,
} from './supplier-bill-new-model';
import { submitSupplierBill } from './supplier-bill-new-save';

function useBillOrder(ctx: SurfaceContext) {
  // Opened from an order's own pane, so the order usually arrives in the params.
  const seededOrderId = ctx.params.purchaseOrderId ?? '';
  const [purchaseOrderId, setPurchaseOrderId] = useState(seededOrderId);

  // Only orders that could plausibly have been invoiced. A draft has not been
  // sent, so nobody can have billed for it.
  const orders = usePurchaseOrders({ status: '', q: '', take: 100, skip: 0 });
  const billable = (orders.data?.items ?? []).filter(
    (order) =>
      order.status === 'submitted' || order.status === 'partial' || order.status === 'received'
  );

  const order = usePurchaseOrder(purchaseOrderId === '' ? 'new' : purchaseOrderId);
  // No placed order at all needs a way forward, not "choose one" (issue 252).
  return {
    seededOrderId,
    purchaseOrderId,
    setPurchaseOrderId,
    billable,
    order,
    nothingPlaced: orders.isSuccess && billable.length === 0,
  };
}

// Pre-fill from the order the moment it lands, so that anything the person
// changes is a real difference rather than a typo.
function useSeedLinesFromOrder(
  orderData: PurchaseOrderDetail | undefined,
  setLines: Dispatch<SetStateAction<BillDraftLine[]>>,
  seededLinesRef: { current: string }
) {
  useEffect(() => {
    if (!orderData) {
      setLines([]);
      seededLinesRef.current = '[]';
      return;
    }
    const seeded = seedBillLines(orderData);
    setLines(seeded);
    // Filling these in from the order is the console's work, not hers, so the
    // baseline moves with it.
    seededLinesRef.current = JSON.stringify(seeded);
  }, [orderData, setLines, seededLinesRef]);
}

function useBillFields(orderData: PurchaseOrderDetail | undefined) {
  const [number, setNumber] = useState('');
  const [billedAt, setBilledAt] = useState(() => todayIso().slice(0, 10));
  const [dueAt, setDueAt] = useState('');
  const [freight, setFreight] = useState('0');
  const [tax, setTax] = useState('0');
  const [lines, setLines] = useState<BillDraftLine[]>([]);
  // What the console filled in, so "unsaved" means the screen differs from it,
  // not that a key was ever pressed (issue 507).
  const seededLinesRef = useRef('[]');
  const seededBilledAt = useRef(billedAt).current;
  useSeedLinesFromOrder(orderData, setLines, seededLinesRef);
  return {
    number,
    setNumber,
    billedAt,
    setBilledAt,
    dueAt,
    setDueAt,
    freight,
    setFreight,
    tax,
    setTax,
    lines,
    setLines,
    seededLinesRef,
    seededBilledAt,
  };
}

type BillFields = ReturnType<typeof useBillFields>;

function billFieldsDiffer(seededOrderId: string, purchaseOrderId: string, f: BillFields) {
  return (
    purchaseOrderId !== seededOrderId ||
    f.number.trim() !== '' ||
    f.dueAt !== '' ||
    f.billedAt !== f.seededBilledAt ||
    f.freight !== '0' ||
    f.tax !== '0' ||
    JSON.stringify(f.lines) !== f.seededLinesRef.current
  );
}

export function useSupplierBillDraft(ctx: SurfaceContext) {
  const source = useBillOrder(ctx);
  const create = useCreateSupplierBill();
  const toast = useToast();
  const fields = useBillFields(source.order.data);
  // `!create.isSuccess` because this pane replaces itself with the saved invoice
  // the instant it succeeds, and a flag still reading dirty at that moment asks
  // her to confirm discarding the invoice she just entered.
  const dirty =
    !create.isSuccess && billFieldsDiffer(source.seededOrderId, source.purchaseOrderId, fields);
  useDirtySource(dirty, 'This bill has not been saved. Close it anyway?');

  const supplierId = source.order.data?.supplierId ?? '';
  const currency = source.order.data?.currency ?? 'USD';
  const amounts = billAmounts(fields.lines, fields.freight, fields.tax);
  const dates = billDates(fields.billedAt, fields.dueAt);

  const canSave =
    dates.billedIso !== null &&
    dates.dueError === null &&
    supplierId !== '' &&
    fields.number.trim().length > 0 &&
    fields.lines.length > 0 &&
    fields.lines.every((line) => Number.parseFloat(line.quantity) > 0);

  const onSave = () => {
    if (!canSave || dates.billedIso === null) return;
    const input = supplierBillInput({
      supplierId,
      purchaseOrderId: source.purchaseOrderId,
      number: fields.number,
      billedIso: dates.billedIso,
      dueIso: dates.dueIso,
      currency,
      taxCents: amounts.taxCents,
      freightCents: amounts.freightCents,
      lines: fields.lines,
    });
    submitSupplierBill({ ctx, create, toast, input });
  };

  return { ...source, ...fields, ...amounts, ...dates, create, currency, canSave, onSave };
}

export type SupplierBillDraft = ReturnType<typeof useSupplierBillDraft>;
