// CMS MCP tool registry types (docs/12, docs/07). Each tool is a thin wrapper
// over the @sparx/cms SERVICE layer — the same functions the REST routes call
// (one service, many transports). A fix in createEntry is a fix in the
// `create_content_entry` MCP tool automatically.
//
// Scopes: `read:cms` (the agent may call freely) and `write:cms` (mutations —
// confirmation-gated). The api-mcp server additionally gates these on the `cms`
// module being active (MODULE_BY_SCOPE), beyond the global `ai` module gate.

import type { z } from 'zod';

export type CmsMcpScope = 'read:cms' | 'write:cms';

export interface CmsMcpCtx {
  tenantId: string;
  userId: string;
}

export interface McpToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  scope: CmsMcpScope;
  input: z.ZodType<TInput>;
  /** Writes set true so the MCP client surfaces a destructiveHint + prompts. */
  confirmation: boolean;
  run(ctx: CmsMcpCtx, input: TInput): Promise<TOutput>;
}

export type AnyMcpTool = McpToolDefinition<unknown, unknown>;
