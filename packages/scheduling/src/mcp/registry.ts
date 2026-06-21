// Scheduling MCP tool registry types (docs/79 §11, docs/07). Each tool is a thin
// wrapper over the @sparx/scheduling SERVICE layer — the same functions the REST
// routes + public booking widget call (one service, many transports). A fix in
// createBooking is a fix in the `create_booking` MCP tool automatically; the
// no-overlap guarantee + lifecycle invariants are enforced once, in the engine.
//
// Scopes: `read:scheduling` (the agent may call freely) and `write:scheduling`
// (booking lifecycle — confirmation-gated). The api-mcp server additionally gates
// these on the `scheduling` module being active (MODULE_BY_SCOPE), beyond the
// global `ai` module gate.

import type { z } from 'zod';

export type SchedulingMcpScope = 'read:scheduling' | 'write:scheduling';

export interface SchedulingMcpCtx {
  tenantId: string;
  userId: string;
}

export interface McpToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  scope: SchedulingMcpScope;
  input: z.ZodType<TInput>;
  /** Writes — the MCP server surfaces a destructiveHint so the client prompts
   *  before invoking. Reads are false (the agent may call them freely). */
  confirmation: boolean;
  run(ctx: SchedulingMcpCtx, input: TInput): Promise<TOutput>;
}

export type AnyMcpTool = McpToolDefinition<unknown, unknown>;
