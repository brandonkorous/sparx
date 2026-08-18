// The shared shape every B2B MCP tool implements. Mirrors the CRM / social
// registries: a tool is a thin, self-describing wrapper over the service layer.

import type { z } from 'zod';
import type { B2bContext } from '../context.js';

export type McpScope = 'read:b2b' | 'write:b2b';

// The context an MCP tool runs under. The dispatch layer (api-mcp server.ts)
// passes { tenantId, userId, restrictToPropertyId }; B2B tools read tenant + user.
export type B2bMcpCtx = B2bContext;

export interface McpToolDefinition {
  name: string;
  description: string;
  scope: McpScope;
  /** Surfaces the SDK `destructiveHint` so MCP clients prompt before running. */
  confirmation: boolean;
  input: z.ZodType;
  run(ctx: B2bMcpCtx, input: unknown): Promise<unknown>;
}

export type AnyMcpTool = McpToolDefinition;
