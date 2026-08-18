// Bin MCP tools (docs/146 Phase 2).
//
// The questions someone asks out loud on a warehouse floor, made answerable by
// whatever assistant they already use: "where is this", "what's on that shelf",
// "where should I put these", "move them". Thin wrappers over the same service
// the REST routes call, so a fix lands in both.
//
// Per the platform's BYOK/MCP-only rule, sparx runs no model here — the tenant
// brings their own client.

import { z } from 'zod';

import { MoveBetweenBinsInput } from '@wizeworks/commerce-schemas';

import { inventoryService } from '../services';
import type { AnyMcpTool, McpToolDefinition } from './registry';

const Uuid = z.string().uuid();

const findStock: McpToolDefinition = {
  name: 'find_stock_location',
  description:
    'Where an item physically is: every shelf holding it, how many are on each, when each was last counted, and whether that shelf counts toward what a customer can buy. Ordered by the pick walk, so the answer reads as a route rather than a set. Use this for "where is X" and "which shelf should I pick from".',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    variantId: Uuid,
    warehouseId: Uuid.optional(),
    /** Include shelves recorded as holding zero — useful when hunting a
     *  discrepancy, noise otherwise. */
    includeEmpty: z.boolean().default(false),
  }),
  run: (ctx, input) => {
    const i = input as { variantId: string; warehouseId?: string; includeEmpty: boolean };
    return inventoryService.binsForVariant(ctx, i.variantId, {
      ...(i.warehouseId ? { warehouseId: i.warehouseId } : {}),
      includeEmpty: i.includeEmpty,
    });
  },
};

const listShelves: McpToolDefinition = {
  name: 'list_bins',
  description:
    'The shelves in a location, with how many distinct items and how many units each holds. Filter by zone, by kind (pick, bulk, receiving, staging, quarantine, damaged), by free text over the label, or to only those currently holding something.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    warehouseId: Uuid.optional(),
    zone: z.string().max(60).optional(),
    type: z.enum(['pick', 'bulk', 'receiving', 'staging', 'quarantine', 'damaged']).optional(),
    q: z.string().max(200).optional(),
    nonEmptyOnly: z.boolean().default(false),
    take: z.number().int().min(1).max(500).default(100),
  }),
  run: (ctx, input) => inventoryService.listBins(ctx, input as Record<string, unknown>),
};

const shelfContents: McpToolDefinition = {
  name: 'get_bin_contents',
  description:
    'Everything on one shelf: each item, how many, and when it was last physically confirmed. Use this to answer "what is on A-01" and to prepare a shelf count.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    binId: Uuid,
    includeEmpty: z.boolean().default(false),
  }),
  run: (ctx, input) => {
    const i = input as { binId: string; includeEmpty: boolean };
    return inventoryService.binContents(ctx, i.binId, { includeEmpty: i.includeEmpty });
  },
};

const suggestShelf: McpToolDefinition = {
  name: 'suggest_put_away',
  description:
    "Where a delivery should go. Returns several shelves in order of how strong the evidence is — the item's declared home shelf, then a shelf already holding it, then a pick shelf with room, then the fallback — each with the reason in plain words so the person on the floor can disagree. Advice, not an instruction: a warehouse always has reasons the system does not know.",
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    variantId: Uuid,
    warehouseId: Uuid,
    quantity: z.number().int().min(0).max(10_000_000).optional(),
  }),
  run: (ctx, input) =>
    inventoryService.suggestPutAway(ctx, input as { variantId: string; warehouseId: string }),
};

const moveShelf: McpToolDefinition = {
  name: 'move_between_bins',
  description:
    'Move stock from one shelf to another within the same location. Records a pair of shelf-level entries and does NOT change the location total, because nothing entered or left the building. Refuses a move across locations — that is a transfer, which tracks the stock while it is in transit.',
  scope: 'write:inventory',
  confirmation: true,
  input: MoveBetweenBinsInput,
  run: (ctx, input) => inventoryService.moveBetweenBins(ctx, input),
};

export const binReadTools: AnyMcpTool[] = [findStock, listShelves, shelfContents, suggestShelf];

export const binWriteTools: AnyMcpTool[] = [moveShelf];
