// Per-request McpServer factory (docs/113 §3.2). Mirrors api-mcp's pattern: a
// fresh McpServer per HTTP request (stateless transport). Tools come from the
// shared @sparx/storefront-mcp catalog; each dispatch is an HTTP call to a
// public route. Phase 1 registers `read` + `guest_write` tools only.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  toolsForModules,
  mcpAnnotations,
  StorefrontApiError,
  type StorefrontApiClient,
  type StorefrontCtx,
  type StorefrontTool,
} from '@sparx/storefront-mcp';

const SERVER_INFO = { name: 'sparx-storefront-mcp', version: '1.0.0' };

interface ToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

export function buildStorefrontServer(
  client: StorefrontApiClient,
  ctx: StorefrontCtx,
  disabledModules: readonly string[]
): McpServer {
  const server = new McpServer(SERVER_INFO);

  // Skip modules the tenant switched off (cleaner tools/list) and the Phase-2
  // customer tier (not wired yet).
  const tools = toolsForModules(disabledModules).filter((t) => t.kind !== 'customer');

  for (const tool of tools) {
    const inputSchema = tool.input as Parameters<typeof server.registerTool>[1]['inputSchema'];
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema, annotations: mcpAnnotations(tool) },
      (async (input: unknown) => dispatch(tool, client, ctx, input)) as Parameters<
        typeof server.registerTool
      >[2]
    );
  }

  return server;
}

async function dispatch(
  tool: StorefrontTool,
  client: StorefrontApiClient,
  ctx: StorefrontCtx,
  input: unknown
): Promise<ToolResult> {
  try {
    const parsed = tool.input.parse(input);
    const result = await tool.call(client, ctx, parsed);
    const payload =
      result.meta !== undefined ? { data: result.data, meta: result.meta } : result.data;
    return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
  } catch (err) {
    if (err instanceof StorefrontApiError) {
      // The public route rejected the call (module off, not found, validation…).
      // Surface it as an error RESULT so the LLM can see why and reroute.
      return { isError: true, content: [{ type: 'text', text: `${err.code}: ${err.message}` }] };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { isError: true, content: [{ type: 'text', text: `invalid request: ${message}` }] };
  }
}
