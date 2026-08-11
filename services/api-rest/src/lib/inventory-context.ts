import type { FastifyRequest } from 'fastify';
import { isModuleEnabled } from '@sparx/auth';
import { requireAnyRole, requireAuth } from '@sparx/api-core/auth';
import { moduleDisabled } from '@sparx/api-core/errors';

export interface InventoryContext {
  tenantId: string;
  userId: string;
}

export function toInventoryContext(request: FastifyRequest): InventoryContext {
  const auth = requireAuth(request);
  return { tenantId: auth.tenantId, userId: auth.actorId };
}

export async function requireInventoryModule(request: FastifyRequest): Promise<void> {
  const auth = requireAuth(request);
  const enabled = await isModuleEnabled(auth.tenantId, 'inventory');
  if (!enabled) throw moduleDisabled('inventory');
}

// ─── The warehouse-floor role (docs/146 Phase 1) ───────────────────────────────
//
// `scanner` is a LATERAL role: it floors to read-only in the ranked
// owner > admin > editor > viewer hierarchy, so `requireRole(request, 'editor')`
// correctly refuses it everywhere. The physical stock operations it exists for —
// receiving a delivery, entering a count, moving stock between locations, looking
// an item up — are therefore opened by an explicit allow-list rather than by
// promoting the role, which would hand a picker the whole console.
//
// It exists for a commercial reason as much as a security one. Per-seat pricing
// is one of the loudest complaints about this category; sparx bills per module,
// so a tenant can give every person on the floor a login at no extra cost. That
// offer is only responsible if there is a role safe to hand them.

/** The set admitted to a physical stock operation: everyone who could already do
 *  it, plus the floor. */
const SCAN_CAPABLE = ['owner', 'admin', 'editor', 'scanner'] as const;

/**
 * Gate a receive / count-entry / transfer / lookup endpoint.
 *
 * Use INSTEAD of `requireRole(request, 'editor')` on the operations a scanner
 * must perform — never in addition to it, which would deny them.
 */
export function requireScanCapable(request: FastifyRequest): void {
  requireAnyRole(request, SCAN_CAPABLE);
}

/** True when the caller is warehouse floor staff rather than office staff. */
export function isScannerActor(request: FastifyRequest): boolean {
  return requireAuth(request).role === 'scanner';
}

/**
 * Blank out cost fields for a scanner.
 *
 * "Cannot see what anything cost you" is a promise the team screen makes in those
 * words, so it has to be true of the API and not only of the interface — a role
 * whose limits are enforced by which buttons render is not a limit. Applied at
 * the transport rather than in the service because the service has one caller
 * shape and many consumers; only here do we know who is asking.
 *
 * Nulls rather than omissions: a client that renders `costCents` should show an
 * empty cell, not crash on a missing key or silently read it as zero.
 */
const COST_KEYS = new Set([
  'unitCostCents',
  'avgCostCents',
  'costCents',
  'totalCostCents',
  'subtotalCents',
  'totalCents',
  'valueCents',
  'retailValueCents',
  'landedUnitCostCents',
]);

export function redactCosts<T>(request: FastifyRequest, payload: T): T {
  if (!isScannerActor(request)) return payload;
  return stripCosts(payload) as T;
}

function stripCosts(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripCosts);
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = COST_KEYS.has(k) ? null : stripCosts(v);
  }
  return out;
}
