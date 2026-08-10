// Invoicing MCP tools (docs/87 §12) — natural-language authoring of billing
// documents. A thin wrapper over the same services the REST transport uses (one
// service layer, three transports): "Start an estimate for Gillett's truck #14 —
// 2 injectors and 3 hours labor", "Approve the estimate", "Mark INV-000123 paid by
// check."
//
// These carry the dedicated `read:invoicing` / `write:invoicing` scopes (the
// Invoicing module is first-class, not a CRM sub-feature), so they ship as their
// OWN array — NOT merged into `crmMcpTools`. The MCP server additionally gates them
// on the `invoicing` module flag (a disabled module stores no rows, docs/87 §14).

import { z } from 'zod';
import {
  AddBillingLineInput,
  CreateBillingTemplateInput,
  CreateDocumentLineTypeInput,
  CreateDocumentStageInput,
  CreateDocumentWorkflowInput,
  ListBillingDocumentsInput,
  RecordBillingPaymentInput,
  ReorderDocumentStagesInput,
  UpdateBillingDocumentInput,
  UpdateBillingLineInput,
  UpdateBillingTemplateInput,
  UpdateDocumentLineTypeInput,
  UpdateDocumentStageInput,
  UpdateDocumentWorkflowInput,
} from '@sparx/crm-schemas';

import type { ServiceContext } from '../errors';
import {
  billingDocumentService,
  billingDocumentStageService,
  billingLineService,
  billingPaymentService,
  billingTemplateService,
  documentLineTypeService,
  documentWorkflowService,
} from '../services';

export type InvoicingMcpScope = 'read:invoicing' | 'write:invoicing';

export interface InvoicingMcpTool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  scope: InvoicingMcpScope;
  input: z.ZodType<TInput>;
  /** Consequential writes (finalize/lock, money) — the MCP client confirms first. */
  confirmation: boolean;
  run(ctx: ServiceContext, input: TInput): Promise<TOutput>;
}

const PathDoc = z.object({ documentId: z.string().uuid() });

// Create — a plain object (the service re-validates with the authoritative
// `CreateBillingDocumentInput`, whose refine requires a customer OR account).
const CreateInput = z.object({
  workflowId: z.string().uuid(),
  stageId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  currency: z.string().length(3).optional(),
  taxRate: z.number().min(0).max(1).optional(),
  shippingTotal: z.number().min(0).optional(),
  surchargeTotal: z.number().min(0).optional(),
  notes: z.string().max(5000).optional(),
  validUntil: z.string().datetime().optional(),
  dueAt: z.string().datetime().optional(),
});

const AddLineInput = AddBillingLineInput.extend({ documentId: z.string().uuid() });
const AdvanceInput = z.object({
  documentId: z.string().uuid(),
  stageId: z.string().uuid(),
});
const RecordPaymentInput = RecordBillingPaymentInput.extend({ documentId: z.string().uuid() });

const readTools: InvoicingMcpTool[] = [
  {
    name: 'get_document_workflows',
    description:
      "List the tenant's billing document workflows and their stages (with each stage id, customer-facing label, and behavior). Call this first to resolve the workflowId for a new document and the stageId to advance to.",
    scope: 'read:invoicing',
    confirmation: false,
    input: z.object({}),
    run: (ctx) => documentWorkflowService.list(ctx),
  },
  {
    name: 'get_billing_documents',
    description:
      'List billing documents (estimates / invoices / work orders), optionally filtered by status, workflow, customer or B2B account. Returns up to 200 rows.',
    scope: 'read:invoicing',
    confirmation: false,
    input: ListBillingDocumentsInput,
    run: (ctx, input) => billingDocumentService.list(ctx, input),
  },
  {
    name: 'get_billing_document',
    description: 'Fetch one billing document by id, including its line items and totals.',
    scope: 'read:invoicing',
    confirmation: false,
    input: PathDoc,
    run: (ctx, input) =>
      billingDocumentService.get(ctx, (input as { documentId: string }).documentId),
  },
];

const writeTools: InvoicingMcpTool[] = [
  {
    name: 'create_billing_document',
    description:
      'Start a billing document (estimate / invoice / work order) on a workflow, billing a retail customer or a B2B account. Returns the created document; add line items with add_billing_line.',
    scope: 'write:invoicing',
    confirmation: false,
    input: CreateInput,
    run: (ctx, input) => billingDocumentService.create(ctx, input),
  },
  {
    name: 'add_billing_line',
    description:
      "Add a charge line to a billing document — a product, a service (rate × hours), a flat fee, or a pass-through cost. Pass a lineTypeKey (one of the tenant's own line-type slugs — list them if unsure) and a unitPrice; an optional explicitCostCents records the cost basis so margin is tracked.",
    scope: 'write:invoicing',
    confirmation: false,
    input: AddLineInput,
    run: (ctx, input) => {
      const { documentId, ...rest } = input as z.infer<typeof AddLineInput>;
      return billingLineService.addLine(ctx, documentId, rest);
    },
  },
  {
    name: 'advance_billing_document',
    description:
      'Move a billing document to another stage in its workflow (e.g. approve an estimate, or convert it to an invoice). Entering a stage may assign its number, freeze a permanent record, and lock the lines — confirm before advancing.',
    scope: 'write:invoicing',
    confirmation: true,
    input: AdvanceInput,
    run: (ctx, input) => {
      const { documentId, stageId } = input as z.infer<typeof AdvanceInput>;
      return billingDocumentStageService.advance(ctx, documentId, { stageId });
    },
  },
  {
    name: 'record_billing_payment',
    description:
      "Record a deposit, payment, or refund against a billing document. The document's amount paid, balance, and AR status recompute automatically.",
    scope: 'write:invoicing',
    confirmation: true,
    input: RecordPaymentInput,
    run: (ctx, input) => {
      const { documentId, ...rest } = input as z.infer<typeof RecordPaymentInput>;
      return billingPaymentService.recordPayment(ctx, documentId, rest);
    },
  },
];

// ─── Management tools — document edit/delete, line edit/delete, and the
// invoicing CONFIGURATION surface (line types, print templates, workflows +
// stages). Thin wrappers over the same services the REST routes use.
// convert-to-order is already exposed as the CRM `convert_quote_to_order` tool.

const uuid = () => z.string().uuid();
type Rec = Record<string, unknown>;

const managementTools: InvoicingMcpTool[] = [
  {
    name: 'update_billing_document',
    description:
      'Edit a billing document’s header (customer/account, dates, terms, notes, references). Send only the fields to change. Lines are edited with the line tools; stage moves go through advance_billing_document.',
    scope: 'write:invoicing',
    confirmation: true,
    input: UpdateBillingDocumentInput.extend({ documentId: uuid() }),
    run: (ctx, input) => {
      const { documentId, ...patch } = input as { documentId: string } & Rec;
      return billingDocumentService.update(ctx, documentId, patch);
    },
  },
  {
    name: 'delete_billing_document',
    description:
      'Soft-delete a billing document (draft/estimate). Finalized, numbered records are kept for the audit trail; the service refuses to remove a frozen document.',
    scope: 'write:invoicing',
    confirmation: true,
    input: z.object({ documentId: uuid() }),
    run: (ctx, input) =>
      billingDocumentService.remove(ctx, (input as { documentId: string }).documentId),
  },
  {
    name: 'update_billing_line',
    description:
      'Edit a line on a billing document (quantity, price, description, tax). Send only the fields to change.',
    scope: 'write:invoicing',
    confirmation: true,
    input: UpdateBillingLineInput.extend({ lineId: uuid() }),
    run: (ctx, input) => {
      const { lineId, ...patch } = input as { lineId: string } & Rec;
      return billingLineService.updateLine(ctx, lineId, patch);
    },
  },
  {
    name: 'remove_billing_line',
    description: 'Remove a line from a billing document; totals recompute.',
    scope: 'write:invoicing',
    confirmation: true,
    input: z.object({ lineId: uuid() }),
    run: (ctx, input) => billingLineService.removeLine(ctx, (input as { lineId: string }).lineId),
  },
  // Line types (reusable line presets)
  {
    name: 'create_document_line_type',
    description:
      'Create a reusable document line type (a preset line — labor, part, fee — with defaults).',
    scope: 'write:invoicing',
    confirmation: true,
    input: CreateDocumentLineTypeInput,
    run: (ctx, input) => documentLineTypeService.create(ctx, input),
  },
  {
    name: 'update_document_line_type',
    description: 'Edit a document line type. Send only the fields to change.',
    scope: 'write:invoicing',
    confirmation: true,
    input: UpdateDocumentLineTypeInput.extend({ lineTypeId: uuid() }),
    run: (ctx, input) => {
      const { lineTypeId, ...patch } = input as { lineTypeId: string } & Rec;
      return documentLineTypeService.update(ctx, lineTypeId, patch);
    },
  },
  {
    name: 'delete_document_line_type',
    description: 'Delete a document line type.',
    scope: 'write:invoicing',
    confirmation: true,
    input: z.object({ lineTypeId: uuid() }),
    run: (ctx, input) =>
      documentLineTypeService.remove(ctx, (input as { lineTypeId: string }).lineTypeId),
  },
  // Print/PDF templates
  {
    name: 'create_billing_template',
    description:
      'Create a billing document print/PDF template (the branded layout an invoice/estimate renders with).',
    scope: 'write:invoicing',
    confirmation: true,
    input: CreateBillingTemplateInput,
    run: (ctx, input) => billingTemplateService.create(ctx, input),
  },
  {
    name: 'update_billing_template',
    description:
      'Edit a billing template (draft). Send only the fields to change; publish_billing_template makes a draft live.',
    scope: 'write:invoicing',
    confirmation: true,
    input: UpdateBillingTemplateInput.extend({ templateId: uuid() }),
    run: (ctx, input) => {
      const { templateId, ...patch } = input as { templateId: string } & Rec;
      return billingTemplateService.update(ctx, templateId, patch);
    },
  },
  {
    name: 'publish_billing_template',
    description: 'Publish a billing template draft so documents can render with it.',
    scope: 'write:invoicing',
    confirmation: true,
    input: z.object({ templateId: uuid() }),
    run: (ctx, input) =>
      billingTemplateService.publish(ctx, (input as { templateId: string }).templateId),
  },
  {
    name: 'set_default_billing_template',
    description: 'Make a billing template the default for new documents.',
    scope: 'write:invoicing',
    confirmation: true,
    input: z.object({ templateId: uuid() }),
    run: (ctx, input) =>
      billingTemplateService.setDefault(ctx, (input as { templateId: string }).templateId),
  },
  {
    name: 'delete_billing_template',
    description: 'Delete a billing template.',
    scope: 'write:invoicing',
    confirmation: true,
    input: z.object({ templateId: uuid() }),
    run: (ctx, input) =>
      billingTemplateService.remove(ctx, (input as { templateId: string }).templateId),
  },
  // Workflows + stages (the document lifecycle)
  {
    name: 'create_document_workflow',
    description:
      'Create a document workflow — the ordered stages a document moves through (e.g. Draft → Sent → Approved → Invoiced).',
    scope: 'write:invoicing',
    confirmation: true,
    input: CreateDocumentWorkflowInput,
    run: (ctx, input) => documentWorkflowService.create(ctx, input),
  },
  {
    name: 'update_document_workflow',
    description: 'Edit a document workflow’s header. Send only the fields to change.',
    scope: 'write:invoicing',
    confirmation: true,
    input: UpdateDocumentWorkflowInput.extend({ workflowId: uuid() }),
    run: (ctx, input) => {
      const { workflowId, ...patch } = input as { workflowId: string } & Rec;
      return documentWorkflowService.update(ctx, workflowId, patch);
    },
  },
  {
    name: 'archive_document_workflow',
    description: 'Archive a document workflow so it stops appearing for new documents.',
    scope: 'write:invoicing',
    confirmation: true,
    input: z.object({ workflowId: uuid() }),
    run: (ctx, input) =>
      documentWorkflowService.archive(ctx, (input as { workflowId: string }).workflowId),
  },
  {
    name: 'add_document_stage',
    description: 'Add a stage to a document workflow.',
    scope: 'write:invoicing',
    confirmation: true,
    input: CreateDocumentStageInput.extend({ workflowId: uuid() }),
    run: (ctx, input) => {
      const { workflowId, ...body } = input as { workflowId: string } & Rec;
      return documentWorkflowService.createStage(ctx, workflowId, body);
    },
  },
  {
    name: 'update_document_stage',
    description: 'Edit a workflow stage (name, entry effects). Send only the fields to change.',
    scope: 'write:invoicing',
    confirmation: true,
    input: UpdateDocumentStageInput.extend({ stageId: uuid() }),
    run: (ctx, input) => {
      const { stageId, ...patch } = input as { stageId: string } & Rec;
      return documentWorkflowService.updateStage(ctx, stageId, patch);
    },
  },
  {
    name: 'delete_document_stage',
    description: 'Delete a stage from a document workflow.',
    scope: 'write:invoicing',
    confirmation: true,
    input: z.object({ stageId: uuid() }),
    run: (ctx, input) =>
      documentWorkflowService.deleteStage(ctx, (input as { stageId: string }).stageId),
  },
  {
    name: 'reorder_document_stages',
    description: 'Set the order of a document workflow’s stages by listing their ids in order.',
    scope: 'write:invoicing',
    confirmation: true,
    input: ReorderDocumentStagesInput.extend({ workflowId: uuid() }),
    run: (ctx, input) => {
      const { workflowId, ...body } = input as { workflowId: string } & Rec;
      return documentWorkflowService.reorderStages(ctx, workflowId, body);
    },
  },
];

/** The Invoicing tool set the MCP server publishes (docs/87 §12). */
export const invoicingMcpTools: InvoicingMcpTool[] = [
  ...readTools,
  ...writeTools,
  ...managementTools,
];
