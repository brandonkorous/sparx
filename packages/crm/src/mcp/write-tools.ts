// Write MCP tools. Scope: 'write:crm' or 'write:crm_bulk'. All confirm.
// Bulk-modifying tools (bulk_assign_customers, bulk_tag_customers) need
// 'write:crm_bulk' which the MCP server treats as a stricter scope.

import { z } from 'zod';

import {
    CreateCompanyInput,
    CreateB2bAccountContactInput,
    CreatePipelineInput,
    CreatePipelineStageInput,
    CreateSegmentInput,
    CreateCustomerInput,
    MergeCustomersInput,
    ReorderPipelineStagesInput,
    UpdateCompanyInput,
    UpdateCustomerInput,
    UpdateDealInput,
    UpdatePipelineInput,
    UpdatePipelineStageInput,
    UpdateSegmentInput,
    UpdateTaskInput,
} from '@sparx/crm-schemas';

import {
    activityService,
    companyService,
    b2bAccountContactService,
    customerService,
    dealService,
    pipelineService,
    segmentService,
    taskService,
    billingDocumentConversionService,
} from '../services';

import type { McpToolDefinition } from './registry';

// The customer fields an MCP client can set — the friendly subset of
// CreateCustomerInput. Site/property assignment, metadata, GDPR consent and the
// avatar are managed by their own dedicated flows, not this general write. Picked
// from the schema (not re-declared) so validation — especially the three
// classification enums (type / lifecycleStage / leadStatus) — can never drift.
const CustomerWriteInput = CreateCustomerInput.pick({
    type: true,
    lifecycleStage: true,
    leadStatus: true,
    email: true,
    phone: true,
    firstName: true,
    lastName: true,
    company: true,
    jobTitle: true,
    companyId: true,
    assignedRepId: true,
    preferredContactMethod: true,
    doNotContact: true,
    tags: true,
});

// The PATCH shape must come from UpdateCustomerInput, not
// `CustomerWriteInput.partial()`: the create schema's `.default()`s survive
// `.partial()`, so the tool would fabricate type/lifecycleStage/doNotContact/tags
// for a caller that never mentioned them — quietly making "update one field"
// demote the contact to a lead, clear do-not-contact, and wipe its tags, despite
// the tool's own promise that omitted fields are left unchanged.
const CustomerPatchInput = UpdateCustomerInput.pick({
    type: true,
    lifecycleStage: true,
    leadStatus: true,
    email: true,
    phone: true,
    firstName: true,
    lastName: true,
    company: true,
    jobTitle: true,
    companyId: true,
    assignedRepId: true,
    preferredContactMethod: true,
    doNotContact: true,
    tags: true,
});

export const createCustomer: McpToolDefinition = {
    name: 'create_customer',
    description:
        'Add a customer / contact. Classification is three independent axes (docs/137): `type` is the RELATIONSHIP — retail | b2b | partner | vendor (default retail; only b2b applies trade pricing); `lifecycleStage` is where they are in the journey — subscriber | lead | marketing_qualified_lead | sales_qualified_lead | opportunity | customer | evangelist | other (default lead); `leadStatus` is the optional work-state on a lead. A first completed order later promotes them to the `customer` stage automatically.',
    scope: 'write:crm',
    confirmation: true,
    input: CustomerWriteInput,
    run: (ctx, input) => customerService.create(ctx, input),
};

export const updateCustomer: McpToolDefinition = {
    name: 'update_customer',
    description:
        'Update a customer / contact — any subset of fields, including the three classification axes (relationship `type`, `lifecycleStage`, `leadStatus`). Omitted fields are left unchanged; pass null to clear a nullable field.',
    scope: 'write:crm',
    confirmation: true,
    input: CustomerPatchInput.extend({ customerId: z.string().uuid() }),
    run: (ctx, input) => {
        const { customerId, ...patch } = input as { customerId: string } & Record<string, unknown>;
        return customerService.update(ctx, customerId, patch);
    },
};

export const deleteCustomer: McpToolDefinition = {
    name: 'delete_customer',
    description:
        'Soft-delete a customer / contact: the record is hidden from lists and search but not erased — their orders, deals and history are preserved and it can be restored.',
    scope: 'write:crm',
    confirmation: true,
    input: z.object({ customerId: z.string().uuid() }),
    run: (ctx, input) =>
        customerService.softDelete(ctx, (input as { customerId: string }).customerId),
};

export const addActivity: McpToolDefinition = {
    name: 'add_crm_activity',
    description:
        'Record a CRM activity (note / call / meeting) on a customer or deal. Activities are append-only — corrections insert a new row pointing at the original.',
    scope: 'write:crm',
    confirmation: true,
    input: z.object({
        customerId: z.string().uuid().nullable().optional(),
        dealId: z.string().uuid().nullable().optional(),
        type: z.enum(['note', 'call', 'meeting']),
        description: z.string().max(10_000),
    }),
    run: (ctx, input) => activityService.record(ctx, input),
};

export const createTask: McpToolDefinition = {
    name: 'create_task',
    description: 'Create a follow-up task assigned to a teammate.',
    scope: 'write:crm',
    confirmation: true,
    input: z.object({
        title: z.string().min(1).max(255),
        description: z.string().max(10_000).optional(),
        dueAt: z.string().datetime().optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
        assignedToUserId: z.string().uuid(),
        customerId: z.string().uuid().optional(),
        dealId: z.string().uuid().optional(),
    }),
    run: (ctx, input) => taskService.create(ctx, input),
};

export const completeTask: McpToolDefinition = {
    name: 'complete_task',
    description: 'Mark a task complete.',
    scope: 'write:crm',
    confirmation: true,
    input: z.object({ taskId: z.string().uuid() }),
    run: (ctx, input) => taskService.complete(ctx, input),
};

export const bulkAssignCustomers: McpToolDefinition = {
    name: 'bulk_assign_customers',
    description:
        'Bulk-assign a rep to a list of customers. Bulk write — the MCP server confirms with the user first.',
    scope: 'write:crm_bulk',
    confirmation: true,
    input: z.object({
        customerIds: z.array(z.string().uuid()).min(1).max(500),
        assignedRepId: z.string().uuid().nullable(),
    }),
    run: async (ctx, input) => {
        const { customerIds, assignedRepId } = input as {
            customerIds: string[];
            assignedRepId: string | null;
        };
        const results = [];
        for (const id of customerIds) {
            results.push(await customerService.update(ctx, id, { assignedRepId }));
        }
        return { updated: results.length };
    },
};

export const bulkTagCustomers: McpToolDefinition = {
    name: 'bulk_tag_customers',
    description: 'Bulk-add tags to customers. Existing tags are preserved.',
    scope: 'write:crm_bulk',
    confirmation: true,
    input: z.object({
        customerIds: z.array(z.string().uuid()).min(1).max(500),
        addTags: z.array(z.string().min(1).max(63)).min(1).max(20),
    }),
    run: async (ctx, input) => {
        const { customerIds, addTags } = input as {
            customerIds: string[];
            addTags: string[];
        };
        let updated = 0;
        for (const id of customerIds) {
            const customer = await customerService.get(ctx, id);
            const next = Array.from(new Set([...customer.tags, ...addTags]));
            await customerService.update(ctx, id, { tags: next });
            updated += 1;
        }
        return { updated };
    },
};

export const moveDealStage: McpToolDefinition = {
    name: 'move_deal_stage',
    description:
        'Move a deal to a new stage in the same pipeline. Emits crm.deal.stage_changed; the email automation engine subscribes to it.',
    scope: 'write:crm',
    confirmation: true,
    input: z.object({
        dealId: z.string().uuid(),
        toStageId: z.string().uuid(),
        closedReason: z.string().max(500).optional(),
    }),
    run: (ctx, input) => {
        const { dealId, ...rest } = input as {
            dealId: string;
            toStageId: string;
            closedReason?: string;
        };
        return dealService.moveStage(ctx, dealId, rest);
    },
};

export const createDeal: McpToolDefinition = {
    name: 'create_deal',
    description: 'Open a new sales deal on a pipeline.',
    scope: 'write:crm',
    confirmation: true,
    input: z.object({
        pipelineId: z.string().uuid(),
        stageId: z.string().uuid(),
        title: z.string().min(1).max(255),
        value: z.number().min(0).optional().default(0),
        probability: z.number().min(0).max(100).optional().default(0),
        customerId: z.string().uuid().optional(),
        companyId: z.string().uuid().optional(),
        assignedRepId: z.string().uuid().optional(),
        expectedCloseDate: z.string().date().optional(),
    }),
    run: (ctx, input) => dealService.create(ctx, input),
};

// A quote IS a BillingDocument on the system `b2b-quotes` workflow (docs/87
// convergence) — the tool name/scope stay stable for existing MCP clients.
export const convertQuote: McpToolDefinition = {
    name: 'convert_quote_to_order',
    description:
        'Convert an accepted quote into a new Order. Lines + header values are snapshotted at conversion time.',
    scope: 'write:crm',
    confirmation: true,
    input: z.object({
        quoteId: z.string().uuid(),
        customerId: z.string().uuid().optional(),
    }),
    run: (ctx, input) => {
        const { quoteId, ...rest } = input as { quoteId: string; customerId?: string };
        return billingDocumentConversionService.convertToOrder(ctx, quoteId, rest);
    },
};

export const mergeCustomers: McpToolDefinition = {
    name: 'merge_customers',
    description:
        'Merge one or more duplicate customers into a primary. All activities, deals, tasks and addresses move to the primary; commerce stats (spend, order count, first/last order) roll up; tags union; the primary fills any missing name/email/phone from the freshest duplicate. Duplicates are soft-deleted with a merge pointer preserved — the history survives. Destructive and hard to undo; the server confirms first.',
    scope: 'write:crm',
    confirmation: true,
    input: MergeCustomersInput,
    run: (ctx, input) => customerService.merge(ctx, input),
};

// ── Deals ────────────────────────────────────────────────────────────────
// move_deal_stage (above) is the ONLY stage-change path — it emits
// crm.deal.stage_changed for the automation engine. update_deal deliberately
// omits stageId/pipelineId; a stage move through this generic path is refused.

export const updateDeal: McpToolDefinition = {
    name: 'update_deal',
    description:
        'Update a deal — title, value, currency, probability, expected close date, customer/account link, assigned rep, source, tags. Omitted fields are unchanged. To move a deal to a different stage use move_deal_stage instead (it fires the stage-change automations).',
    scope: 'write:crm',
    confirmation: true,
    input: UpdateDealInput.omit({ pipelineId: true, stageId: true }).extend({
        dealId: z.string().uuid(),
    }),
    run: (ctx, input) => {
        const { dealId, ...patch } = input as { dealId: string } & Record<string, unknown>;
        return dealService.update(ctx, dealId, patch);
    },
};

export const deleteDeal: McpToolDefinition = {
    name: 'delete_deal',
    description:
        'Soft-delete a deal that should never have existed — it drops out of every list while the row and its activity trail survive. The normal way a deal leaves the board is move_deal_stage to a Won/Lost stage, which keeps it in pipeline history; use that for a real close, this only for a mistake.',
    scope: 'write:crm',
    confirmation: true,
    input: z.object({ dealId: z.string().uuid() }),
    run: (ctx, input) => dealService.softDelete(ctx, (input as { dealId: string }).dealId),
};

// ── Tasks ────────────────────────────────────────────────────────────────

export const updateTask: McpToolDefinition = {
    name: 'update_task',
    description:
        'Update a follow-up task — title, description, due date, priority, assignee, linked customer/deal, or status. Omitted fields are unchanged. To mark a task done prefer complete_task (it stamps who/when and drops a timeline entry).',
    scope: 'write:crm',
    confirmation: true,
    input: UpdateTaskInput.extend({ taskId: z.string().uuid() }),
    run: (ctx, input) => {
        const { taskId, ...patch } = input as { taskId: string } & Record<string, unknown>;
        return taskService.update(ctx, taskId, patch);
    },
};

// ── B2B accounts ───────────────────────────────────────────────────────────

export const createCompany: McpToolDefinition = {
    name: 'create_company',
    description:
        'Add a company — the organisation a contact works for. Name is the only thing required; tax id, website and email domains are optional. The trade fields (credit limit, payment terms, discount, pricing tier) only mean anything to a business selling on account: set them and customers become authorised buyers on it via add_b2b_account_contact, which is what unlocks trade pricing and net-terms at checkout.',
    scope: 'write:crm',
    confirmation: true,
    input: CreateCompanyInput,
    run: (ctx, input) => companyService.create(ctx, input),
};

export const updateCompany: McpToolDefinition = {
    name: 'update_company',
    description:
        'Update a company — any subset of name, tax id, website, email domains, pricing tier, credit limit, payment terms, discount, status, assigned rep, fleet size, notes, tags. Omitted fields are left exactly as they are.',
    scope: 'write:crm',
    confirmation: true,
    input: UpdateCompanyInput.extend({ companyId: z.string().uuid() }),
    run: (ctx, input) => {
        const { companyId, ...patch } = input as { companyId: string } & Record<string, unknown>;
        return companyService.update(ctx, companyId, patch);
    },
};

export const deleteCompany: McpToolDefinition = {
    name: 'delete_company',
    description:
        'Remove a company from the lists. Nothing is erased — its orders, invoices and history stay, and the contacts who worked there keep theirs.',
    scope: 'write:crm',
    confirmation: true,
    input: z.object({ companyId: z.string().uuid() }),
    run: (ctx, input) => companyService.softDelete(ctx, (input as { companyId: string }).companyId),
};

export const addB2bAccountContact: McpToolDefinition = {
    name: 'add_b2b_account_contact',
    description:
        'Link a customer to a B2B account with a role (primary_contact | buyer | approver | viewer). This is the row trade pricing, net-terms eligibility and the B2B portal all key off. The first account a customer is added to also becomes their default pricing account and promotes them to the wholesale relationship type.',
    scope: 'write:crm',
    confirmation: true,
    input: CreateB2bAccountContactInput.extend({ accountId: z.string().uuid() }),
    run: (ctx, input) => {
        const { accountId, ...body } = input as { accountId: string } & Record<string, unknown>;
        return b2bAccountContactService.create(ctx, accountId, body);
    },
};

// ── Pipelines + stages ─────────────────────────────────────────────────────

export const createPipeline: McpToolDefinition = {
    name: 'create_pipeline',
    description:
        'Create a sales pipeline (e.g. "New B2B Acquisition"). Stages are added separately with add_pipeline_stage. Leave propertyId unset for a tenant-wide pipeline, or set it to scope the pipeline to one site.',
    scope: 'write:crm',
    confirmation: true,
    input: CreatePipelineInput,
    run: (ctx, input) => pipelineService.create(ctx, input),
};

export const updatePipeline: McpToolDefinition = {
    name: 'update_pipeline',
    description:
        'Update a pipeline — name, slug, default flag, or sort order. Omitted fields are unchanged.',
    scope: 'write:crm',
    confirmation: true,
    input: UpdatePipelineInput.extend({ pipelineId: z.string().uuid() }),
    run: (ctx, input) => {
        const { pipelineId, ...patch } = input as { pipelineId: string } & Record<string, unknown>;
        return pipelineService.update(ctx, pipelineId, patch);
    },
};

export const archivePipeline: McpToolDefinition = {
    name: 'archive_pipeline',
    description:
        'Archive a pipeline: it stops appearing in the active list and loses its default flag. Existing deals on it are preserved.',
    scope: 'write:crm',
    confirmation: true,
    input: z.object({ pipelineId: z.string().uuid() }),
    run: (ctx, input) => pipelineService.archive(ctx, (input as { pipelineId: string }).pipelineId),
};

export const addPipelineStage: McpToolDefinition = {
    name: 'add_pipeline_stage',
    description:
        'Add a stage to a pipeline: name, sort order, win probability, stage type (open | won | lost) and an optional color.',
    scope: 'write:crm',
    confirmation: true,
    input: CreatePipelineStageInput.extend({ pipelineId: z.string().uuid() }),
    run: (ctx, input) => {
        const { pipelineId, ...body } = input as { pipelineId: string } & Record<string, unknown>;
        return pipelineService.createStage(ctx, pipelineId, body);
    },
};

export const updatePipelineStage: McpToolDefinition = {
    name: 'update_pipeline_stage',
    description:
        'Update a pipeline stage — name, sort order, probability, stage type, or color. Omitted fields are unchanged.',
    scope: 'write:crm',
    confirmation: true,
    input: UpdatePipelineStageInput.extend({ stageId: z.string().uuid() }),
    run: (ctx, input) => {
        const { stageId, ...patch } = input as { stageId: string } & Record<string, unknown>;
        return pipelineService.updateStage(ctx, stageId, patch);
    },
};

export const deletePipelineStage: McpToolDefinition = {
    name: 'delete_pipeline_stage',
    description:
        'Remove a stage from a pipeline. A pipeline must keep at least one stage. If the stage still has open deals you MUST pass reassignToStageId (a different stage on the same pipeline) to move them to — the move and delete run atomically.',
    scope: 'write:crm',
    confirmation: true,
    input: z.object({
        pipelineId: z.string().uuid(),
        stageId: z.string().uuid(),
        reassignToStageId: z.string().uuid().optional(),
    }),
    run: (ctx, input) =>
        pipelineService.deleteStage(
            ctx,
            input as { pipelineId: string; stageId: string; reassignToStageId?: string }
        ),
};

export const reorderPipelineStages: McpToolDefinition = {
    name: 'reorder_pipeline_stages',
    description:
        'Set the full left-to-right order of a pipeline’s stages. Pass every stage id in the desired order; sort orders are rewritten atomically.',
    scope: 'write:crm',
    confirmation: true,
    input: ReorderPipelineStagesInput.extend({ pipelineId: z.string().uuid() }),
    run: (ctx, input) => {
        const { pipelineId, ...body } = input as { pipelineId: string } & Record<string, unknown>;
        return pipelineService.reorderStages(ctx, pipelineId, body);
    },
};

// ── Segments ───────────────────────────────────────────────────────────────

export const createSegment: McpToolDefinition = {
    name: 'create_segment',
    description:
        'Create a customer segment from a rule tree (the same predicate shape preview_segment_count evaluates). Membership is materialised asynchronously by the evaluator. Leave propertyId unset for a tenant-wide segment, or set it to scope to one site.',
    scope: 'write:crm',
    confirmation: true,
    input: CreateSegmentInput,
    run: (ctx, input) => segmentService.create(ctx, input),
};

export const updateSegment: McpToolDefinition = {
    name: 'update_segment',
    description:
        'Update a segment — name, slug, description, color, or its rule tree. Omitted fields are unchanged; changing the rules triggers a membership recompute downstream.',
    scope: 'write:crm',
    confirmation: true,
    input: UpdateSegmentInput.extend({ segmentId: z.string().uuid() }),
    run: (ctx, input) => {
        const { segmentId, ...patch } = input as { segmentId: string } & Record<string, unknown>;
        return segmentService.update(ctx, segmentId, patch);
    },
};

export const archiveSegment: McpToolDefinition = {
    name: 'archive_segment',
    description:
        'Archive a segment: it stops appearing in the active list. Membership rows are left as-is.',
    scope: 'write:crm',
    confirmation: true,
    input: z.object({ segmentId: z.string().uuid() }),
    run: (ctx, input) => segmentService.archive(ctx, (input as { segmentId: string }).segmentId),
};

export const recomputeSegment: McpToolDefinition = {
    name: 'recompute_segment',
    description:
        'Force a full re-evaluation of a segment against every customer, reconciling its membership. Expensive — use when membership looks stale, not routinely (membership normally updates incrementally from events).',
    scope: 'write:crm',
    confirmation: true,
    input: z.object({ segmentId: z.string().uuid() }),
    run: (ctx, input) =>
        segmentService.recomputeFull(ctx, { segmentId: (input as { segmentId: string }).segmentId }),
};

export const writeTools = [
    createCustomer,
    updateCustomer,
    deleteCustomer,
    mergeCustomers,
    addActivity,
    createTask,
    completeTask,
    updateTask,
    bulkAssignCustomers,
    bulkTagCustomers,
    moveDealStage,
    createDeal,
    updateDeal,
    deleteDeal,
    convertQuote,
    createCompany,
    updateCompany,
    deleteCompany,
    addB2bAccountContact,
    createPipeline,
    updatePipeline,
    archivePipeline,
    addPipelineStage,
    updatePipelineStage,
    deletePipelineStage,
    reorderPipelineStages,
    createSegment,
    updateSegment,
    archiveSegment,
    recomputeSegment,
];
