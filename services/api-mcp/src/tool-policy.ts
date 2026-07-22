// Per-SITE MCP tool-policy enforcement (docs/07 §9, docs/131 §3.5).
//
// The dashboard writes a per-tool allow/deny overlay into `ai_tool_policies`
// (services/api-rest/src/lib/ai/tool-policy.ts). Here the MCP server reads it: a tool
// with a row whose enabled=false is HIDDEN from tools/list (server.ts skips its
// registration) AND refused at dispatch (defense in depth). Absence of a row = the
// tool is exposed — the prior default-on behavior, so a tenant that never touches
// the policy surface sees no change.
//
// Read once per request (in buildServerForRequest), under the tenant GUC (withTenant)
// so RLS scopes it — one small indexed query, not per-tool.

import { withTenant } from '@sparx/db';

/**
 * The set of tool names DISABLED for this site.
 *
 * Resolution is most-specific-wins per tool: a row naming this site beats a
 * tenant-wide row, in EITHER direction. That matters more than it first looks —
 * it means a site can re-ENABLE a tool the tenant disabled broadly, so the
 * tenant-wide row is a default rather than a ceiling. A policy row is a safety
 * decision about a particular business, and before this the decision leaked to
 * businesses nobody was thinking about when they made it.
 *
 * `propertyId` may be null for a connection not bound to one site; only
 * tenant-wide rows apply then.
 *
 * Empty (all exposed) on any read error — the policy is an opt-in restriction,
 * so failing open keeps the assistant working rather than silently stripping
 * every tool.
 */
export async function loadDisabledTools(
  tenantId: string,
  propertyId: string | null
): Promise<Set<string>> {
  try {
    const rows = await withTenant({ tenantId }, (tx) =>
      tx.aiToolPolicy.findMany({
        // `OR` rather than `in: [id, null]` — Prisma's `in` rejects null even on
        // a nullable column.
        where: propertyId ? { OR: [{ propertyId }, { propertyId: null }] } : { propertyId: null },
        select: { toolName: true, enabled: true, propertyId: true },
      })
    );
    // Site rows applied last so they overwrite the tenant-wide verdict for the
    // same tool, whichever way that verdict goes.
    const verdict = new Map<string, boolean>();
    for (const r of rows.filter((r) => !r.propertyId)) verdict.set(r.toolName, r.enabled);
    for (const r of rows.filter((r) => r.propertyId)) verdict.set(r.toolName, r.enabled);
    return new Set([...verdict].filter(([, enabled]) => !enabled).map(([name]) => name));
  } catch (err) {
    console.error('[mcp-server] tool-policy load failed; exposing all tools', err);
    return new Set();
  }
}
