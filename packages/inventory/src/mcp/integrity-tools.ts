// Inventory integrity MCP tools (docs/146 Phase 1, D10).
//
// 81% of operators want AI in their inventory workflow and 11% have any. The
// gap is not model access — it is that the questions an operator actually asks
// ("why did this drop", "can I trust this number", "what did we refuse to sell
// last week") have no API behind them in most products, so an assistant can only
// read the same table the human is already looking at.
//
// These are those questions. Every one is READ-ONLY: integrity is a diagnosis
// surface, and an agent that could "fix" a drift by writing the derived value
// would destroy the evidence the drift exists to preserve. Reconciliation on
// demand is the one write, and it writes only its own result row.
//
// Per the platform's BYOK/MCP-only rule, sparx runs no model here — the tenant
// brings their own client and these tools serve it.

import { z } from 'zod';

import { inventoryService } from '../services';
import type { AnyMcpTool, McpToolDefinition } from './registry';

const Uuid = z.string().uuid();

const explainStockLevel: McpToolDefinition = {
  name: 'explain_stock_level',
  description:
    'Explain one stock number: how on-hand, allocated and the safety buffer decompose into the sellable figure; the recent ledger movements that produced it and who made each; the holds against it; how old the number is and which feed last touched it; and whether the recorded on-hand still equals the sum of the movement ledger. Use this whenever someone asks why a quantity is what it is, or whether it can be trusted.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    variantId: Uuid,
    warehouseId: Uuid,
    /** Resolve the per-channel cushion too — "what can Amazon actually sell". */
    channel: z.string().max(63).optional(),
    movementLimit: z.number().int().min(1).max(100).default(20),
  }),
  run: (ctx, input) => {
    const i = input as {
      variantId: string;
      warehouseId: string;
      channel?: string;
      movementLimit: number;
    };
    return inventoryService.stockProvenance(
      ctx,
      { variantId: i.variantId, warehouseId: i.warehouseId },
      { ...(i.channel ? { channel: i.channel } : {}), movementLimit: i.movementLimit }
    );
  },
};

const getInventoryHealth: McpToolDefinition = {
  name: 'get_inventory_health',
  description:
    'The integrity picture for the whole tenant: the latest reconciliation result (did the ledger still add up, and how many levels drifted), the open drift list, oversell incidents over a recent window split by kind, and every external feed with how stale it is against its declared freshness promise. Use this to answer "can I trust my inventory data right now".',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    windowDays: z.number().int().min(1).max(365).default(30),
  }),
  run: async (ctx, input) => {
    const { windowDays } = input as { windowDays: number };
    const [runs, drifts, oversell, freshness] = await Promise.all([
      inventoryService.listReconciliationRuns(ctx, { take: 1 }),
      inventoryService.listReconciliationDrifts(ctx, { take: 25 }),
      inventoryService.oversellSummary(ctx, { windowDays }),
      inventoryService.listSourceFreshness(ctx),
    ]);
    return {
      lastReconciliation: runs.items[0] ?? null,
      openDrifts: { total: drifts.total, items: drifts.items },
      oversell,
      sources: freshness,
      // Stated rather than left for the caller to infer: the three failure modes
      // are independent, and an assistant summarising this should not have to
      // re-derive the headline from four sub-objects.
      verdict: {
        ledgerReconciles: drifts.total === 0,
        anyStaleFeed: freshness.some((f) => f.isStale),
        oversellsInWindow: oversell.blocked + oversell.allowed + oversell.negativeOnHand,
      },
    };
  },
};

const getOversellIncidents: McpToolDefinition = {
  name: 'get_oversell_incidents',
  description:
    'The log of sales the platform refused for lack of stock (kind "blocked"), holds it permitted that it could not cover ("allowed"), and committed sales that drove on-hand below zero ("negative_on_hand"). Each row snapshots what the system believed it had at the moment of the decision, the policy in force, the channel, and how old the stock number was. Use this to diagnose lost revenue or a feed that is causing oversells.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    variantId: Uuid.optional(),
    productId: Uuid.optional(),
    warehouseId: Uuid.optional(),
    kind: z.enum(['blocked', 'allowed', 'negative_on_hand']).optional(),
    channel: z.string().max(63).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    take: z.number().int().min(1).max(250).default(50),
  }),
  run: (ctx, input) =>
    inventoryService.listOversellIncidents(ctx, input as Record<string, unknown>),
};

const getShrinkageReport: McpToolDefinition = {
  name: 'get_shrinkage_report',
  description:
    'What left the building without being sold, over a period: losses, damage and negative count corrections, in units and at cost, broken down by reason, by warehouse, by month, and by worst-offending item — plus shrinkage as a percentage of current inventory value. Positive count corrections are reported alongside rather than netted off, because a business that finds as much as it loses has a counting problem rather than a theft problem.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    warehouseId: Uuid.optional(),
  }),
  run: (ctx, input) => inventoryService.shrinkageReport(ctx, input as Record<string, unknown>),
};

const runInventoryReconciliation: McpToolDefinition = {
  name: 'run_inventory_reconciliation',
  description:
    'Re-derive the movement ledger against the recorded stock levels right now and report any that disagree. Scope "variant" checks one item, "sample" the most recently touched levels, "full" everything. Records a run row and can close drifts that have healed; it never changes a stock quantity — a real drift is resolved by posting a count, not by overwriting the number.',
  scope: 'write:inventory',
  // Confirmation-gated not because it is dangerous but because a full pass on a
  // large catalogue is expensive, and an agent should say so before spending it.
  confirmation: true,
  input: z.object({
    scope: z.enum(['full', 'sample', 'variant']).default('full'),
    variantId: Uuid.optional(),
    sampleSize: z.number().int().min(1).max(10_000).default(1000),
  }),
  run: (ctx, input) => inventoryService.runReconciliation(ctx, input),
};

export const integrityReadTools: AnyMcpTool[] = [
  explainStockLevel,
  getInventoryHealth,
  getOversellIncidents,
  getShrinkageReport,
];

export const integrityWriteTools: AnyMcpTool[] = [runInventoryReconciliation];
