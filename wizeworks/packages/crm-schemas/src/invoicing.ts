// Invoicing module input schemas (docs/87).
//
// Authored billing documents move through a tenant-configured workflow of
// stages (mirrors the Pipeline/PipelineStage pattern) and carry typed lines
// whose behavior comes from a tenant line-type registry. These are the Phase 1
// CONFIG inputs — workflow, stage, and line-type CRUD. The document/line write
// schemas land in Phase 2.

import { z } from 'zod';

const Slug = z
  .string()
  .min(1)
  .max(63)
  .regex(/^[a-z][a-z0-9-]*$/, 'Slug must be lowercase kebab-case');

const HexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/, 'Color must be #RRGGBB or #RRGGBBAA hex');

// Semantic stage role — drives system behavior. The customer-facing label
// (`customerLabel`) stays the tenant's; system logic keys off this type.
//   draft     authored, not yet binding (an estimate being built)
//   open      live + editable (a work order in progress)
//   committed customer-approved (the approved estimate)
//   final     billable + locked (the issued invoice)
//   paid      settled
//   void      cancelled / corrected
export const DocumentStageType = z.enum(['draft', 'open', 'committed', 'final', 'paid', 'void']);
export type DocumentStageType = z.infer<typeof DocumentStageType>;

// How a line of a given type is priced (docs/87 §5).
export const LinePricingMode = z.enum(['catalog', 'markup', 'labor', 'flat', 'pass_through']);
export type LinePricingMode = z.infer<typeof LinePricingMode>;

// ── Workflows ────────────────────────────────────────────────────────────
export const CreateDocumentWorkflowInput = z.object({
  name: z.string().min(1).max(120),
  slug: Slug,
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
});
export type CreateDocumentWorkflowInput = z.infer<typeof CreateDocumentWorkflowInput>;

// The two re-declarations are load-bearing for the same reason as
// UpdateDocumentLineTypeInput below: `.partial()` makes a field optional but
// leaves its `.default(...)` intact, so Zod fabricates a value for every
// defaulted field the caller omitted, and the service updates each field that
// is `!== undefined`. Without stripping them, a PATCH of `{name}` alone
// silently cleared `isDefault` and reset `sortOrder` to 0 — renaming a workflow
// demoted it from being the default one.
export const UpdateDocumentWorkflowInput = CreateDocumentWorkflowInput.extend({
  isDefault: z.boolean(),
  sortOrder: z.number().int().min(0),
}).partial();
export type UpdateDocumentWorkflowInput = z.infer<typeof UpdateDocumentWorkflowInput>;

// ── Stages ───────────────────────────────────────────────────────────────
export const CreateDocumentStageInput = z.object({
  name: z.string().min(1).max(120),
  customerLabel: z.string().min(1).max(60),
  stageType: DocumentStageType.default('draft'),
  snapshotOnEnter: z.boolean().default(false),
  numberOnEnter: z.boolean().default(false),
  numberPrefix: z.string().min(1).max(12).optional().nullable(),
  locksEditing: z.boolean().default(false),
  color: HexColor.optional().nullable(),
  sortOrder: z.number().int().min(0),
});
export type CreateDocumentStageInput = z.infer<typeof CreateDocumentStageInput>;

// Same defaults-survive-`.partial()` trap, and the sharpest instance of it: a
// stage's four behaviour flags are precisely what a stage IS, and every one of
// them is defaulted on create. A PATCH of `{name}` alone reset stageType to
// 'draft' and cleared snapshotOnEnter / numberOnEnter / locksEditing — renaming
// "Paid" stopped it freezing a record and locking the document. `sortOrder` is
// required (never defaulted) on create, so it needs no re-declaration; reorder
// goes through ReorderDocumentStagesInput anyway.
export const UpdateDocumentStageInput = CreateDocumentStageInput.extend({
  stageType: DocumentStageType,
  snapshotOnEnter: z.boolean(),
  numberOnEnter: z.boolean(),
  locksEditing: z.boolean(),
}).partial();
export type UpdateDocumentStageInput = z.infer<typeof UpdateDocumentStageInput>;

// Reorder takes the desired final ordering — the service rewrites sort_order on
// each stage atomically inside one transaction.
export const ReorderDocumentStagesInput = z.object({
  stageIds: z.array(z.string().uuid()).min(1).max(50),
});
export type ReorderDocumentStagesInput = z.infer<typeof ReorderDocumentStagesInput>;

// ── Line-type registry ─────────────────────────────────────────────────────
export const CreateDocumentLineTypeInput = z.object({
  key: Slug,
  name: z.string().min(1).max(80),
  label: z.string().min(1).max(80),
  pricingMode: LinePricingMode.default('flat'),
  defaultTaxable: z.boolean().default(true),
  defaultMarkupRuleId: z.string().uuid().optional().nullable(),
  computation: z.string().min(1).max(40).optional().nullable(),
  glCode: z.string().min(1).max(40).optional().nullable(),
  category: z.string().min(1).max(40).optional().nullable(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});
export type CreateDocumentLineTypeInput = z.infer<typeof CreateDocumentLineTypeInput>;

// `key` is immutable once set (it is the stable line FK), so the update shape
// drops it.
//
// The four re-declarations are load-bearing, not noise. `.partial()` makes a
// field optional but leaves any `.default(...)` INTACT, so Zod fabricates a
// value for every defaulted field the caller omitted. The service updates each
// field that is `!== undefined` — which a fabricated default satisfies — so a
// PATCH of `{name, label}` alone silently reset pricingMode to 'flat',
// defaultTaxable to true, isActive to true and sortOrder to 0. Renaming a line
// type's label wiped how it prices. Stripping the defaults here is what makes
// the service's partial-update guards mean what they say.
export const UpdateDocumentLineTypeInput = CreateDocumentLineTypeInput.omit({
  key: true,
})
  .extend({
    pricingMode: LinePricingMode,
    defaultTaxable: z.boolean(),
    isActive: z.boolean(),
    sortOrder: z.number().int().min(0),
  })
  .partial();
export type UpdateDocumentLineTypeInput = z.infer<typeof UpdateDocumentLineTypeInput>;

// ── Documents (Phase 2) ─────────────────────────────────────────────────────
// `taxRate` is a fraction (0.0875 = 8.75%) applied to taxable lines (§7).
const Address = z.record(z.string(), z.unknown());

// ── The buyer's purchase order number ───────────────────────────────────────
//
// The number the CUSTOMER's own books give this purchase ("WFUC-24-0817"). A
// business buying on account will not pay an invoice its accounts department
// cannot match to a purchase order, so the number has to ride on the quote, the
// order made from it, and the invoice, and be printed on all of them (sparx
// persona issue 077).
//
// It has no column. Web checkout already writes it to `order.metadata.poNumber`,
// so a billing document keeps it in the same place on its own metadata, and
// every reader goes through `poNumberOf` rather than poking at the bag. Same
// length limit as checkout's, so a number taken at checkout always fits here.
export const PoNumber = z
  .string()
  .trim()
  .max(63, 'A purchase order number is at most 63 characters.');

/** The buyer's PO number in a metadata bag (a document's or an order's), or
 *  null when there is none. Blank counts as none. */
export function poNumberOf(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).poNumber;
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/**
 * A metadata bag with the PO number set, or removed when blank.
 *
 * MERGED, never replaced: the same bag carries `sentAt` / `sentTo` (the send
 * route) and `source` / `orderId` (the AR path), and a header save that wrote
 * `{ poNumber }` over it would make a sent invoice read as never sent.
 */
export function withPoNumber(
  metadata: unknown,
  poNumber: string | null | undefined
): Record<string, unknown> {
  const base =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};
  const trimmed = poNumber?.trim() ?? '';
  if (trimmed === '') {
    delete base.poNumber;
    return base;
  }
  return { ...base, poNumber: trimmed };
}

// ── The payment terms a bill was issued on ──────────────────────────────────
//
// The agreement the due date was worked out from ("net45"), frozen on the bill
// when it is issued, the way its PO number is: an account whose terms change
// later does not rewrite a bill already in its hands. Printed beside the due
// date as "Net 45". Gillett's own footer said "payment due Net 30" on Salt Lake
// County's bill, due Nov 20 on Net 45, because nothing on the bill could say
// the account's own terms (sparx persona issue 103).
//
// Only a day count is printed. "Pay up front" and "nothing agreed" leave the
// line off rather than print a word that is not terms.

/** The terms frozen on a bill, as stored (`net45`), or null when none. */
export function paymentTermsOf(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).paymentTerms;
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/** A metadata bag with the terms set, MERGED like `withPoNumber`. Terms that
 *  are not a day count are not stored, and a bag that already has terms keeps
 *  them: they were frozen when it was issued. */
export function withPaymentTerms(
  metadata: unknown,
  terms: string | null | undefined
): Record<string, unknown> {
  const base =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};
  if (paymentTermsOf(base) !== null || paymentTermsWords(terms) === null) return base;
  return { ...base, paymentTerms: terms?.trim().toLowerCase() };
}

/** Terms as a bill prints them: "Net 45". Null for anything that is not a
 *  day count. */
export function paymentTermsWords(terms: string | null | undefined): string | null {
  const match = /^net\s*(\d{1,3})$/i.exec(terms?.trim() ?? '');
  const days = match?.[1] ? Number(match[1]) : 0;
  return days > 0 ? `Net ${String(days)}` : null;
}

// ── What the buyer needs about delivery ─────────────────────────────────────
//
// A trade buyer's request carries when they need it, where it goes, and any
// other word about getting it there (sparx persona issue 086). Like the PO
// number it has no column: it rides in the quote's metadata bag under
// `delivery`, and every reader goes through `deliveryNeedsOf`.

export interface DeliveryNeeds {
  /** A calendar day, `YYYY-MM-DD`, or null when they did not say. */
  neededBy: string | null;
  deliverTo: string | null;
  notes: string | null;
}

const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;

function cleanText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/** The delivery needs in a metadata bag, or null when none were given. */
export function deliveryNeedsOf(metadata: unknown): DeliveryNeeds | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const raw = (metadata as Record<string, unknown>).delivery;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const bag = raw as Record<string, unknown>;
  const neededBy =
    typeof bag.neededBy === 'string' && CALENDAR_DAY.test(bag.neededBy) ? bag.neededBy : null;
  const needs = { neededBy, deliverTo: cleanText(bag.deliverTo), notes: cleanText(bag.notes) };
  return needs.neededBy || needs.deliverTo || needs.notes ? needs : null;
}

/** A metadata bag with the delivery needs set, MERGED like `withPoNumber`.
 *  Nothing said means no `delivery` key at all. */
export function withDeliveryNeeds(
  metadata: unknown,
  needs: DeliveryNeeds
): Record<string, unknown> {
  const base =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};
  const clean = deliveryNeedsOf({ delivery: needs });
  if (!clean) {
    delete base.delivery;
    return base;
  }
  return { ...base, delivery: clean };
}

export const CreateBillingDocumentInput = z
  .object({
    workflowId: z.string().uuid(),
    // The SITE issuing this document (docs/131 §3.6) — decides whose numbering
    // sequence it draws from and whose letterhead freezes onto it at finalize.
    // Defaults to the tenant's primary site when omitted, which is correct for a
    // single-business tenant and is the only safe default for a multi-site one
    // (an issuer must exist before a number can be allocated).
    propertyId: z.string().uuid().optional(),
    // Defaults to the workflow's first stage when omitted.
    stageId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional().nullable(),
    companyId: z.string().uuid().optional().nullable(),
    assignedUserId: z.string().uuid().optional().nullable(),
    currency: z
      .string()
      .regex(/^[A-Za-z]{3}$/, 'A currency code is three letters, like USD or GBP')
      .default('USD'),
    taxRate: z.number().min(0).max(1).default(0),
    billTo: Address.optional().nullable(),
    shipTo: Address.optional().nullable(),
    shippingTotal: z.number().min(0).default(0),
    surchargeTotal: z.number().min(0).default(0),
    // The note PRINTED ON THE DOCUMENT. `billing-document-html` renders it under
    // a "Notes" heading and `billing-snapshot` freezes it, so this is what the
    // customer reads.
    notes: z.string().max(5000).optional().nullable(),
    // Inert on a billing document: nothing writes it and nothing renders it. It
    // was carried over from the retired Quote model's internal/customer note
    // split, and the comment here used to claim the reverse -- that `notes` was
    // staff-internal and this was customer-visible. It is not true of this model
    // and following it would have moved the customer's note somewhere no
    // customer can see. (`customerNote` IS live on Order, Return and Quote.)
    customerNote: z.string().max(2000).optional().nullable(),
    validUntil: z.string().datetime().optional().nullable(),
    // Net-terms due date. Usually set automatically on finalize from the B2B
    // account's payment terms (§8); settable by hand for an explicit term.
    dueAt: z.string().datetime().optional().nullable(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    // The buyer's purchase order number, kept in `metadata.poNumber` (see
    // `PoNumber`). Blank or null means none.
    poNumber: PoNumber.optional().nullable(),
  })
  .refine((v) => Boolean(v.customerId) || Boolean(v.companyId), {
    message: 'A billing document must bill a customer or a B2B account.',
    path: ['customerId'],
  });
export type CreateBillingDocumentInput = z.infer<typeof CreateBillingDocumentInput>;

export const UpdateBillingDocumentInput = z
  .object({
    customerId: z.string().uuid().nullable(),
    companyId: z.string().uuid().nullable(),
    assignedUserId: z.string().uuid().nullable(),
    currency: z
      .string()
      .regex(/^[A-Za-z]{3}$/, 'A currency code is three letters, like USD or GBP'),
    taxRate: z.number().min(0).max(1),
    billTo: Address.nullable(),
    shipTo: Address.nullable(),
    shippingTotal: z.number().min(0),
    surchargeTotal: z.number().min(0),
    notes: z.string().max(5000).nullable(),
    customerNote: z.string().max(2000).nullable(),
    // Set alongside a `void`-type stage advance (e.g. Declined) — why the
    // document was rejected. Not stage-driven itself; the caller sets both.
    declinedReason: z.string().max(500).nullable(),
    validUntil: z.string().datetime().nullable(),
    dueAt: z.string().datetime().nullable(),
    metadata: z.record(z.string(), z.unknown()),
    // Merged into `metadata.poNumber`; blank or null removes it. Never replaces
    // the rest of the bag (see `withPoNumber`).
    poNumber: PoNumber.nullable(),
  })
  .partial();
export type UpdateBillingDocumentInput = z.infer<typeof UpdateBillingDocumentInput>;

// ── Payments / AR (Phase 4, §8) ──────────────────────────────────────────────
export const BillingPaymentKind = z.enum(['deposit', 'payment', 'refund']);
export type BillingPaymentKind = z.infer<typeof BillingPaymentKind>;

export const BillingPaymentMethod = z.enum([
  'cash',
  'card',
  'check',
  'ach',
  'wire',
  'account_credit',
  // legacy alias of 'account_credit' (store→site rename); tolerated on read.
  'store_credit',
  'other',
]);
export type BillingPaymentMethod = z.infer<typeof BillingPaymentMethod>;

// Record a deposit / payment / refund against a document. Append-only: a
// correction is a new `refund` row, never an edit. `amount` is always positive;
// `kind` decides the direction.
export const RecordBillingPaymentInput = z.object({
  kind: BillingPaymentKind.default('payment'),
  method: BillingPaymentMethod.default('other'),
  amount: z.number().positive(),
  reference: z.string().max(120).optional().nullable(),
  providerRef: z.string().max(200).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
  receivedAt: z.string().datetime().optional().nullable(),
});
export type RecordBillingPaymentInput = z.infer<typeof RecordBillingPaymentInput>;

// Move a document to another stage in its workflow (docs/87 §3). Entering the
// target stage runs its configured entry effects: mint/restamp the number,
// freeze an immutable snapshot, set finalized/voided timestamps, lock editing.
export const AdvanceBillingDocumentInput = z.object({
  stageId: z.string().uuid(),
});
export type AdvanceBillingDocumentInput = z.infer<typeof AdvanceBillingDocumentInput>;

export const ListBillingDocumentsInput = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  workflowId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  // The member's reachable sites (docs/131 §3.3), set by the route from site
  // access — undefined = unrestricted. A document's `propertyId` is REQUIRED
  // (every invoice has an issuer), so there is no null/orphaned case: a
  // restricted member sees strictly their granted businesses' documents.
  propertyIds: z.array(z.string().uuid()).optional(),
  status: z.string().max(20).optional(),
  /**
   * Whether the customer has actually been given the document.
   *
   * Separate from `status`, and deliberately so: status is about the MONEY
   * (unpaid, partial, paid, void) and this is about whether the bill was ever
   * handed over. An unpaid invoice nobody sent and an unpaid invoice sent three
   * weeks ago are the same status and completely different problems, and only
   * one of them is the customer's fault. `false` is the one worth filtering to.
   *
   * `preprocess`, never `z.coerce.boolean()`: that is `Boolean(value)`, so the
   * string "false" off a query string arrives as TRUE and the filter returns the
   * exact opposite of what was asked for.
   */
  sent: z.preprocess((v) => (typeof v === 'string' ? v === 'true' : v), z.boolean()).optional(),
  /**
   * Whether the money is actually late, asked of the CLOCK rather than of the
   * status column.
   *
   * Separate from `status` for exactly the reason `sent` is, one field up:
   * status is about the MONEY (unpaid, partial, paid, void) and this is about
   * the date. The two are independent, and the column collapses them — it can
   * only hold one word, so a part-paid invoice three weeks past its due date is
   * stored as `partial` and nothing anywhere says it is late.
   *
   * That column is also written only when something HAPPENS to the document —
   * a line, a payment, a void — and a due date passing is not something
   * happening. Nothing writes it, so `status = 'overdue'` finds only the
   * documents that were touched after they went late. Measured on the dev
   * database: 54 invoices and $51,456.69 are genuinely past due; that filter
   * found 30 of them and $26,983.76. One shop was owed $986.50 across eight
   * late invoices and its Overdue list was empty.
   *
   * `true` is the only useful value; `false` would ask for "not late yet",
   * which no screen asks.
   *
   * `preprocess`, never `z.coerce.boolean()` — same trap as `sent`.
   */
  pastDue: z.preprocess((v) => (typeof v === 'string' ? v === 'true' : v), z.boolean()).optional(),
  includeDeleted: z.boolean().optional(),
  // `z.coerce.number()` (not `z.number()`) so HTTP query strings — the dashboard
  // hits `/v1/invoicing/documents?limit=100`, and the route pipes `request.query`
  // straight in — coerce instead of 422-ing on `expected number, received string`.
  // Coercion is a no-op on the real numbers the invoicing MCP tool passes, so this
  // single funnel stays correct for both callers (docs/87 §2).
  limit: z.coerce.number().int().min(1).max(250).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  // Sorting is a WHITELIST, never a raw column name — `orderBy` is interpolated
  // into the query, so an open string would be an injection surface.
  //
  // `number` sorts on `numberSeq`, not the rendered string: "INV-000009" vs
  // "INV-000010" only compares correctly while the zero-padding width never
  // changes, and it silently stops at the 10th document past a width bump.
  // 'customer' orders by the LIVE customer/B2B-account relation — the frozen
  // bill-to name is JSON and cannot be ordered by.
  sortBy: z
    .enum(['number', 'customer', 'status', 'dueAt', 'total', 'balance', 'updatedAt', 'createdAt'])
    .default('dueAt'),
  // Direction, which the rest of the platform hardcodes to 'desc'.
  //
  // It cannot be hardcoded here: a receivables list is read "what is due
  // soonest" — ASCENDING — and that is the single most useful order this
  // screen has. Precedent for a real direction param is scheduling/bookings.
  order: z.enum(['asc', 'desc']).default('asc'),
});
export type ListBillingDocumentsInput = z.infer<typeof ListBillingDocumentsInput>;

// ── Lines (Phase 2) ─────────────────────────────────────────────────────────
// The `markup` directive (rule | ad-hoc) is NOT modeled here: it lives in
// @wizeworks/commerce-schemas (`LineMarkupInput`), which depends on this package, so
// modeling it here would cycle. The service validates `markup` against that
// schema before pricing. Pass either `lineTypeId` or `lineTypeKey` to resolve
// the line type (and its pricingMode + tax default).
// `quantity`/`discountAmount` carry NO default here on purpose: this core is
// shared by both Add (via `.extend()` below, which layers create-time
// defaults on top) and Update (via `.partial()`), and Zod does not drop a
// field's `.default()` when `.partial()` makes it optional — an update PATCH
// that omits `quantity` would silently parse to `1` instead of `undefined`,
// so `updateLine()`'s `input.quantity ?? existing.quantity` fallback would
// never fire and every partial line edit would reset quantity to 1 (and
// discount to 0). Defaults belong only on the create path.
export const BillingLineWriteCore = z.object({
  lineTypeId: z.string().uuid().optional().nullable(),
  lineTypeKey: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z][a-z0-9-]*$/, 'Slug must be lowercase kebab-case')
    .optional(),
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  variantId: z.string().uuid().optional().nullable(),
  productId: z.string().uuid().optional().nullable(),
  explicitCostCents: z.number().int().nonnegative().optional().nullable(),
  unitPrice: z.number().min(0).optional().nullable(),
  technicianUserId: z.string().uuid().optional().nullable(),
  // Defaults to the line type's `defaultTaxable` when omitted.
  taxable: z.boolean().optional(),
  // Core charge per unit on a rebuilt part: a refundable deposit, printed as its
  // own row and never taxed (sparx issue 051). Omitted on a catalog line, it is the
  // variant's own; null takes it off.
  coreCharge: z.number().positive().optional().nullable(),
  discountAmount: z.number().min(0),
  sortOrder: z.number().int().min(0).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type BillingLineWriteCore = z.infer<typeof BillingLineWriteCore>;

export const AddBillingLineInput = BillingLineWriteCore.extend({
  quantity: z.number().positive().default(1),
  discountAmount: z.number().min(0).default(0),
});
export type AddBillingLineInput = z.infer<typeof AddBillingLineInput>;

export const UpdateBillingLineInput = BillingLineWriteCore.partial();
export type UpdateBillingLineInput = z.infer<typeof UpdateBillingLineInput>;

// ── Print templates (Phase 5b, §10) ──────────────────────────────────────────
// The document's printed presentation is ONE BuilderNode tree (AUTHOR-only) — a
// peer of the page/email builder trees. Validated structurally HERE so crm-schemas
// stays free of a @wizeworks/builder-schemas dependency; the api-rest renderer, which
// has builder-schemas, interprets the tree (resolving bindings + serializing Prose).
export interface InvoiceTemplateNodeInput {
  id: string;
  type: string;
  name?: string;
  class?: string;
  props?: Record<string, unknown>;
  binding?: { path: string; format?: string };
  children?: InvoiceTemplateNodeInput[];
}

export const InvoiceTemplateNode: z.ZodType<InvoiceTemplateNodeInput> = z.lazy(() =>
  z.object({
    id: z.string().min(1).max(64),
    type: z.string().min(1).max(40),
    name: z.string().max(120).optional(),
    class: z.string().max(2000).optional(),
    props: z.record(z.string(), z.unknown()).optional(),
    binding: z
      .object({ path: z.string().min(1).max(200), format: z.string().max(40).optional() })
      .optional(),
    children: z.array(InvoiceTemplateNode).optional(),
  })
);

export const CreateBillingTemplateInput = z.object({
  name: z.string().min(1).max(120),
  // Defaults to a blank single-section tree when omitted.
  tree: InvoiceTemplateNode.optional(),
  isDefault: z.boolean().default(false),
  // Which business this letterhead belongs to; null (or absent) means every
  // site, which is the right answer for an account with one business and for a
  // deliberately neutral template. A letterhead is brand artwork, so one shared
  // across two unrelated businesses is the same defect as a shared sender
  // identity -- see BillingDocumentTemplate in 72-invoicing.prisma.
  propertyId: z.string().uuid().nullish(),
});
export type CreateBillingTemplateInput = z.infer<typeof CreateBillingTemplateInput>;

export const UpdateBillingTemplateInput = z
  .object({
    name: z.string().min(1).max(120),
    // The high-frequency editor autosave path.
    tree: InvoiceTemplateNode,
    // Moving a letterhead between businesses, or to the shared tier. Nullable
    // rather than optional-only: `null` is a value here ("every site"), so it
    // has to be distinguishable from "leave it where it is".
    propertyId: z.string().uuid().nullable(),
  })
  .partial();
export type UpdateBillingTemplateInput = z.infer<typeof UpdateBillingTemplateInput>;
