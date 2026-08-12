// Units of measure + assembly MCP tools (docs/146 Phase 6, D10).
//
// The two questions a made-to-stock business asks that no inventory system
// answers well: "how many can I make right now" and "what runs out first". Both
// are one call here, and the second is the half that turns the first into a
// purchase order.
//
// The writes stop at COMPLETING a run. Planning and releasing are here because
// they move nothing and hold nothing that cannot be released; completing is
// here because "we finished the batch, 96 of the 100" is a shop-floor fact an
// assistant can reasonably be asked to record. Editing a RECIPE is not — a bill
// of materials is a specification, and an agent quietly changing what a product
// is made of is a different category of mistake from mis-recording a count.
//
// Per the platform's BYOK/MCP-only rule, sparx runs no model here — the tenant
// brings their own client and these tools serve it.

import { z } from 'zod';

import { inventoryService } from '../services';
import type { AnyMcpTool, McpToolDefinition } from './registry';

const Uuid = z.string().uuid();

// ─── Units of measure ────────────────────────────────────────────────────────

const listUnits: McpToolDefinition = {
  name: 'list_units_of_measure',
  description:
    'Every unit this business measures things in — each, case, box, pair, kilogram — with how many items use each one. Read this before quoting or entering any quantity in a pack unit, because what a "case" contains is set per item and the codes are the tenant\'s own.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({ includeInactive: z.boolean().default(false) }),
  run: (ctx, input) => {
    const { includeInactive } = input as { includeInactive: boolean };
    return inventoryService.listUnitsOfMeasure(ctx, { includeInactive });
  },
};

const getVariantUnits: McpToolDefinition = {
  name: 'get_item_units',
  description:
    'What each pack unit means FOR ONE ITEM: how many singles are in a case of this particular thing, which unit it is usually bought in and which it is usually sold in. A case of spark plugs is twelve and a case of oil filters is six, so this is the only place the arithmetic is knowable.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({ variantId: Uuid }),
  run: (ctx, input) => {
    const { variantId } = input as { variantId: string };
    return inventoryService.getVariantUoms(ctx, variantId);
  },
};

// ─── Recipes ─────────────────────────────────────────────────────────────────

const listBoms: McpToolDefinition = {
  name: 'list_bills_of_materials',
  description:
    'The recipes this business builds to — what each one makes, how many it makes per run, how many components it has and whether it is the live version. Use it to find the recipe id before checking what can be built or raising a run.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    q: z.string().trim().max(200).optional(),
    status: z.enum(['draft', 'active', 'archived']).optional(),
    limit: z.number().int().min(1).max(250).default(50),
  }),
  run: (ctx, input) => {
    const i = input as { q?: string; status?: 'draft' | 'active' | 'archived'; limit: number };
    return inventoryService.listBoms(ctx, {
      ...(i.q ? { q: i.q } : {}),
      ...(i.status ? { status: i.status } : {}),
      take: i.limit,
    });
  },
};

const getBom: McpToolDefinition = {
  name: 'get_bill_of_materials',
  description:
    "One recipe in full: every component, how much of it a batch needs, how much is expected to be wasted, and what one finished unit is estimated to cost at today's component prices. The estimate is what you price against before you have made any; what a batch ACTUALLY cost is settled when a run completes.",
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({ bomId: Uuid }),
  run: (ctx, input) => {
    const { bomId } = input as { bomId: string };
    return inventoryService.getBom(ctx, bomId);
  },
};

const getBuildableQuantity: McpToolDefinition = {
  name: 'get_buildable_quantity',
  description:
    'How many of something can be made right now from the stock at one location — AND which component runs out first. Measured against what is actually free to use, not raw on-hand, so units already promised to a customer order are not counted twice. Use it to answer "can we make 40 of these by Friday" and to say what to order if not.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({ bomId: Uuid, warehouseId: Uuid }),
  run: (ctx, input) => {
    const i = input as { bomId: string; warehouseId: string };
    return inventoryService.buildableQuantity(ctx, i);
  },
};

const listAssemblies: McpToolDefinition = {
  name: 'list_assembly_orders',
  description:
    'Runs that are planned, committed to, finished or cancelled — what is being made, how many, where, and what the finished units cost. Use it to see what the shop floor has on, or to find a run id before releasing or completing it.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    status: z.enum(['planned', 'released', 'completed', 'cancelled']).optional(),
    kind: z.enum(['assemble', 'disassemble']).optional(),
    warehouseId: Uuid.optional(),
    limit: z.number().int().min(1).max(250).default(50),
  }),
  run: (ctx, input) => {
    const i = input as {
      status?: 'planned' | 'released' | 'completed' | 'cancelled';
      kind?: 'assemble' | 'disassemble';
      warehouseId?: string;
      limit: number;
    };
    return inventoryService.listAssemblyOrders(ctx, {
      ...(i.status ? { status: i.status } : {}),
      ...(i.kind ? { kind: i.kind } : {}),
      ...(i.warehouseId ? { warehouseId: i.warehouseId } : {}),
      take: i.limit,
    });
  },
};

const getAssembly: McpToolDefinition = {
  name: 'get_assembly_order',
  description:
    'One run in full: what it is making, what it needs, what actually went in, and what the finished units cost once it was done. On a completed run the cost is the sum of what genuinely left the shelf plus labour — not a price-list estimate.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({ assemblyOrderId: Uuid }),
  run: (ctx, input) => {
    const { assemblyOrderId } = input as { assemblyOrderId: string };
    return inventoryService.getAssemblyOrder(ctx, assemblyOrderId);
  },
};

// ─── Writes ──────────────────────────────────────────────────────────────────

const planAssembly: McpToolDefinition = {
  name: 'plan_assembly_run',
  description:
    'Schedule a build (or a teardown). Nothing moves and nothing is held — this is the paper stage, and the recipe is copied onto the run so editing the recipe later cannot change what this run committed to. Follow with release_assembly_run to hold the parts.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({
    kind: z.enum(['assemble', 'disassemble']).default('assemble'),
    bomId: Uuid.optional(),
    outputVariantId: Uuid.optional(),
    warehouseId: Uuid,
    quantity: z.number().int().min(1).max(1_000_000),
    plannedFor: z.string().datetime().optional(),
    notes: z.string().trim().max(2000).optional(),
  }),
  run: (ctx, input) => inventoryService.createAssemblyOrder(ctx, input),
};

const releaseAssembly: McpToolDefinition = {
  name: 'release_assembly_run',
  description:
    'Commit to a run: hold every component it needs so nobody sells the last of a part the build depends on. Nothing is consumed and nothing has physically moved — cancelling afterwards releases the hold and costs nothing. Refused, with the shortfall named, if the parts are not there.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({ assemblyOrderId: Uuid }),
  run: (ctx, input) => {
    const { assemblyOrderId } = input as { assemblyOrderId: string };
    return inventoryService.releaseAssemblyOrder(ctx, assemblyOrderId);
  },
};

const completeAssembly: McpToolDefinition = {
  name: 'complete_assembly_run',
  description:
    'Finish a run: the components come off the shelf, the finished goods go on it, and the cost is settled from what actually left. Say how many really came out if it was not what was planned — a batch of 100 that yielded 96 completes for 96. This MOVES STOCK and cannot be undone by editing; a correction is a stock count.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({
    assemblyOrderId: Uuid,
    quantity: z.number().int().min(1).max(1_000_000).optional(),
    laborCostCents: z.number().int().min(0).max(100_000_000).optional(),
    note: z.string().trim().max(500).optional(),
  }),
  run: (ctx, input) => {
    const { assemblyOrderId, ...rest } = input as {
      assemblyOrderId: string;
      quantity?: number;
      laborCostCents?: number;
      note?: string;
    };
    return inventoryService.completeAssemblyOrder(ctx, assemblyOrderId, rest);
  },
};

const cancelAssembly: McpToolDefinition = {
  name: 'cancel_assembly_run',
  description:
    'Call off a planned or committed run. Any hold on its components is released and nothing is consumed. A run that has already been completed cannot be cancelled — that is a stock count, not a cancellation.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({
    assemblyOrderId: Uuid,
    reason: z.string().trim().max(500).optional(),
  }),
  run: (ctx, input) => {
    const { assemblyOrderId, reason } = input as { assemblyOrderId: string; reason?: string };
    return inventoryService.cancelAssemblyOrder(ctx, assemblyOrderId, {
      ...(reason ? { reason } : {}),
    });
  },
};

export const assemblyReadTools: AnyMcpTool[] = [
  listUnits,
  getVariantUnits,
  listBoms,
  getBom,
  getBuildableQuantity,
  listAssemblies,
  getAssembly,
];

export const assemblyWriteTools: AnyMcpTool[] = [
  planAssembly,
  releaseAssembly,
  completeAssembly,
  cancelAssembly,
];
