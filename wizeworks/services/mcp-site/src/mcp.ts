// Per-request McpServer factory (docs/113 §3.2). Mirrors api-mcp's pattern: a
// fresh McpServer per HTTP request (stateless transport). Tools come from the
// shared @wizeworks/site-mcp catalog; each dispatch is an HTTP call to a
// public route. Phase 1 registers `read` + `guest_write` tools only.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getSiteTool,
  toolsForModules,
  mcpAnnotations,
  SiteApiError,
  type SiteApiClient,
  type SiteCtx,
  type SiteTool,
} from '@wizeworks/site-mcp';

const SERVER_INFO = { name: 'sparx-site-mcp', version: '1.0.0' };

interface JsonRpcCall {
  method?: unknown;
  params?: { name?: unknown } | null;
}

/** True when a JSON-RPC body invokes a `customer`-tier tool (single or batch) —
 *  those need a verified shopper bearer, so an unauthenticated call is answered
 *  with a 401 + WWW-Authenticate to bootstrap the OAuth flow (docs/113 §5). */
export function invokesCustomerTool(body: unknown): boolean {
  const calls: unknown[] = Array.isArray(body) ? body : [body];
  return calls.some((c) => {
    const call = c as JsonRpcCall;
    if (call?.method !== 'tools/call') return false;
    const name = call.params?.name;
    return typeof name === 'string' && getSiteTool(name)?.kind === 'customer';
  });
}

interface ToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

export function buildSiteServer(
  client: SiteApiClient,
  ctx: SiteCtx,
  disabledModules: readonly string[]
): McpServer {
  const server = new McpServer(SERVER_INFO);

  // Skip modules the tenant switched off (cleaner tools/list). Customer-tier tools
  // ARE registered so the client can see the capability; a call without a valid
  // bearer is challenged at the HTTP layer (app.ts) and, once authorized, api-rest
  // verifies + scope-gates the relayed bearer.
  const tools = toolsForModules(disabledModules);

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
  tool: SiteTool,
  client: SiteApiClient,
  ctx: SiteCtx,
  input: unknown
): Promise<ToolResult> {
  try {
    const parsed = tool.input.parse(input);
    const result = await tool.call(client, ctx, parsed);
    const payload =
      result.meta !== undefined ? { data: result.data, meta: result.meta } : result.data;
    return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
  } catch (err) {
    if (err instanceof SiteApiError) {
      // The public route rejected the call (module off, not found, validation…).
      // Surface it as an error RESULT so the LLM can see why and reroute.
      return { isError: true, content: [{ type: 'text', text: `${err.code}: ${err.message}` }] };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { isError: true, content: [{ type: 'text', text: `invalid request: ${message}` }] };
  }
}
