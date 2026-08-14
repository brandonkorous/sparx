// Supplier performance MCP tools (docs/146 Phase 8, surfaced in Phase 12.1/12.2).
//
// The questions a buyer asks about the people they buy from: who is late, who
// short-ships, what a bigger order would actually cost, what is on its way, and
// what we are still owed a credit for. Phase 8 built all of it and gave it a
// screen; until now none of it was reachable from an assistant, which meant the
// answer to "which supplier is hurting me" lived behind a click.
//
// ── Why this file is entirely READ ───────────────────────────────────────
//
// Every write in this area is a money decision made toward another company:
// approving a purchase order commits spend, sending a return opens a claim,
// recording a credit says a supplier has paid us back, and setting a price break
// changes what we are billed. Those are all deliberately absent, in the same
// spirit as the missing costing-method switch and the missing recipe editor —
// an agent should be able to tell you your worst supplier is late on a third of
// its orders, and should not be able to approve the next order to them.
//
// Per the platform's BYOK/MCP-only rule, sparx runs no model here — the tenant
// brings their own client.

import { z } from 'zod';

import { inventoryService } from '../services';
import type { AnyMcpTool, McpToolDefinition } from './registry';

const Uuid = z.string().uuid();

const supplierPerformance: McpToolDefinition = {
  name: 'get_supplier_performance',
  description:
    "One supplier's scorecard: how often they deliver on time, how often the quantity matches what was ordered, how far their invoices drift from the agreed price, their average lead time and how much it varies, and what you have spent with them. Returns null when that supplier has never been scored — which happens when there is not enough delivery history yet, and is a real answer rather than a zero.",
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({ supplierId: Uuid }),
  run: (ctx, input) => {
    const i = input as { supplierId: string };
    return inventoryService.getSupplierScorecard(ctx, i.supplierId);
  },
};

const scorecards: McpToolDefinition = {
  name: 'list_supplier_scorecards',
  description:
    'The supplier league table, worst first. Use this for "which of my suppliers is the problem". Suppliers with too little history to score sort last and are counted separately rather than being left out — "we cannot yet measure these five" is part of an honest answer. Also reports when the scoring sweep last ran, so a stale table is visible as stale.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    supplierId: Uuid.optional(),
    /** Off by default: the unscorable suppliers are part of the picture. */
    scoredOnly: z.boolean().default(false),
    take: z.number().int().min(1).max(500).default(100),
    skip: z.number().int().min(0).default(0),
  }),
  run: (ctx, input) => inventoryService.listSupplierScorecards(ctx, input as Record<string, never>),
};

const priceLadder: McpToolDefinition = {
  name: 'get_supplier_price_ladder',
  description:
    'What one item costs from one supplier at each order size — the quantity breaks, in ascending order. Use this to answer "is it worth ordering more to get the next price" before raising a purchase order.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    /** The supplier-to-item LINK, not the item: the same part from two suppliers
     *  has two ladders, and there is no single price for "this item". */
    supplierVariantId: Uuid,
  }),
  run: (ctx, input) => {
    const i = input as { supplierVariantId: string };
    return inventoryService.getPriceLadder(ctx, i.supplierVariantId);
  },
};

const approvals: McpToolDefinition = {
  name: 'list_purchase_order_approvals',
  description:
    'The purchase orders waiting on somebody to approve them, with who is required and how long each has been sitting. Read-only on purpose: deciding one commits money to another company, and that stays a person\'s click. Use this to answer "what is being held up" and "who is the hold-up".',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
    purchaseOrderId: Uuid.optional(),
    requiredApproverUserId: Uuid.optional(),
    take: z.number().int().min(1).max(250).default(50),
    skip: z.number().int().min(0).default(0),
  }),
  run: (ctx, input) => inventoryService.listPoApprovals(ctx, input as Record<string, never>),
};

const asns: McpToolDefinition = {
  name: 'list_advance_ship_notices',
  description:
    'What suppliers have told you is on its way but has not arrived: the order it belongs to, what is on the truck, and when it was said to land. `overdueOnly` narrows to the ones that are past their stated arrival date and still not here — the chase list.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    purchaseOrderId: Uuid.optional(),
    supplierId: Uuid.optional(),
    status: z.enum(['expected', 'received', 'cancelled']).optional(),
    overdueOnly: z.boolean().default(false),
    take: z.number().int().min(1).max(250).default(50),
    skip: z.number().int().min(0).default(0),
  }),
  run: (ctx, input) => inventoryService.listAdvanceShipNotices(ctx, input as Record<string, never>),
};

const asn: McpToolDefinition = {
  name: 'get_advance_ship_notice',
  description:
    'One despatch note in full — every line the supplier says is on the vehicle, against what the purchase order asked for, so a short shipment is visible before the pallet is opened.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({ id: Uuid }),
  run: (ctx, input) => {
    const i = input as { id: string };
    return inventoryService.getAdvanceShipNotice(ctx, i.id);
  },
};

const supplierReturns: McpToolDefinition = {
  name: 'list_supplier_returns',
  description:
    'Stock sent back to suppliers, and what it is worth. `awaitingCreditOnly` is the money question: everything despatched to a supplier with no credit note recorded against it — the amount you are owed and nobody is chasing.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    supplierId: Uuid.optional(),
    warehouseId: Uuid.optional(),
    status: z.enum(['draft', 'sent', 'credited', 'closed', 'cancelled']).optional(),
    awaitingCreditOnly: z.boolean().default(false),
    take: z.number().int().min(1).max(250).default(50),
    skip: z.number().int().min(0).default(0),
  }),
  run: (ctx, input) => inventoryService.listSupplierReturns(ctx, input as Record<string, never>),
};

const supplierReturn: McpToolDefinition = {
  name: 'get_supplier_return',
  description:
    'One supplier return in full: the lines, the reason each went back, what was claimed, and what credit has actually landed against it.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({ id: Uuid }),
  run: (ctx, input) => {
    const i = input as { id: string };
    return inventoryService.getSupplierReturn(ctx, i.id);
  },
};

export const supplierPerformanceReadTools: AnyMcpTool[] = [
  supplierPerformance,
  scorecards,
  priceLadder,
  approvals,
  asns,
  asn,
  supplierReturns,
  supplierReturn,
];
