// Per-request McpServer factory.
//
// MCP's StreamableHTTPServerTransport is connection-scoped, but we want
// per-request tenant context. Stateless mode + a fresh McpServer per HTTP
// request is the simplest correct approach: each request authenticates,
// builds an McpServer with handlers closing over the tenant context, then
// connects + dispatches once.
//
// Each tool definition from `@sparx/crm`'s `crmMcpTools` is registered with
// the SDK's `registerTool`. Scope is checked before dispatch — a tool whose
// scope isn't in the caller's grant set returns an error result (the LLM
// can see why and reroute). Confirmation:true tools surface the
// `destructiveHint` annotation so the MCP client can prompt the user.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { isModuleEnabled, type ModuleSlug } from '@sparx/auth';
import type { McpAuthContext } from './auth.js';
import { recordToolInvocation } from './audit.js';
import { ALL_MCP_TOOLS, type AnyMcpTool } from './tool-registry.js';

const SERVER_INFO = { name: 'sparx-mcp', version: '1.0.0' } as const;

// Scopes whose tools also require a specific MODULE to be active (beyond the
// global `ai` gate). Sparx is module-based — a disabled module stores no rows
// (docs/87 §14) — so a tool that writes a module's data refuses when that module
// is off, mirroring the REST routes' `requireXModule`. Only modules that opt in
// appear here; everything else is reachable on scope alone (the prior behavior).
const MODULE_BY_SCOPE: Record<string, ModuleSlug> = {
  'read:invoicing': 'invoicing',
  'write:invoicing': 'invoicing',
};

export function buildServerForRequest(auth: McpAuthContext): McpServer {
  const server = new McpServer(SERVER_INFO);

  for (const tool of ALL_MCP_TOOLS) {
    // ZodObject is `AnySchema`-compatible — pass it through so the SDK can
    // derive the JSON-schema for the client without us re-deriving the shape.
    const inputSchema = tool.input as Parameters<typeof server.registerTool>[1]['inputSchema'];
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema,
        annotations: {
          // confirmation:true tools mutate state in a way that needs user
          // acknowledgement before invocation. The destructiveHint tells
          // MCP clients (Claude desktop, ChatGPT) to prompt.
          destructiveHint: tool.confirmation,
          openWorldHint: !tool.scope.startsWith('read:'),
        },
      },
      (async (input: unknown) => dispatch(tool, auth, input)) as Parameters<
        typeof server.registerTool
      >[2]
    );
  }

  return server;
}

async function dispatch(
  tool: AnyMcpTool,
  auth: McpAuthContext,
  input: unknown
): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  if (!auth.scopes.has(tool.scope)) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `forbidden: tool "${tool.name}" requires scope "${tool.scope}" which is not granted`,
        },
      ],
    };
  }

  // Module gate — a tool whose scope maps to a module refuses when that module
  // isn't active for the tenant (docs/87 §14: a disabled module stores no rows).
  const requiredModule = MODULE_BY_SCOPE[tool.scope];
  if (requiredModule && !(await isModuleEnabled(auth.tenantId, requiredModule))) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `forbidden: the ${requiredModule} module is not active for this tenant`,
        },
      ],
    };
  }

  const ctx = { tenantId: auth.tenantId, userId: auth.userId };
  try {
    const parsed = tool.input.parse(input);
    const result = await tool.run(ctx, parsed);
    void recordToolInvocation({
      tenantId: auth.tenantId,
      userId: auth.userId,
      toolName: tool.name,
      input: parsed,
      outcome: 'success',
    });
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    void recordToolInvocation({
      tenantId: auth.tenantId,
      userId: auth.userId,
      toolName: tool.name,
      input,
      outcome: 'error',
      errorMessage: message,
    });
    return { isError: true, content: [{ type: 'text', text: message }] };
  }
}
