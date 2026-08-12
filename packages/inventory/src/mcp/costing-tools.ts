// True-cost MCP tools (docs/146 Phase 5, D10).
//
// The questions these answer are the ones a business owner asks their
// accountant and cannot ask their inventory system: what did this actually cost
// me once the freight is in, what is my stock worth as at the year end, and is
// the part I budgeted at four pounds still costing four pounds.
//
// The writes are deliberately narrow. Recording a freight bill against a
// delivery is a bookkeeping entry an assistant can reasonably be asked to make
// ("the DHL invoice came in at £212 for GR-000041"), and it is fully reversible
// — the charge can be corrected or removed and the order reallocates. Changing
// the tenant's COSTING METHOD is not here at all: switching from moving average
// to FIFO changes how every future figure is computed and is a decision a
// business makes with its accountant, not one an agent makes on a hunch.
//
// Per the platform's BYOK/MCP-only rule, sparx runs no model here — the tenant
// brings their own client and these tools serve it.

import { z } from 'zod';

import { inventoryService } from '../services';
import type { AnyMcpTool, McpToolDefinition } from './registry';

const Uuid = z.string().uuid();

const ChargeKind = z.enum(['freight', 'duty', 'insurance', 'broker', 'handling', 'other']);
const AllocationBasis = z.enum(['value', 'quantity', 'weight']);

// ─── Reads ───────────────────────────────────────────────────────────────────

const getLandedCostBreakdown: McpToolDefinition = {
  name: 'get_landed_cost_breakdown',
  description:
    "What one delivery actually cost, line by line: the supplier's invoice price, the exchange rate it was converted at, every freight/duty/insurance/broker charge that landed on it and how each was spread across the lines, and the resulting landed cost per unit. Use this to answer 'what did these really cost me' or to explain why a unit cost is higher than the purchase order said.",
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({ goodsReceiptId: Uuid }),
  run: (ctx, input) => {
    const { goodsReceiptId } = input as { goodsReceiptId: string };
    return inventoryService.getLandedCostBreakdown(ctx, goodsReceiptId);
  },
};

const getStockCostLayers: McpToolDefinition = {
  name: 'get_stock_cost_layers',
  description:
    "What the stock of one item is actually made of: each batch still on the shelf, when it arrived, how many of it are left and what those units cost. This is the question a moving average cannot answer — 'these 40 units are 28 from the March delivery at £8.20 and 12 from January at £7.15'. Use it before repricing, or when someone asks which purchase a unit came from.",
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    variantId: Uuid,
    warehouseId: Uuid.optional(),
    limit: z.number().int().min(1).max(200).default(50),
  }),
  run: (ctx, input) => {
    const i = input as { variantId: string; warehouseId?: string; limit: number };
    return inventoryService.variantCostLayers(ctx, {
      variantId: i.variantId,
      ...(i.warehouseId ? { warehouseId: i.warehouseId } : {}),
      take: i.limit,
    });
  },
};

const getValuationAsOf: McpToolDefinition = {
  name: 'get_valuation_as_of',
  description:
    'What the stock was worth at a moment in the PAST — the year-end figure an accountant asks for in March, or what was being held when a discrepancy happened. Computed from the movement and cost ledgers rather than from a snapshot, so any date works, not only dates someone thought to snapshot. Reports how many units the cost history could not account for rather than valuing them at zero.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    asOf: z.string().datetime(),
    warehouseId: Uuid.optional(),
    limit: z.number().int().min(1).max(500).default(100),
  }),
  run: (ctx, input) => {
    const i = input as { asOf: string; warehouseId?: string; limit: number };
    return inventoryService.valuationAsOf(ctx, {
      asOf: new Date(i.asOf),
      ...(i.warehouseId ? { warehouseId: i.warehouseId } : {}),
      take: i.limit,
    });
  },
};

const getPriceVariance: McpToolDefinition = {
  name: 'get_price_variance',
  description:
    'What was planned against what was actually paid, per item and supplier, over a period. Compares the standard cost to the LANDED cost — so a supplier who held their price but moved the freight onto you shows up as the increase it is. Use it to prepare a supplier conversation, or to find the lines whose margin is quietly eroding.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
    warehouseId: Uuid.optional(),
    supplierId: Uuid.optional(),
    limit: z.number().int().min(1).max(250).default(50),
  }),
  run: (ctx, input) => {
    const i = input as {
      from: string;
      to: string;
      warehouseId?: string;
      supplierId?: string;
      limit: number;
    };
    return inventoryService.priceVarianceReport(ctx, {
      from: new Date(i.from),
      to: new Date(i.to),
      ...(i.warehouseId ? { warehouseId: i.warehouseId } : {}),
      ...(i.supplierId ? { supplierId: i.supplierId } : {}),
      take: i.limit,
    });
  },
};

const getCostOfGoods: McpToolDefinition = {
  name: 'get_cost_of_goods',
  description:
    'What the goods that left over a period cost, split by why they left — sold, lost, damaged, written off at a count. Each figure was stamped on the movement when the stock left, so it does not drift when a new delivery changes the average. Use it for margin, and to see how much of what left was sold rather than lost.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
    warehouseId: Uuid.optional(),
  }),
  run: (ctx, input) => {
    const i = input as { from: string; to: string; warehouseId?: string };
    return inventoryService.cogsReport(ctx, {
      from: new Date(i.from),
      to: new Date(i.to),
      ...(i.warehouseId ? { warehouseId: i.warehouseId } : {}),
    });
  },
};

const getCostingPolicy: McpToolDefinition = {
  name: 'get_costing_policy',
  description:
    'How this business values its stock: moving average, FIFO or standard cost, the currency the cost ledger is kept in, and the default way charges are spread across a delivery. Read this before interpreting any cost figure — the same stock is worth different amounts under different methods, and saying which one produced a number is part of the number.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({}),
  run: (ctx) => inventoryService.getCostingPolicy(ctx),
};

// ─── Writes ──────────────────────────────────────────────────────────────────

const recordDeliveryCharge: McpToolDefinition = {
  name: 'record_delivery_charge',
  description:
    "Record money spent on a delivery over and above the goods — the freight invoice, the duty, the customs broker's fee. Spreads it across that delivery's lines (by value, by units, or by weight), corrects the cost of what is still on the shelf, and leaves what has already sold costed at what it cost then. This is the normal way a freight bill that arrives after the pallet gets into the numbers.",
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({
    goodsReceiptId: Uuid,
    kind: ChargeKind,
    amountCents: z.number().int().min(0).max(1_000_000_000),
    description: z.string().trim().max(255).optional(),
    allocationBasis: AllocationBasis.optional(),
  }),
  run: (ctx, input) => inventoryService.createGoodsReceiptCharge(ctx, input),
};

const recordOrderCharge: McpToolDefinition = {
  name: 'record_purchase_order_charge',
  description:
    'Record an EXPECTED cost on a purchase order — the freight quote, the duty you know is coming. Apportioned across the deliveries that order produces by the share of the order each one brings, so a part-shipment carries its part of the freight. Use this when the cost is known at ordering time; use record_delivery_charge for the invoice that actually turns up.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({
    purchaseOrderId: Uuid,
    kind: ChargeKind,
    amountCents: z.number().int().min(0).max(1_000_000_000),
    description: z.string().trim().max(255).optional(),
    allocationBasis: AllocationBasis.optional(),
  }),
  run: (ctx, input) => inventoryService.createPurchaseOrderCharge(ctx, input),
};

export const costingReadTools: AnyMcpTool[] = [
  getLandedCostBreakdown,
  getStockCostLayers,
  getValuationAsOf,
  getPriceVariance,
  getCostOfGoods,
  getCostingPolicy,
];

export const costingWriteTools: AnyMcpTool[] = [recordDeliveryCharge, recordOrderCharge];
