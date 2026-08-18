// Inventory MCP tools (docs/100 P6c, docs/07). Each is a thin wrapper over a
// service-layer function — one service, many transports (REST + MCP), so a fix in
// the service fixes the tool. The supply loop the AI can run end-to-end:
//   suggest_reorders → create_purchase_order → receive_stock,
// plus get_low_inventory / get_inventory_valuation (read) and update_inventory
// (direct stock adjust).
//
// `update_inventory` forces `actorType: 'ai'` so the ledger attributes the
// movement to the agent. The PO + receipt tools record their movements/audit under
// the calling key's user (the api_keys row identifies it as the AI integration);
// threading `ai` through those paths would need an actorType on ServiceContext,
// which is a separate change.

import { z } from 'zod';

import {
  AdjustInventoryInput,
  CreateGoodsReceiptInput,
  CreatePurchaseOrderInput,
} from '@wizeworks/commerce-schemas';

import { inventoryService } from '../services';
import type { AnyMcpTool, McpToolDefinition } from './registry';

const Uuid = z.string().uuid();

// ─── Read tools ───────────────────────────────────────────────────────

const getLowInventory: McpToolDefinition = {
  name: 'get_low_inventory',
  description: 'List variants at or below their reorder point, optionally scoped to a warehouse.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    warehouseId: Uuid.optional(),
    take: z.number().int().min(1).max(100).default(50),
  }),
  run: (ctx, input) => inventoryService.listLowStock(ctx, input as Record<string, unknown>),
};

const getInventoryValuation: McpToolDefinition = {
  name: 'get_inventory_valuation',
  description: 'Current inventory valuation: on-hand units and value at cost and at retail.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({}),
  run: (ctx) => inventoryService.inventoryValuation(ctx),
};

const suggestReorders: McpToolDefinition = {
  name: 'suggest_reorders',
  description:
    'Reorder suggestions: items at or below their reorder point grouped by preferred supplier, with suggested quantities and what is already on order. Items with no supplier link are listed separately.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    warehouseId: Uuid.optional(),
    take: z.number().int().min(1).max(500).default(200),
  }),
  run: (ctx, input) =>
    inventoryService.listReorderSuggestions(ctx, input as Record<string, unknown>),
};

// ─── Write tools (confirmation: true) ─────────────────────────────────

const updateInventory: McpToolDefinition = {
  name: 'update_inventory',
  description:
    'Adjust on-hand quantity for a variant at a warehouse (signed delta with a reason). Recorded as an AI-attributed movement in the ledger.',
  scope: 'write:inventory',
  confirmation: true,
  input: AdjustInventoryInput,
  run: (ctx, input) =>
    inventoryService.adjust(ctx, { ...(input as Record<string, unknown>), actorType: 'ai' }),
};

const createPurchaseOrder: McpToolDefinition = {
  name: 'create_purchase_order',
  description:
    'Create a draft purchase order to a supplier for a warehouse, with line items. Returns the PO with computed totals; submit it separately to place the order.',
  scope: 'write:inventory',
  confirmation: true,
  input: CreatePurchaseOrderInput,
  run: (ctx, input) => inventoryService.createPurchaseOrder(ctx, input),
};

const receiveStock: McpToolDefinition = {
  name: 'receive_stock',
  description:
    'Receive stock against a submitted purchase order — raises on-hand through the ledger, advances the PO status, and records lots. Provide the purchase order id and the received lines.',
  scope: 'write:inventory',
  confirmation: true,
  input: CreateGoodsReceiptInput,
  run: (ctx, input) => inventoryService.createGoodsReceipt(ctx, input),
};

export const readTools: AnyMcpTool[] = [getLowInventory, getInventoryValuation, suggestReorders];
export const writeTools: AnyMcpTool[] = [updateInventory, createPurchaseOrder, receiveStock];
