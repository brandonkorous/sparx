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

export const UpdateDocumentWorkflowInput = CreateDocumentWorkflowInput.partial();
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

export const UpdateDocumentStageInput = CreateDocumentStageInput.partial();
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
export const UpdateDocumentLineTypeInput = CreateDocumentLineTypeInput.omit({
  key: true,
}).partial();
export type UpdateDocumentLineTypeInput = z.infer<typeof UpdateDocumentLineTypeInput>;

// ── Documents (Phase 2) ─────────────────────────────────────────────────────
// `taxRate` is a fraction (0.0875 = 8.75%) applied to taxable lines (§7).
const Address = z.record(z.string(), z.unknown());

export const CreateBillingDocumentInput = z
  .object({
    workflowId: z.string().uuid(),
    // Defaults to the workflow's first stage when omitted.
    stageId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional().nullable(),
    b2bAccountId: z.string().uuid().optional().nullable(),
    assignedUserId: z.string().uuid().optional().nullable(),
    currency: z.string().length(3).default('USD'),
    taxRate: z.number().min(0).max(1).default(0),
    billTo: Address.optional().nullable(),
    shipTo: Address.optional().nullable(),
    shippingTotal: z.number().min(0).default(0),
    surchargeTotal: z.number().min(0).default(0),
    notes: z.string().max(5000).optional().nullable(),
    validUntil: z.string().datetime().optional().nullable(),
    // Net-terms due date. Usually set automatically on finalize from the B2B
    // account's payment terms (§8); settable by hand for an explicit term.
    dueAt: z.string().datetime().optional().nullable(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((v) => Boolean(v.customerId) || Boolean(v.b2bAccountId), {
    message: 'A billing document must bill a customer or a B2B account.',
    path: ['customerId'],
  });
export type CreateBillingDocumentInput = z.infer<typeof CreateBillingDocumentInput>;

export const UpdateBillingDocumentInput = z
  .object({
    customerId: z.string().uuid().nullable(),
    b2bAccountId: z.string().uuid().nullable(),
    assignedUserId: z.string().uuid().nullable(),
    currency: z.string().length(3),
    taxRate: z.number().min(0).max(1),
    billTo: Address.nullable(),
    shipTo: Address.nullable(),
    shippingTotal: z.number().min(0),
    surchargeTotal: z.number().min(0),
    notes: z.string().max(5000).nullable(),
    validUntil: z.string().datetime().nullable(),
    dueAt: z.string().datetime().nullable(),
    metadata: z.record(z.string(), z.unknown()),
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
  workflowId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  b2bAccountId: z.string().uuid().optional(),
  status: z.string().max(20).optional(),
  includeDeleted: z.boolean().optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});
export type ListBillingDocumentsInput = z.infer<typeof ListBillingDocumentsInput>;

// ── Lines (Phase 2) ─────────────────────────────────────────────────────────
// The `markup` directive (rule | ad-hoc) is NOT modeled here: it lives in
// @sparx/commerce-schemas (`LineMarkupInput`), which depends on this package, so
// modeling it here would cycle. The service validates `markup` against that
// schema before pricing. Pass either `lineTypeId` or `lineTypeKey` to resolve
// the line type (and its pricingMode + tax default).
export const BillingLineWriteCore = z.object({
  lineTypeId: z.string().uuid().optional().nullable(),
  lineTypeKey: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z][a-z0-9-]*$/, 'Slug must be lowercase kebab-case')
    .optional(),
  description: z.string().min(1).max(500),
  quantity: z.number().positive().default(1),
  variantId: z.string().uuid().optional().nullable(),
  productId: z.string().uuid().optional().nullable(),
  explicitCostCents: z.number().int().nonnegative().optional().nullable(),
  unitPrice: z.number().min(0).optional().nullable(),
  technicianUserId: z.string().uuid().optional().nullable(),
  // Defaults to the line type's `defaultTaxable` when omitted.
  taxable: z.boolean().optional(),
  discountAmount: z.number().min(0).default(0),
  sortOrder: z.number().int().min(0).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type BillingLineWriteCore = z.infer<typeof BillingLineWriteCore>;

export const AddBillingLineInput = BillingLineWriteCore;
export type AddBillingLineInput = z.infer<typeof AddBillingLineInput>;

export const UpdateBillingLineInput = BillingLineWriteCore.partial();
export type UpdateBillingLineInput = z.infer<typeof UpdateBillingLineInput>;

// ── Print templates (Phase 5b, §10) ──────────────────────────────────────────
// The document's printed presentation is ONE BuilderNode tree (AUTHOR-only) — a
// peer of the page/email builder trees. Validated structurally HERE so crm-schemas
// stays free of a @sparx/builder-schemas dependency; the api-rest renderer, which
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
});
export type CreateBillingTemplateInput = z.infer<typeof CreateBillingTemplateInput>;

export const UpdateBillingTemplateInput = z
  .object({
    name: z.string().min(1).max(120),
    // The high-frequency editor autosave path.
    tree: InvoiceTemplateNode,
  })
  .partial();
export type UpdateBillingTemplateInput = z.infer<typeof UpdateBillingTemplateInput>;
