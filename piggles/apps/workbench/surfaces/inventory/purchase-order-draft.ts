// The order as it is being written: one header and its lines, held locally and
// saved on one Save. Pure helpers only, so the pane and its hooks share one model.

import { moneyCents } from '../../components/money-input';
import type {
  PurchaseOrderDetail,
  PurchaseOrderHeaderDraft,
  PurchaseOrderLineDraft,
} from './purchase-orders-data';

export interface PurchaseOrderDraft {
  header: PurchaseOrderHeaderDraft;
  lines: PurchaseOrderLineDraft[];
}

/** The draft line being edited, or null when adding a fresh one. */
export interface EditingLine {
  line: PurchaseOrderLineDraft | null;
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Nothing typed reads as nothing set; `moneyCents` reads "8,50", "$8.00" and
 *  "1,250.00" the way a person writes them (issues 086 and 486). */
export function inputToCents(value: string): number | null {
  return value.trim() === '' ? null : moneyCents(value);
}

/** Typed amount → whole cents, or null while still typed. Zero is allowed here,
 *  unlike `inputToCents`: a charge of zero is simply nothing to add. */
export function chargeAmountCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/** A new order. `supplierId` when it was started from that supplier's page. */
export function emptyDraft(supplierId = ''): PurchaseOrderDraft {
  return {
    header: {
      supplierId,
      warehouseId: '',
      currency: 'USD',
      paymentTerms: null,
      reference: null,
      expectedArrivalAt: null,
      freightCents: 0,
      notes: null,
    },
    lines: [],
  };
}

export function draftFromDetail(detail: PurchaseOrderDetail): PurchaseOrderDraft {
  return {
    header: {
      supplierId: detail.supplierId,
      warehouseId: detail.warehouseId,
      currency: detail.currency,
      paymentTerms: detail.paymentTerms,
      reference: detail.reference,
      expectedArrivalAt: detail.expectedArrivalAt,
      freightCents: detail.freightCents,
      notes: detail.notes,
    },
    lines: detail.lines.map((line) => ({
      id: line.id,
      variantId: line.variantId,
      variantSku: line.variantSku,
      productTitle: line.productTitle,
      description: line.description,
      supplierSku: line.supplierSku,
      quantityOrdered: line.quantityOrdered,
      unitCostCents: line.unitCostCents,
      uomCode: line.uomCode,
      unitsPerUom: line.unitsPerUom,
    })),
  };
}

export function subtotalOf(lines: PurchaseOrderLineDraft[]): number {
  return lines.reduce((sum, line) => sum + line.quantityOrdered * line.unitCostCents, 0);
}

export function withHeader<K extends keyof PurchaseOrderHeaderDraft>(
  current: PurchaseOrderDraft,
  key: K,
  value: PurchaseOrderHeaderDraft[K]
): PurchaseOrderDraft {
  return { ...current, header: { ...current.header, [key]: value } };
}

/** Matched by server id when editing, else by variant, mirroring the server's own
 *  (order, variant) upsert. The server id is kept so it saves as an UPDATE. */
export function withLine(
  current: PurchaseOrderDraft,
  line: PurchaseOrderLineDraft
): PurchaseOrderDraft {
  const lines = [...current.lines];
  const index = line.id
    ? lines.findIndex((existing) => existing.id === line.id)
    : lines.findIndex((existing) => existing.variantId === line.variantId);
  if (index >= 0) {
    const existing = lines[index];
    lines[index] = { ...line, id: line.id ?? existing?.id };
  } else {
    lines.push(line);
  }
  return { ...current, lines };
}

export function withoutLine(
  current: PurchaseOrderDraft,
  line: PurchaseOrderLineDraft
): PurchaseOrderDraft {
  return {
    ...current,
    lines: current.lines.filter((existing) =>
      line.id ? existing.id !== line.id : existing !== line
    ),
  };
}
