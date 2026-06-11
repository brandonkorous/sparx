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
export const UpdateDocumentLineTypeInput = CreateDocumentLineTypeInput.omit({ key: true }).partial();
export type UpdateDocumentLineTypeInput = z.infer<typeof UpdateDocumentLineTypeInput>;
