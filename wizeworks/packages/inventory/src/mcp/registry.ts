// Inventory MCP tool registry. Mirrors @wizeworks/commerce/mcp/registry — same shape,
// a separate scope vocabulary so the MCP server can enforce inventory-only API-key
// permissions. Inventory is a first-class module with its OWN MCP surface (docs/100
// §4.0): the supply loop (low stock → reorder suggestion → purchase order → receive)
// plus valuation and direct stock adjust, reachable whenever the `inventory` module
// is active — even when commerce is off (standalone WMS-lite).

import type { z } from 'zod';

import type { ServiceContext } from '../errors';

export type McpScope = 'read:inventory' | 'write:inventory';

export interface McpToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  scope: McpScope;
  input: z.ZodType<TInput>;
  /** Mutating tools — the MCP server surfaces a confirmation prompt first. */
  confirmation: boolean;
  run(ctx: ServiceContext, input: TInput): Promise<TOutput>;
}

export type AnyMcpTool = McpToolDefinition<unknown, unknown>;
