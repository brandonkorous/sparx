// Per-tenant MCP tool-policy enforcement (docs/07 §9).
//
// The dashboard writes a tenant's per-tool allow/deny overlay into `ai_tool_policies`
// (services/api-rest/src/lib/ai/tool-policy.ts). Here the MCP server reads it: a tool
// with a row whose enabled=false is HIDDEN from tools/list (server.ts skips its
// registration) AND refused at dispatch (defense in depth). Absence of a row = the
// tool is exposed — the prior default-on behavior, so a tenant that never touches
// the policy surface sees no change.
//
// Read once per request (in buildServerForRequest), under the tenant GUC (withTenant)
// so RLS scopes it — one small indexed query, not per-tool.

import { withTenant } from '@sparx/db';

/** The set of tool names this tenant has explicitly DISABLED. Empty (all exposed)
 *  on any read error — the policy is an opt-in restriction, so failing open keeps
 *  the assistant working rather than silently stripping every tool. */
export async function loadDisabledTools(tenantId: string): Promise<Set<string>> {
  try {
    const rows = await withTenant({ tenantId }, (tx) =>
      tx.aiToolPolicy.findMany({ where: { enabled: false }, select: { toolName: true } })
    );
    return new Set(rows.map((r) => r.toolName));
  } catch (err) {
    console.error('[mcp-server] tool-policy load failed; exposing all tools', err);
    return new Set();
  }
}
