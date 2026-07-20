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
import { loadDisabledTools } from './tool-policy.js';
import { ALL_MCP_TOOLS, isSiteScopableTool, type AnyMcpTool } from './tool-registry.js';

const SERVER_INFO = { name: 'sparx-mcp', version: '1.0.0' } as const;

// Sent to the MCP client on `initialize` — the standing "how to use this server"
// instructions. Its #1 job is the MULTISITE guardrail: the builder tools silently
// default to the tenant's PRIMARY site, so an agent that never targets a site can
// overwrite the wrong one (this happened). Keep it short and imperative.
const SERVER_INSTRUCTIONS = [
  'This server manages one sparx tenant — its content, commerce, CRM, email, and one or more SITES (web properties).',
  'MULTISITE — READ FIRST: a tenant can own MORE THAN ONE site. Before you create or edit any page, theme, ' +
    'layout, or site setting, call `list_sites` and pass the intended site’s `id` as the `propertyId` argument. ' +
    'Omitting `propertyId` silently targets the tenant’s PRIMARY site — which overwrites the wrong site if you ' +
    'meant a different one.',
  'Site-editing tools echo the resolved `site` ({id, name, isPrimary}) in their result — always confirm it is the ' +
    'site you intended before continuing.',
  'Builder pages author the page BODY (create_builder_page / update_builder_page); the header/footer/nav is a ' +
    'separate site LAYOUT (get_builder_layout → update_builder_layout → publish_builder_layout). Set page SEO ' +
    'inline via the page document’s seoTitle/seoDescription. Give a site its own look with a saved theme ' +
    '(create_saved_theme → apply_saved_theme) rather than editing a shared preset. Changes are DRAFTs until published.',
].join('\n\n');

// Scopes whose tools also require a specific MODULE to be active (beyond the
// global `ai` gate). sparx is module-based — a disabled module stores no rows
// (docs/87 §14) — so a tool that writes a module's data refuses when that module
// is off, mirroring the REST routes' `requireXModule`. Only modules that opt in
// appear here; everything else is reachable on scope alone (the prior behavior).
const MODULE_BY_SCOPE: Record<string, ModuleSlug> = {
  'read:invoicing': 'invoicing',
  'write:invoicing': 'invoicing',
  // Inventory is a first-class module (docs/100 §4.0) — its tools refuse when the
  // tenant doesn't have it active (standalone-usable; reachable even without commerce).
  'read:inventory': 'inventory',
  'write:inventory': 'inventory',
  // Scheduling (docs/79 §11) — the 12th module; its tools refuse when the tenant
  // doesn't have Scheduling active (beyond the global `ai` gate).
  'read:scheduling': 'scheduling',
  'write:scheduling': 'scheduling',
  // CMS (docs/12) — content-type / entry tools refuse when the tenant doesn't
  // have the `cms` module active.
  'read:cms': 'cms',
  'write:cms': 'cms',
};

export async function buildServerForRequest(auth: McpAuthContext): Promise<McpServer> {
  const server = new McpServer(SERVER_INFO, { instructions: SERVER_INSTRUCTIONS });

  // Per-tenant tool-policy overlay (docs/07 §9): tools the tenant disabled are not
  // registered at all — so they're absent from tools/list AND the SDK rejects any
  // direct tools/call for an unregistered name. Registration-skip IS the enforcement.
  // Per-SITE now (docs/131 §3.5). `auth.propertyId` is the key this connection is
  // RESTRICTED to, so a key scoped to one business sees that business's tool
  // policy; an unrestricted key sees only the tenant-wide rows, which is the
  // honest answer — there is no single site whose overrides could apply.
  const disabledTools = await loadDisabledTools(auth.tenantId, auth.propertyId ?? null);

  for (const tool of ALL_MCP_TOOLS) {
    if (disabledTools.has(tool.name)) continue;
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

  // Site gate — a credential issued for ONE of the tenant's businesses must not
  // read or write another's (docs/131 §3.2). Sits beside the module gate because
  // it is the same kind of check: a precondition on the caller's reach, decided
  // before the tool runs.
  //
  // A tool that cannot honour the restriction is REFUSED, not silently run
  // tenant-wide. That is the whole point — the defect being fixed is a key that
  // looked scoped and wasn't, so the failure has to be loud. The message names
  // the tool so the limitation is actionable rather than mysterious.
  if (auth.propertyId && !isSiteScopableTool(tool.name)) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text:
            `forbidden: this credential is limited to a single site, and ${tool.name} ` +
            `cannot yet be limited to one — it would read across every site this ` +
            `account owns. Use a tenant-wide key if that is genuinely intended.`,
        },
      ],
    };
  }

  const ctx = {
    tenantId: auth.tenantId,
    userId: auth.userId,
    // The ceiling, not a target: site-aware tools resolve their target through
    // toPropertyContext, which refuses to exceed this.
    restrictToPropertyId: auth.propertyId,
  };
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
