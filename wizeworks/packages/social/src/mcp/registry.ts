// Social MCP tool registry contract (docs/133, docs/07). Own scope vocabulary
// (`read:social` / `write:social`) so the api-mcp server can gate on a social-only
// API key + the `social` module flag, mirroring the other first-class modules.

import type { z } from 'zod';

import type { SocialContext } from '../service.js';

export type McpScope = 'read:social' | 'write:social';

/** The context an MCP social tool runs under — the same {tenantId, userId} the
 *  REST transport builds from a request. */
export type SocialMcpCtx = SocialContext;

export interface McpToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  scope: McpScope;
  input: z.ZodType<TInput>;
  /** Consequential writes (publish to a live account, schedule) — the MCP server
   *  surfaces a confirmation prompt before invoking. */
  confirmation: boolean;
  run(ctx: SocialMcpCtx, input: TInput): Promise<TOutput>;
}

export type AnyMcpTool = McpToolDefinition<unknown, unknown>;
