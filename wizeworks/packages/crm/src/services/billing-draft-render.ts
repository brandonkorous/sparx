// Draft render data — the LIVE-PREVIEW path for a billing document that has not
// been saved yet (docs/87 §10).
//
// The two builders in billing-render-service read numbers that a write already
// persisted (a live document row, or a frozen snapshot payload). A draft has no
// row, so this one COMPUTES the totals instead — and it must compute them with
// `computeBillingTotals`, the same function the save path uses, or the merchant
// watches one set of numbers while typing and gets a different set after saving.
// That divergence is the whole reason this lives in its own module rather than
// alongside the read-from-DB builders: same output shape, opposite direction.
//
// Tenant-scoped via withTenant() for the few identity lookups it still needs
// (stage label, line-type labels, party fallback) — a draft's MONEY is caller
// input, but the names printed beside it are still tenant records.

import { withTenant } from '@wizeworks/db';

import type { ServiceContext } from '../errors';
import type {
  BillingRenderData,
  BillingRenderLine,
  BillingRenderTotals,
} from './billing-document-html';
import { computeBillingTotals } from './billing-totals';
import { partyFromJson, resolveBillTo, lineTypeLabels } from './billing-render-parts';

/** One unsaved line as the editor holds it. Every field is optional because a
 *  draft is mid-typing by definition — a half-filled row must preview, not throw. */
export interface BillingDraftLine {
  lineTypeId?: string | null;
  description?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  discountAmount?: number | null;
  taxable?: boolean | null;
}

/** The unsaved document as the wizard / line grid holds it. */
export interface BillingDraftInput {
  /** Stage whose `customerLabel` names the document ("Invoice", "Estimate", …). */
  stageId?: string | null;
  /** Explicit customer-facing label; wins over `stageId` when both are present. */
  title?: string | null;
  number?: string | null;
  status?: string | null;
  currency?: string | null;
  customerId?: string | null;
  companyId?: string | null;
  billTo?: unknown;
  shipTo?: unknown;
  issuedAt?: string | null;
  dueAt?: string | null;
  validUntil?: string | null;
  notes?: string | null;
  /** Fraction, not percent — 0.0875 is 8.75%, matching the persisted column. */
  taxRate?: number | null;
  shippingTotal?: number | null;
  surchargeTotal?: number | null;
  depositTotal?: number | null;
  amountPaid?: number | null;
  lines?: BillingDraftLine[] | null;
}

const num = (v: number | null | undefined): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : 0;

/** Build render data for an UNSAVED document so the editor can preview the real
 *  artifact while it is being typed. Never throws on incomplete input — an empty
 *  draft previews as an empty document, which is what a merchant should see on
 *  the first keystroke rather than an error state. */
export async function buildRenderDataFromDraft(
  ctx: ServiceContext,
  draft: BillingDraftInput
): Promise<BillingRenderData> {
  const draftLines = draft.lines ?? [];

  return withTenant(ctx, async (tx) => {
    const [stage, typeLabels, billTo] = await Promise.all([
      draft.stageId
        ? tx.documentStage.findUnique({
            where: { id: draft.stageId },
            select: { customerLabel: true },
          })
        : Promise.resolve(null),
      lineTypeLabels(
        tx,
        draftLines.map((l) => l.lineTypeId ?? null)
      ),
      resolveBillTo(tx, draft.billTo, draft.customerId ?? null, draft.companyId ?? null),
    ]);

    const taxRate = num(draft.taxRate);
    const forTotals = draftLines.map((l) => ({
      quantity: num(l.quantity),
      unitPrice: num(l.unitPrice),
      discountAmount: num(l.discountAmount),
      taxable: l.taxable ?? false,
    }));
    // Same function the save path uses — preview numbers and saved numbers agree.
    const computed = computeBillingTotals(
      forTotals,
      taxRate,
      num(draft.shippingTotal),
      num(draft.surchargeTotal)
    );

    const depositTotal = num(draft.depositTotal);
    const amountPaid = num(draft.amountPaid);
    const totals: BillingRenderTotals = {
      ...computed,
      taxRate,
      depositTotal,
      amountPaid,
      balance: round2(computed.total - depositTotal - amountPaid),
    };

    const lines: BillingRenderLine[] = draftLines.map((l, i) => ({
      typeLabel: l.lineTypeId ? (typeLabels.get(l.lineTypeId) ?? null) : null,
      description: l.description ?? '',
      quantity: num(l.quantity),
      unitPrice: num(l.unitPrice),
      lineTotal: computeLineTotal(forTotals[i]!, taxRate),
      taxable: l.taxable ?? false,
    }));

    return {
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- `||` is intended: an EMPTY title must fall through to the stage label, which `??` would not do (it only falls through on null/undefined). A blank title field would otherwise print a document with no name.
      title: draft.title?.trim() || stage?.customerLabel || 'Invoice',
      number: draft.number ?? null,
      status: draft.status ?? 'unpaid',
      currency: draft.currency ?? 'USD',
      // A draft has no finalizedAt; preview it as issued today so the date block
      // renders rather than collapsing to an empty row mid-edit.
      issuedAt: draft.issuedAt ?? new Date().toISOString(),
      dueAt: draft.dueAt ?? null,
      validUntil: draft.validUntil ?? null,
      billTo,
      shipTo: partyFromJson(draft.shipTo, 'Ship to'),
      lines,
      totals,
      notes: draft.notes ?? null,
    };
  });
}

function computeLineTotal(
  line: { quantity: number; unitPrice: number; discountAmount: number; taxable: boolean },
  taxRate: number
): number {
  const subtotal = round2(line.quantity * line.unitPrice);
  const base = Math.max(0, subtotal - line.discountAmount);
  return round2(subtotal - line.discountAmount + (line.taxable ? round2(base * taxRate) : 0));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
