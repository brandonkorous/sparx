// Automation MCP tool registry (docs/81 §8/§9, docs/84 Slice H).
//
// The AI authoring + observability path for the cross-module rule engine. Each
// tool is a thin wrapper over a function in the automation SERVICE layer — the
// same layer the REST routes (`/v1/automations`) and the seed path use (one
// service, three transports). A fix in `createAutomation` is a fix in the
// `create_automation` MCP tool automatically; the tier invariants (origin/locked
// system-managed, LOCKED rejects edit/status/delete → "Duplicate to edit") are
// enforced once, in the service, for every transport.
//
// Each tool declares:
//   • name (the MCP-visible identifier)
//   • description (LLM-facing — surfaces in the tool catalog)
//   • scope (`read:automations` reads freely; `write:automations` authors rules)
//   • input (Zod schema for the tool's arguments — the SDK derives JSON-schema)
//   • confirmation (true for writes — the MCP server surfaces a destructiveHint
//     so the client prompts before invoking)
//   • run (handler that calls the service)
//
// The MCP server (`wizeworks/services/api-mcp`) imports `automationMcpTools`, translates
// each spec into the @modelcontextprotocol/sdk shape, and publishes it. Note the
// engine's effect dispatcher is NOT reachable here: the AI authors rules, it
// never fires an action directly — that stays the gated dispatcher's sole job.

import type { z } from 'zod';

import type { ServiceCtx } from '../service/automation-service';

export type AutomationMcpScope = 'read:automations' | 'write:automations';

export interface McpToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  scope: AutomationMcpScope;
  input: z.ZodType<TInput>;
  /** Writes — the MCP server must surface a confirmation prompt to the user
   *  before invoking. Reads are false (the agent may call them freely). */
  confirmation: boolean;
  run(ctx: ServiceCtx, input: TInput): Promise<TOutput>;
}

/** Helper for downstream code that wants a typed entry without losing the
 *  TInput/TOutput pair. */
export type AnyMcpTool = McpToolDefinition<unknown, unknown>;
