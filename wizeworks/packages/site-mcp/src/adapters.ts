// Host adapters (docs/113 §3.3-3.4). The catalog is transport-neutral; these
// turn it into the shapes each host needs:
//   • toAnthropicTools() — Anthropic Messages `tools` (for the concierge loop).
//   • mcpAnnotations()   — MCP `annotations` (destructiveHint / openWorldHint).
// The mcp-site service passes each tool's `input` ZodObject straight to
// the SDK's registerTool (same as api-mcp), so no MCP-schema adapter is needed.

import { z } from 'zod';
import type { SiteTool } from './types.js';

export interface AnthropicToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/** Convert catalog tools to Anthropic tool definitions (JSON-schema inputs). */
export function toAnthropicTools(tools: readonly SiteTool[]): AnthropicToolDef[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: z.toJSONSchema(t.input),
  }));
}

/** MCP tool annotations: non-read tools mutate state, so hint clients to confirm
 *  and mark them open-world (they reach beyond a closed read set). */
export function mcpAnnotations(tool: SiteTool): {
  destructiveHint: boolean;
  openWorldHint: boolean;
} {
  const mutates = tool.kind !== 'read';
  return { destructiveHint: mutates, openWorldHint: mutates };
}
