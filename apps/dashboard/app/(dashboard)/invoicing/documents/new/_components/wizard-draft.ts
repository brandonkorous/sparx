// Maps the create wizard's local form state onto the body POST
// /v1/invoicing/documents/preview accepts, so the merchant sees the REAL branded
// artifact while composing it (docs/87 §10).
//
// Kept out of invoice-wizard.tsx on purpose: the wizard is already a long file and
// this is a separate responsibility (state → wire shape) with two traps worth
// isolating — the percent→fraction tax conversion and the lineTypeKey→lineTypeId
// resolution.

/** A line as the wizard holds it locally, before the document exists. */
export interface WizardDraftLine {
  description: string;
  quantity: number;
  unitPrice: number;
  taxable: boolean;
  /** The exact AddBillingLine body; carries `lineTypeKey`, not an id. */
  payload: Record<string, unknown>;
}

export interface WizardDraftInput {
  startStageId: string;
  currency: string;
  customerId: string;
  b2bAccountId: string;
  /** Percent, as typed — e.g. `"8.75"`. Converted to a fraction here. */
  taxRatePct: string;
  shippingTotal: number;
  surchargeTotal: number;
  depositKind: 'deposit' | 'payment';
  depositAmount: number;
  dueAt?: string;
  validUntil?: string;
  notes: string;
  lines: WizardDraftLine[];
  /** Resolves a line's `lineTypeKey` to the real uuid the endpoint wants. */
  lineTypes: { id: string; key: string }[];
}

/** Build the preview body. Everything is optional server-side, so an unset field is
 *  omitted rather than sent as an empty string — a half-composed document renders. */
export function buildWizardDraft(input: WizardDraftInput): Record<string, unknown> {
  // The wizard holds a PERCENT string; the endpoint wants a FRACTION (0.0875).
  const pct = Math.min(100, Math.max(0, Number(input.taxRatePct) || 0));
  const deposit = Math.max(0, input.depositAmount);

  return {
    stageId: input.startStageId || undefined,
    status: 'draft',
    currency: (input.currency.trim() || 'USD').toUpperCase().slice(0, 3),
    customerId: input.customerId || undefined,
    b2bAccountId: input.b2bAccountId || undefined,
    dueAt: input.dueAt,
    validUntil: input.validUntil,
    notes: input.notes.trim() || undefined,
    taxRate: pct / 100,
    shippingTotal: input.shippingTotal,
    surchargeTotal: input.surchargeTotal,
    // A deposit reduces the balance shown as a deposit line; a payment as paid.
    depositTotal: input.depositKind === 'deposit' ? deposit : 0,
    amountPaid: input.depositKind === 'payment' ? deposit : 0,
    lines: input.lines.map((l) => toDraftLine(l, input.lineTypes)),
  };
}

function toDraftLine(
  line: WizardDraftLine,
  lineTypes: { id: string; key: string }[]
): Record<string, unknown> {
  // `typeLabel` on the local line is a DISPLAY label — sending it as `lineTypeId`
  // would fail the server's uuid parse and drop the whole request. The line's
  // payload carries the type KEY, so resolve the real id from it; if it can't be
  // resolved, omit the field entirely (the preview renders the line untyped).
  const key = typeof line.payload.lineTypeKey === 'string' ? line.payload.lineTypeKey : null;
  const lineTypeId = key ? (lineTypes.find((t) => t.key === key)?.id ?? null) : null;

  return {
    ...(lineTypeId ? { lineTypeId } : {}),
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    taxable: line.taxable,
  };
}
