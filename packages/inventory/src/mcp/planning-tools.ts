// Planning MCP tools (docs/146 Phase 7, D10).
//
// 81% of operators want AI in their inventory workflow and 11% have any. What
// they actually want it for is these questions — "what should I be buying",
// "what is dead", "why is this number that number" — and they are exactly the
// questions a stock system can answer well and a language model cannot answer
// alone. sparx runs no model here; the tenant brings their own client and these
// serve it (BYOK/MCP only, always).
//
// ── The reads are the point ──────────────────────────────────────────────────
//
// `get_stockout_risk` returns rows already sorted by the money at risk, each
// carrying a plain-English `reasoning` sentence. `explain_reorder_point` returns
// every input with its confidence and the formula with the numbers substituted
// in. Both are shaped so an assistant can quote them rather than re-derive them
// — a model that re-does the arithmetic will get a different answer from the
// screen, and then there are two truths.
//
// ── The writes are narrow, and one is deliberately absent ────────────────────
//
// Adopting a computed reorder point is reversible and visible, and asking an
// assistant to "take the suggested reorder levels for the Ford parts" is a
// reasonable Tuesday. Setting a classification override is a judgement a person
// is entitled to delegate.
//
// TURNING ON automatic reorder-point management is NOT here. That hands the
// nightly maths permission to rewrite an operational trigger every night, and it
// is the one decision in this phase whose whole value is that a human made it
// knowingly. An agent flipping it on a hunch is exactly the surprise the consent
// rule exists to prevent.

import { z } from 'zod';

import { inventoryService } from '../services';
import type { AnyMcpTool, McpToolDefinition } from './registry';

const Uuid = z.string().uuid();

// ─── Reads ───────────────────────────────────────────────────────────────────

const getStockoutRisk: McpToolDefinition = {
  name: 'get_stockout_risk',
  description:
    "What is about to run out and what it would cost, ranked by the money rather than by how empty the shelf looks. Each row carries how fast the item sells, how long its supplier actually takes, how many days of cover that leaves counting stock already on order, and a plain sentence explaining the calculation. Use this to answer 'what should I buy today' — it is the buying worklist, sorted the way a buyer with an hour should work it.",
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    warehouseId: Uuid.optional(),
    includeSafeItems: z
      .boolean()
      .default(false)
      .describe('Include items with no risk figure. Off by default — this is a worklist.'),
    limit: z.number().int().min(1).max(500).default(50),
  }),
  run: (ctx, input) => {
    const i = input as { warehouseId?: string; includeSafeItems: boolean; limit: number };
    return inventoryService.stockoutRiskReport(ctx, {
      ...(i.warehouseId ? { warehouseId: i.warehouseId } : {}),
      atRiskOnly: !i.includeSafeItems,
      take: i.limit,
    });
  },
};

const explainReorderPoint: McpToolDefinition = {
  name: 'explain_reorder_point',
  description:
    "Why one item's reorder level is what it is: the sales rate and the window it was measured over, how much history stands behind it, how erratic the demand is, the supplier's measured delivery time and how many deliveries that is from, the chosen service level, and the two formulas with this item's numbers substituted in. Also says which inputs are guessed rather than measured and what would improve them. Use this whenever someone doubts a suggested level — the answer is checkable rather than asserted.",
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({ variantId: Uuid, warehouseId: Uuid }),
  run: (ctx, input) => {
    const i = input as { variantId: string; warehouseId: string };
    return inventoryService.planningProvenance(ctx, i);
  },
};

const getDemandForecast: McpToolDefinition = {
  name: 'get_demand_forecast',
  description:
    'How fast one item sells in one place: units per day over the last 7, 30 and 90 days, which of those the forecast uses and why, how much the daily figure swings, how many of the last 90 days saw any sale at all, and a seasonal multiplier where there is a year of history. The three windows disagreeing is the interesting part — a 7-day rate at triple the 90-day rate means the item is accelerating and its reorder level is already behind.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({ variantId: Uuid, warehouseId: Uuid }),
  run: (ctx, input) => {
    const i = input as { variantId: string; warehouseId: string };
    return inventoryService.getDemandVelocity(ctx, i);
  },
};

const getAbcClassification: McpToolDefinition = {
  name: 'get_abc_classification',
  description:
    "Which stock carries the money (A/B/C by annual usage value) and which can be forecast (X/Y/Z by how erratic demand is), with each item's share of total spend, the running total at its rank, and a sentence saying what the pair means you should do about it. Use it to decide where attention, cushion and counting effort should go — an AX line wants a tight reorder level and a monthly count; a CZ line wants buying when someone asks.",
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    warehouseId: Uuid.optional(),
    abcClass: z.enum(['A', 'B', 'C']).optional(),
    xyzClass: z.enum(['X', 'Y', 'Z']).optional(),
    limit: z.number().int().min(1).max(250).default(50),
  }),
  run: (ctx, input) => {
    const i = input as {
      warehouseId?: string;
      abcClass?: 'A' | 'B' | 'C';
      xyzClass?: 'X' | 'Y' | 'Z';
      limit: number;
    };
    return inventoryService.listClassifications(ctx, {
      ...(i.warehouseId ? { warehouseId: i.warehouseId } : {}),
      ...(i.abcClass ? { abcClass: i.abcClass } : {}),
      ...(i.xyzClass ? { xyzClass: i.xyzClass } : {}),
      take: i.limit,
    });
  },
};

const getSlowMovers: McpToolDefinition = {
  name: 'get_slow_moving_stock',
  description:
    'Stock that is not paying its rent, in three kinds that need different answers: DEAD (nothing sold in the dead-stock window — the question is disposal), OVERSTOCK (it sells, but there is far more cover than the horizon — the answer is to stop buying it for a while), and SLOW (still moving but worth watching). Each carries the capital tied up and what it costs to keep for a year. Use it to free up cash, not to reorder.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    warehouseId: Uuid.optional(),
    limit: z.number().int().min(1).max(500).default(50),
  }),
  run: (ctx, input) => {
    const i = input as { warehouseId?: string; limit: number };
    return inventoryService.slowMoverReport(ctx, {
      ...(i.warehouseId ? { warehouseId: i.warehouseId } : {}),
      take: i.limit,
    });
  },
};

const getHoldingCost: McpToolDefinition = {
  name: 'get_holding_cost',
  description:
    "What keeping the stock actually costs — warehousing, insurance, the capital tied up, shrink and obsolescence, as an annual percentage of value. Broken down by ABC class and by the individual items most expensive to hold. Most systems report what stock is WORTH and never what it COSTS, and the gap between those two numbers is usually the argument for changing how much is kept. Says whether the rate is the business's own figure or the category's rule of thumb.",
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    warehouseId: Uuid.optional(),
    limit: z.number().int().min(1).max(200).default(25),
  }),
  run: (ctx, input) => {
    const i = input as { warehouseId?: string; limit: number };
    return inventoryService.holdingCostReport(ctx, {
      ...(i.warehouseId ? { warehouseId: i.warehouseId } : {}),
      take: i.limit,
    });
  },
};

const getSupplierLeadTimes: McpToolDefinition = {
  name: 'get_supplier_lead_times',
  description:
    'How long suppliers ACTUALLY take, measured from the day each order was sent to the day the goods were booked in — against what they promised. Carries the sample size, the spread, and the share of deliveries that arrived on time. A supplier whose delivery time swings between 3 and 21 days ties up far more of your money than one who is simply slow but reliable, and this is the read that shows it. Use it before a supplier conversation, or to explain why a reorder level is higher than someone expected.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    supplierId: Uuid.optional(),
    includeVariants: z
      .boolean()
      .default(false)
      .describe('Include the per-item rows as well as each supplier overall.'),
    limit: z.number().int().min(1).max(500).default(50),
  }),
  run: (ctx, input) => {
    const i = input as { supplierId?: string; includeVariants: boolean; limit: number };
    return inventoryService.listLeadTimes(ctx, {
      ...(i.supplierId ? { supplierId: i.supplierId } : {}),
      includeVariants: i.includeVariants,
      take: i.limit,
    });
  },
};

const getPlanningPolicy: McpToolDefinition = {
  name: 'get_planning_policy',
  description:
    'How this business plans: how often it intends to be in stock, what it reckons holding stock costs per year, where the ABC and XYZ cuts fall, how much cover counts as overstock, and whether reorder levels are allowed to move on their own. Read this before interpreting any planning number — the same stock produces different reorder levels under different service levels, and saying which one produced a figure is part of the figure.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({}),
  run: (ctx) => inventoryService.getPlanningPolicy(ctx),
};

const listCountSchedules: McpToolDefinition = {
  name: 'list_count_schedules',
  description:
    'The standing instructions that keep cycle counting happening: what each covers, how often, how many items per run, when it last ran and when it is next due. A schedule that is overdue, or whose last count is still open, is the reason counting has quietly stopped — both are reported here.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    warehouseId: Uuid.optional(),
    includeInactive: z.boolean().default(false),
  }),
  run: (ctx, input) => {
    const i = input as { warehouseId?: string; includeInactive: boolean };
    return inventoryService.listCountSchedules(ctx, {
      ...(i.warehouseId ? { warehouseId: i.warehouseId } : {}),
      includeInactive: i.includeInactive,
    });
  },
};

// ─── Writes ──────────────────────────────────────────────────────────────────

const applyReorderPoint: McpToolDefinition = {
  name: 'apply_computed_reorder_point',
  description:
    "Adopt the calculated reorder level for one item at one location: copy it onto the level that actually triggers reordering, once. Does NOT hand the item to the nightly maths — the level stays a human's from then on. Fully reversible by setting the level back by hand. Use it after explain_reorder_point has shown someone why the new number is better than the old one.",
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({ variantId: Uuid, warehouseId: Uuid }),
  run: (ctx, input) => {
    const i = input as { variantId: string; warehouseId: string };
    return inventoryService.applyComputedReorderPoint(ctx, i);
  },
};

const setClassificationOverride: McpToolDefinition = {
  name: 'set_stock_classification',
  description:
    'Mark an item as more or less important than its sales value suggests, or as more or less predictable. Use when someone knows something the ledger does not — a cheap part that stops a production line, or a valuable line being discontinued. The measured class keeps being worked out alongside, so the difference stays visible. Pass null for a class to clear the override and hand the item back to the measurement.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({
    variantId: Uuid,
    warehouseId: Uuid,
    abcClass: z.enum(['A', 'B', 'C']).nullish(),
    xyzClass: z.enum(['X', 'Y', 'Z']).nullish(),
    reason: z.string().trim().max(255).optional(),
  }),
  run: (ctx, input) => inventoryService.setClassificationOverride(ctx, input),
};

const recomputePlanning: McpToolDefinition = {
  name: 'recompute_planning',
  description:
    'Re-measure everything the planning numbers rest on, now, rather than waiting for tonight: supplier delivery times from the receipts, sales rates from the stock ledger, the ABC/XYZ ranking, and every reorder level. Deliberately does NOT generate cycle counts — that creates real work for real people and is not a side effect a refresh should have. Use after a big import, a bulk receipt, or when someone says the forecast looks stale.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({ warehouseId: Uuid.optional() }),
  run: (ctx, input) => {
    const i = input as { warehouseId?: string };
    return inventoryService.runPlanningSweep(ctx, {
      ...(i.warehouseId ? { warehouseId: i.warehouseId } : {}),
      skipCountGeneration: true,
    });
  },
};

export const planningReadTools: AnyMcpTool[] = [
  getStockoutRisk,
  explainReorderPoint,
  getDemandForecast,
  getAbcClassification,
  getSlowMovers,
  getHoldingCost,
  getSupplierLeadTimes,
  getPlanningPolicy,
  listCountSchedules,
];

export const planningWriteTools: AnyMcpTool[] = [
  applyReorderPoint,
  setClassificationOverride,
  recomputePlanning,
];
