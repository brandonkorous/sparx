// Demand-side commitment MCP tools (docs/146 Phase 9, surfaced in Phase 12.1).
//
// Stock has two sides, and most systems only expose one. Phase 9 built the other:
// what you have PROMISED but cannot yet ship (backorders), what is on your shelves
// that you do not own (consignment), and what is going to stop being sellable
// (expiring batches). All three change what a number on the valuation screen
// means, and none of them was reachable from an assistant until now.
//
// ── Why this file is entirely READ ───────────────────────────────────────
//
// Each write here changes a promise or a balance sheet. Cancelling a backorder
// breaks a commitment to a named customer. Marking stock as consignment moves it
// out of what you own — the valuation drops without a single unit moving.
// Marking a batch down, or writing it off, destroys value on the strength of a
// date. Those stay where a person does them and can see what they cost.
//
// Per the platform's BYOK/MCP-only rule, sparx runs no model here — the tenant
// brings their own client.

import { z } from 'zod';

import { inventoryService } from '../services';
import type { AnyMcpTool, McpToolDefinition } from './registry';

const Uuid = z.string().uuid();

const backorders: McpToolDefinition = {
  name: 'list_backorders',
  description:
    'What you owe people and have not shipped: who is waiting, for what, how many, when they were promised it, and their place in the queue. `overdueOnly` is everything already past its promised date; `undatedOnly` is the worse list — commitments nobody has given a date at all, which is how a customer ends up waiting without ever being told.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    status: z.enum(['open', 'partial', 'fulfilled', 'cancelled']).optional(),
    variantId: Uuid.optional(),
    warehouseId: Uuid.optional(),
    customerId: Uuid.optional(),
    undatedOnly: z.boolean().default(false),
    overdueOnly: z.boolean().default(false),
    take: z.number().int().min(1).max(200).default(50),
    skip: z.number().int().min(0).default(0),
  }),
  run: (ctx, input) => inventoryService.listBackorders(ctx, input as Record<string, never>),
};

const backorder: McpToolDefinition = {
  name: 'get_backorder',
  description:
    'One commitment in full: the customer, the item, how much of it has been allocated as stock arrived, what remains owed, and the history of how the promised date has moved.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({ id: Uuid }),
  run: (ctx, input) => {
    const i = input as { id: string };
    return inventoryService.getBackorder(ctx, i.id);
  },
};

const commitments: McpToolDefinition = {
  name: 'get_variant_commitments',
  description:
    'For one item: how many units are owed to customers across every open commitment, how many separate commitments that is, and the soonest date anybody was promised. Use this before answering "can I sell this" — free stock is not the same as unspoken-for stock, and the difference is exactly this number.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({ variantId: Uuid }),
  run: (ctx, input) => {
    const i = input as { variantId: string };
    return inventoryService.getVariantCommitmentSummary(ctx, i.variantId);
  },
};

const settlements: McpToolDefinition = {
  name: 'list_consignment_settlements',
  description:
    'Consignment settlements — the periodic reckoning with whoever owns stock sitting on your shelves: what sold, what is owed, and whether it has been invoiced and paid. Reports the total outstanding across the list, which is the number that matters.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    status: z.enum(['open', 'closed', 'invoiced', 'paid', 'cancelled']).optional(),
    supplierId: Uuid.optional(),
    take: z.number().int().min(1).max(200).default(50),
    skip: z.number().int().min(0).default(0),
  }),
  run: (ctx, input) =>
    inventoryService.listConsignmentSettlements(ctx, input as Record<string, never>),
};

const settlement: McpToolDefinition = {
  name: 'get_consignment_settlement',
  description:
    'One settlement in full: every unit sold in the period, at what price, and what is therefore owed to the owner of that stock.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({ id: Uuid }),
  run: (ctx, input) => {
    const i = input as { id: string };
    return inventoryService.getConsignmentSettlement(ctx, i.id);
  },
};

const unsettled: McpToolDefinition = {
  name: 'list_unsettled_consignment',
  description:
    'Consignment sales that no settlement covers yet, grouped by whose stock it was. This is the gap between "we sold it" and "we have accounted to the owner for it" — the list that says a settlement is overdue.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({}),
  run: (ctx) => inventoryService.listUnsettledConsignment(ctx),
};

const nonOwned: McpToolDefinition = {
  name: 'list_non_owned_stock',
  description:
    'Stock on your shelves that you do not own — consignment and customer-owned — with whose it is and what it is worth. It is sellable and it is countable, and it must NOT appear in what your business is worth; this is the list that proves the valuation excluded it.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    ownership: z.enum(['owned', 'consignment', 'customer_owned']).optional(),
    warehouseId: Uuid.optional(),
    ownerSupplierId: Uuid.optional(),
    take: z.number().int().min(1).max(200).default(50),
    skip: z.number().int().min(0).default(0),
  }),
  run: (ctx, input) => inventoryService.listNonOwnedStock(ctx, input as Record<string, never>),
};

const expiring: McpToolDefinition = {
  name: 'list_expiring_stock',
  description:
    'Batches running out of time, bucketed by how long is left and priced at what they cost. Batches with NO expiry date are included by default and are a finding in themselves — a perishable line nobody dated is one nobody can manage. Use this for "what do I need to shift this month".',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    withinDays: z.number().int().min(1).max(1095).optional(),
    warehouseId: Uuid.optional(),
    includeUndated: z.boolean().default(true),
  }),
  run: (ctx, input) => inventoryService.listExpiringStock(ctx, input as Record<string, never>),
};

export const commitmentReadTools: AnyMcpTool[] = [
  backorders,
  backorder,
  commitments,
  settlements,
  settlement,
  unsettled,
  nonOwned,
  expiring,
];
