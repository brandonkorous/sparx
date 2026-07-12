'use server';

// Server actions for the AI Integrations settings page.
//
// Tenant-scoped (requireSession() resolves the tenant); only owner/admin
// can issue or revoke keys. The plaintext key is returned ONCE to the
// caller — the dashboard renders it inside the modal that triggered the
// issuance and never persists it client-side.

import 'server-only';
import { revalidatePath } from 'next/cache';
import {
  type IssuedKey,
  type McpScopeMeta,
  type StaffRole,
  issueApiKey as issueApiKeyService,
  listApiKeys as listApiKeysService,
  revokeApiKey as revokeApiKeyService,
  listMcpConnections as listMcpConnectionsService,
  revokeMcpConnection as revokeMcpConnectionService,
  MCP_SCOPE_CATALOG,
  grantableScopesForRole,
} from '@sparx/auth';
import { requireSession } from '@sparx/auth';

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

// Scopes an API key can be issued with are capped by the ISSUING staffer's
// role, same rule the MCP OAuth consent page enforces (packages/auth's
// grantableScopesForRole) — never a fixed CRM-only list.
function badScopes(scopes: string[], role: StaffRole): string | null {
  const grantable = new Set<string>(grantableScopesForRole(role));
  for (const s of scopes) {
    if (!grantable.has(s)) return s;
  }
  return null;
}

interface CreateInput {
  name: string;
  scopes: string[];
  expiresAt?: string | null;
}

export async function createApiKeyAction(input: CreateInput): Promise<ActionResult<IssuedKey>> {
  const session = await requireSession();
  if (session.user.role !== 'owner' && session.user.role !== 'admin') {
    return { ok: false, error: { message: 'Only owners or admins can issue API keys.' } };
  }
  if (!input.name?.trim()) {
    return { ok: false, error: { message: 'Name is required.' } };
  }
  if (!Array.isArray(input.scopes) || input.scopes.length === 0) {
    return { ok: false, error: { message: 'At least one scope is required.' } };
  }
  const bad = badScopes(input.scopes, session.user.role);
  if (bad) return { ok: false, error: { message: `Unsupported scope: ${bad}` } };

  try {
    const issued = await issueApiKeyService({
      tenantId: session.user.tenantId,
      name: input.name.trim(),
      scopes: input.scopes,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      createdByUserId: session.user.id,
    });
    revalidatePath('/settings/ai-integrations');
    return { ok: true, data: issued };
  } catch (err) {
    return { ok: false, error: { message: err instanceof Error ? err.message : String(err) } };
  }
}

export async function revokeApiKeyAction(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await requireSession();
  if (session.user.role !== 'owner' && session.user.role !== 'admin') {
    return { ok: false, error: { message: 'Only owners or admins can revoke API keys.' } };
  }
  try {
    await revokeApiKeyService(session.user.tenantId, id);
    revalidatePath('/settings/ai-integrations');
    return { ok: true, data: { id } };
  } catch (err) {
    return { ok: false, error: { message: err instanceof Error ? err.message : String(err) } };
  }
}

/** Scopes the current staffer's role may grant on a manually-issued API key —
 *  same catalog + role cap the MCP OAuth consent page uses, so a key can be
 *  scoped to any active module (Commerce, Inventory, Builder, ...), not just CRM. */
export async function getIssuableScopeCatalogForCurrentTenant(): Promise<McpScopeMeta[]> {
  const session = await requireSession();
  const grantable = new Set<string>(grantableScopesForRole(session.user.role as StaffRole));
  return MCP_SCOPE_CATALOG.filter((s) => grantable.has(s.scope));
}

export async function listApiKeysForCurrentTenant() {
  const session = await requireSession();
  return listApiKeysService(session.user.tenantId);
}

// ─── MCP OAuth connections (docs/07 §5) ──────────────────────────────────────
// Connected assistants that authorized via the OAuth flow (Claude/ChatGPT
// connectors), as opposed to the manually-issued sk_live_ keys above.

export async function listMcpConnectionsForCurrentTenant() {
  const session = await requireSession();
  return listMcpConnectionsService(session.user.tenantId);
}

/** Revoke an OAuth connection — deletes the tenant's tokens for that client,
 *  cutting the assistant off immediately. Owner/admin only, same bar as
 *  revoking an API key. */
export async function revokeMcpConnectionAction(
  clientId: string
): Promise<ActionResult<{ clientId: string; revoked: number }>> {
  const session = await requireSession();
  if (session.user.role !== 'owner' && session.user.role !== 'admin') {
    return { ok: false, error: { message: 'Only owners or admins can revoke connections.' } };
  }
  try {
    const revoked = await revokeMcpConnectionService(session.user.tenantId, clientId);
    revalidatePath('/settings/ai-integrations');
    return { ok: true, data: { clientId, revoked } };
  } catch (err) {
    return { ok: false, error: { message: err instanceof Error ? err.message : String(err) } };
  }
}
