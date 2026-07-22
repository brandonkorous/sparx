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
  ListBillingDocumentsInput,
  RecordBillingPaymentInput,
} from '@sparx/crm-schemas';

import type { ServiceContext } from '../errors';
import {
  billingDocumentService,
  billingDocumentStageService,
  billingLineService,
  billingPaymentService,
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
  b2bAccountId: z.string().uuid().optional(),
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

/** The Invoicing tool set the MCP server publishes (docs/87 §12). */
export const invoicingMcpTools: InvoicingMcpTool[] = [...readTools, ...writeTools];
